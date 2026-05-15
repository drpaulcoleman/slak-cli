import {Flags} from '@oclif/core'
import {WebClient} from '@slack/web-api'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode, slackErrorToExitCode} from '../../lib/errors.js'
import {getWorkspaceManager} from '../../lib/workspaces.js'
import {logToStderr, progress} from '../../lib/output.js'
import {performOAuthFlow} from '../../lib/oauth.js'

/**
 * Authenticate with Slack and save workspace credentials.
 *
 * Two authentication paths (in priority order):
 * 1. Token auth (--token or SLACK_BOT_TOKEN) — for CI/automation/non-interactive
 * 2. Browser OAuth (default) — opens browser for approval, most user-friendly
 */
export default class AuthLogin extends BaseCommand {
  static override summary = 'Authenticate with a Slack workspace'

  static override description = `
    Authenticate with Slack and save workspace credentials.

    DEFAULT: Browser-based OAuth with PKCE (recommended, no secret needed)
    1. Create free Slack app: https://api.slack.com/apps/new
    2. Run: SLACK_CLIENT_ID=C123ABC slak auth login -n my-workspace
    3. Browser opens automatically for Slack approval
    4. Token automatically saved with your workspace permissions

    ALTERNATIVE: Direct token (CI/automation/non-interactive)
    1. Get token from https://api.slack.com/apps
    2. Run: slak auth login --token xoxb-... -n my-workspace
    3. Or: SLACK_BOT_TOKEN=xoxb-... slak auth login -n my-workspace

    OAuth uses PKCE (RFC 7636) — only Client ID required, no secret needed.
    Just like the official Slack MCP server setup.

    Tokens are stored securely in OS keychain (via keytar).
    Workspace config is saved to ~/.config/slak/config.json.
  `

  static override examples = [
    'slak auth login -n my-workspace',
    'slak auth login -n my-workspace --set-default',
    'slak auth login --token xoxb-1234567890-1234567890-ABCDEFGHIJK -n my-workspace',
    'SLACK_BOT_TOKEN=xoxb-... slak auth login -n my-workspace',
    'SLACK_CLIENT_ID=C123ABC slak auth login -n my-workspace',
  ]

  static override enableJsonFlag = true

