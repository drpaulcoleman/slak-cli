import {Flags} from '@oclif/core'
import {WebClient} from '@slack/web-api'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode, slackErrorToExitCode} from '../../lib/errors.js'
import {getWorkspaceManager} from '../../lib/workspaces.js'
import {logToStderr, progress} from '../../lib/output.js'
import {performOAuthFlow} from '../../lib/oauth.js'

/**
 * Authenticate with Slack and save workspace credentials.
 * Supports three auth modes:
 * 1. --token <token>: Direct token input (for CI/non-interactive)
 * 2. --oauth: Browser-based OAuth flow (interactive, opens browser)
 * 3. SLACK_BOT_TOKEN env var: Token from environment
 */
export default class AuthLogin extends BaseCommand {
  static override summary = 'Authenticate with a Slack workspace'

  static override description = `
    Authenticate with Slack and save workspace credentials.

    Three authentication modes:
    1. Direct token: --token <token> --workspace-name <name> (non-interactive)
    2. Browser OAuth: --oauth --client-id <id> --client-secret <secret> --workspace-name <name> (interactive)
    3. Environment var: SLACK_BOT_TOKEN or SLACK_USER_TOKEN

    Tokens are stored securely in OS keychain (via keytar).
    Workspace config is saved to ~/.config/slak/config.json.

    For OAuth flow (recommended for new users):
    1. Create a Slack app at https://api.slack.com/apps
    2. Copy your Client ID and Client Secret
    3. Run: slak auth login --oauth --client-id <id> --client-secret <secret>
    4. Approve in the browser window that opens
  `

  static override examples = [
    'slak auth login --token xoxb-1234567890-1234567890-ABCDEFGHIJK --workspace-name my-workspace',
    'slak auth login --oauth --client-id C123ABC --client-secret s3cr3t --workspace-name my-workspace',
    'SLACK_BOT_TOKEN=xoxb-... slak auth login --workspace-name my-workspace',
    'slak auth login --token $SLACK_BOT_TOKEN --workspace-name prod',
  ]

  static override enableJsonFlag = true

  static override flags = {
    token: Flags.string({
      description: 'Bot or user token (xoxb-* or xoxp-*)',
      env: 'SLACK_BOT_TOKEN',
      exclusive: ['oauth'],
    }),
    oauth: Flags.boolean({
      description: 'Use browser-based OAuth flow (requires --client-id and --client-secret)',
      default: false,
      exclusive: ['token'],
    }),
    'client-id': Flags.string({
      description: 'Slack app Client ID (for OAuth flow)',
      env: 'SLACK_CLIENT_ID',
      dependsOn: ['oauth'],
    }),
    'client-secret': Flags.string({
      description: 'Slack app Client Secret (for OAuth flow)',
      env: 'SLACK_CLIENT_SECRET',
      dependsOn: ['oauth'],
    }),
    'workspace-name': Flags.string({
      char: 'n',
      description: 'Friendly name for this workspace (e.g., "my-workspace", "prod")',
      required: true,
    }),
    'set-default': Flags.boolean({
      description: 'Set this workspace as default (auto-enabled if first workspace)',
      default: false,
    }),
    scopes: Flags.string({
      description: 'OAuth scopes (comma-separated, default: chat:write,users:read,channels:read)',
      default: 'chat:write,users:read,channels:read,channels:history',
    }),
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(AuthLogin)

    // Validate inputs
    const hasToken = flags.token || process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN
    const hasOAuth = flags.oauth

    if (!hasToken && !hasOAuth) {
      throw new SlakError(
        'No authentication method provided',
        ExitCode.ValidationError,
        'missing_auth_method',
        [
          'Use --oauth for browser-based authentication (recommended)',
          'Use --token <token> for direct token authentication',
          'Set SLACK_BOT_TOKEN or SLACK_USER_TOKEN environment variable',
        ],
      )
    }

    // Handle OAuth flow
    let token = ''
    let teamId = ''
    let userName = ''
    let teamName = ''

    if (hasOAuth) {
      if (!flags['client-id'] || !flags['client-secret']) {
        throw new SlakError(
          'OAuth requires --client-id and --client-secret',
          ExitCode.ValidationError,
          'missing_arg',
          [
            'Create a Slack app at https://api.slack.com/apps',
            'Copy Client ID and Secret to flags or env vars (SLACK_CLIENT_ID, SLACK_CLIENT_SECRET)',
          ],
        )
      }

      if (!this.isInteractive()) {
        throw new SlakError(
          'OAuth flow requires interactive terminal',
          ExitCode.ValidationError,
          'not_interactive',
          [
            'Use --token for non-interactive authentication',
            'Or run this command in an interactive terminal for OAuth',
          ],
        )
      }

      try {
        progress('Opening browser for Slack OAuth authorization...')
        const oauthToken = await performOAuthFlow({
          clientId: flags['client-id'],
          clientSecret: flags['client-secret'],
          scopes: (flags.scopes || '').split(',').filter(Boolean),
          redirectUri: 'http://localhost:3000/callback',
        })

        token = oauthToken.accessToken
        teamId = oauthToken.teamId
        teamName = oauthToken.teamName
        userName = oauthToken.userName
      } catch (error) {
        throw new SlakError(
          `OAuth flow failed: ${String(error)}`,
          ExitCode.AuthError,
          'oauth_error',
          ['Verify client ID and secret are correct', 'Check scopes are enabled in your Slack app'],
        )
      }
    } else {
      // Token-based flow (existing behavior)
      const foundToken = flags.token || process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN
      if (!foundToken) {
        throw new SlakError(
          'No token available',
          ExitCode.ValidationError,
          'missing_auth_method',
          ['Provide --token or set SLACK_BOT_TOKEN environment variable'],
        )
      }
      token = foundToken
    }

    // Validate token format (skip for OAuth since we already got it securely)
    if (!hasOAuth && !this.isValidTokenFormat(token)) {
      throw new SlakError(
        'Invalid token format',
        ExitCode.ValidationError,
        'invalid_arg',
        ['Tokens should start with xoxb- (bot) or xoxp- (user)', 'Example: xoxb-1234567890-1234567890-ABCDEFGH'],
      )
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
      isDefault: flags['set-default'] ?? false,
    })

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