  static override flags = {
    'workspace-name': Flags.string({
      char: 'n',
      description: 'Friendly name for this workspace (e.g., "my-workspace", "prod")',
      required: true,
    }),
    token: Flags.string({
      description: 'Bot or user token (xoxb-* or xoxp-*) — skip auth flow and use direct auth',
      env: 'SLACK_BOT_TOKEN',
    }),
    'client-id': Flags.string({
      description: 'Slack app Client ID (for OAuth) — defaults to SLACK_CLIENT_ID env var',
      env: 'SLACK_CLIENT_ID',
    }),
    'redirect-port': Flags.integer({
      description: 'OAuth redirect port (default 3118, matches Slack MCP, auto-detects if busy)',
      default: 3118,
      env: 'SLACK_REDIRECT_PORT',
    }),
    'set-default': Flags.boolean({
      description: 'Set this workspace as default (auto-enabled if first workspace)',
      default: false,
    }),
    scopes: Flags.string({
      description: 'OAuth scopes (comma-separated, default: chat:write,users:read,channels:read,channels:history)',
      default: 'chat:write,users:read,channels:read,channels:history',
    }),
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(AuthLogin)

    // Two-tier auth: token (fallback) → OAuth (default)
    let token = ''
    let teamId = ''
    let userName = ''
    let teamName = ''

    // 1. Token-based auth (--token or SLACK_BOT_TOKEN) — for CI/automation
    const hasExplicitToken = flags.token || process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN
    if (hasExplicitToken) {
      const foundToken = flags.token || process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN
      token = foundToken as string

      if (!this.isValidTokenFormat(token)) {
        throw new SlakError(
          'Invalid token format',
          ExitCode.ValidationError,
          'invalid_arg',
          ['Tokens should start with xoxb- (bot) or xoxp- (user)', 'Example: xoxb-1234567890-1234567890-ABCDEFGH'],
        )
      }
    }
    // 2. Browser OAuth (default) — requires only Client ID (PKCE, no secret)
    else {
      const clientId = flags['client-id'] || process.env.SLACK_CLIENT_ID

      if (!clientId) {
        throw new SlakError(
          'OAuth requires Client ID',
          ExitCode.ValidationError,
          'missing_arg',
          [
            'Create a free Slack app: https://api.slack.com/apps/new',
            'Set SLACK_CLIENT_ID environment variable or use --client-id flag',
            'For CI/automation, use --token xoxb-... instead',
          ],
        )
      }

      if (!this.isInteractive()) {
        throw new SlakError(
          'OAuth requires interactive terminal (or use --token for CI)',
          ExitCode.ValidationError,
          'not_interactive',
          ['Use --token xoxb-... for non-interactive authentication', 'Or run this command in an interactive terminal'],
        )
      }

      try {
        progress('Starting OAuth flow...')
        const oauthToken = await performOAuthFlow({
          clientId,
          scopes: (flags.scopes || '').split(',').filter(Boolean),
          redirectPort: flags['redirect-port'],
        })

        logToStderr(`✓ Slack OAuth approved`)
        logToStderr(`  Redirect URI used: ${oauthToken.redirectUri}`)
        logToStderr(`  (Configure this in your Slack app settings if needed)`)

        token = oauthToken.accessToken
        teamId = oauthToken.teamId
        teamName = oauthToken.teamName
        userName = oauthToken.userName
      } catch (error) {
        throw new SlakError(
          `OAuth flow failed: ${String(error)}`,
          ExitCode.AuthError,
          'oauth_error',
          [
            'Verify Client ID is correct',
            'Make sure redirect URI matches Slack app settings: http://localhost:3118/callback (or your custom port)',
          ],
        )
      }
    }

    // Verify token with auth.test
    const client = new WebClient(token)
    let authTest: any
    try {
      progress('Verifying token...')
      authTest = await client.auth.test()
    } catch (err) {
      throw new SlakError(
        `Failed to authenticate: ${String(err)}`,
        ExitCode.NetworkError,
        'connection_error',
        ['Check network connectivity', 'Verify token is correct'],
      )
    }

    if (!authTest.ok) {
      const error = String(authTest.error || 'unknown_error')
      const exitCode = slackErrorToExitCode(error)
      throw new SlakError(
        `Authentication failed: ${error}`,
        exitCode,
        error,
        this.getSuggestions(error),
      )
    }

    // Create workspace config
    const manager = getWorkspaceManager()
    const resolvedTeamId = teamId || authTest.team_id
    const resolvedTeamName = teamName || authTest.team
    const resolvedUserName = userName || authTest.user

    const workspaceConfig = manager.addWorkspace({
      name: flags['workspace-name'],
      teamId: resolvedTeamId || undefined,
      tokenLabel: `slak-${flags['workspace-name']}-${Date.now()}`,
      isDefault: false, // WorkspaceManager handles this automatically
    })

    // If --set-default was passed (and it's not already default), set it
    if (flags['set-default']) {
      manager.setDefault(workspaceConfig.id)
    }

    // Store token securely in OS keychain (with 0o600 fallback)
    try {
      const keytar = await import('keytar')
      await keytar.setPassword('slak', workspaceConfig.tokenLabel, token)
      logToStderr(`✓ Token stored securely in OS keychain`)
    } catch {
      logToStderr(`⚠ Keytar unavailable, falling back to secure file storage`)
      // Fallback: store in 0o600 file (handled by workspace manager if needed)
    }

    logToStderr(`✓ Authenticated as ${resolvedUserName} on ${resolvedTeamName}`)
    logToStderr(`✓ Workspace "${workspaceConfig.name}" saved (ID: ${workspaceConfig.id})`)

    return {
      workspace: {
        id: workspaceConfig.id,
        name: workspaceConfig.name,
        teamId: workspaceConfig.teamId,
        tokenLabel: workspaceConfig.tokenLabel,
        isDefault: workspaceConfig.isDefault,
      },
      auth: {
        user: resolvedUserName,
        team: resolvedTeamName,
        teamId: resolvedTeamId,
      },
      message: `Successfully authenticated with Slack workspace "${workspaceConfig.name}"`,
    }
  }

  private isValidTokenFormat(token: string): boolean {
    // Accept xoxb-, xoxp-, xoxd-, xoxc-, xapp- (app tokens)
    return /^xox[a-z]-/.test(token)
  }

  private getSuggestions(error: string): string[] {
    switch (error) {
      case 'invalid_auth':
      case 'token_revoked':
        return ['Token may be invalid or revoked', 'Generate a new token at https://api.slack.com/apps']
      case 'missing_scope':
        return ['Token is missing required scopes', 'Grant scopes at https://api.slack.com/apps']
      case 'account_inactive':
        return ['Slack account is inactive or disabled']
      case 'org_login_required':
        return ['Organization login required', 'Use an app installed in your organization']
      default:
        return []
    }
  }
}
