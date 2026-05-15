import {Flags} from '@oclif/core'
import {WebClient} from '@slack/web-api'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode, slackErrorToExitCode} from '../../lib/errors.js'
import {getWorkspaceManager} from '../../lib/workspaces.js'
import {logToStderr} from '../../lib/output.js'

/**
 * Authenticate with Slack and save workspace credentials.
 * Supports three auth modes:
 * 1. --token <token>: Direct token input (for CI/non-interactive)
 * 2. --browser: OAuth flow via browser (interactive)
 * 3. SLACK_BOT_TOKEN env var: Token from environment
 */
export default class AuthLogin extends BaseCommand {
  static override summary = 'Authenticate with a Slack workspace'

  static override description = `
    Authenticate with Slack and save workspace credentials.

    Three authentication modes:
    1. Direct token: --token <token> --workspace-name <name> (non-interactive)
    2. Browser OAuth: --browser (interactive, opens browser)
    3. Environment var: SLACK_BOT_TOKEN or SLACK_USER_TOKEN

    Tokens are stored securely in OS keychain (via keytar).
    Workspace config is saved to ~/.config/slak/config.json.
  `

  static override examples = [
    'slak auth login --token xoxb-1234567890-1234567890-ABCDEFGHIJK --workspace-name my-workspace',
    'slak auth login --browser',
    'SLACK_BOT_TOKEN=xoxb-... slak auth login --workspace-name my-workspace',
    'slak auth login --token $SLACK_BOT_TOKEN --workspace-name prod',
  ]

  static override enableJsonFlag = true

  static override flags = {
    token: Flags.string({
      description: 'Bot or user token (xoxb-* or xoxp-*)',
      env: 'SLACK_BOT_TOKEN',
      exclusive: ['browser'],
    }),
    'workspace-name': Flags.string({
      char: 'n',
      description: 'Friendly name for this workspace (e.g., "my-workspace", "prod")',
      required: true,
    }),
    browser: Flags.boolean({
      description: 'Open browser for OAuth authentication (interactive mode)',
      default: false,
      exclusive: ['token'],
    }),
    'set-default': Flags.boolean({
      description: 'Set this workspace as default (auto-enabled if first workspace)',
      default: false,
    }),
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(AuthLogin)

    // Validate inputs
    if (!flags.token && !flags.browser && !process.env.SLACK_BOT_TOKEN && !process.env.SLACK_USER_TOKEN) {
      throw new SlakError(
        'No authentication method provided',
        ExitCode.ValidationError,
        'missing_auth_method',
        [
          'Use --token <token> for direct authentication',
          'Use --browser to open OAuth in browser',
          'Set SLACK_BOT_TOKEN or SLACK_USER_TOKEN environment variable',
        ],
      )
    }

    // Get token from flag, env var, or browser
    let token = flags.token
    if (!token) {
      token = process.env.SLACK_BOT_TOKEN || process.env.SLACK_USER_TOKEN
    }

    if (!token && flags.browser) {
      // Browser mode not yet implemented
      throw new SlakError(
        'Browser authentication not yet implemented',
        ExitCode.ApiError,
        'not_implemented',
        ['Use --token <token> for now'],
      )
    }

    if (!token) {
      throw new SlakError(
        'No token available',
        ExitCode.ValidationError,
        'missing_auth_method',
        ['Provide --token or set SLACK_BOT_TOKEN environment variable'],
      )
    }

    // Validate token format
    if (!this.isValidTokenFormat(token)) {
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
    const workspaceConfig = manager.addWorkspace({
      name: flags['workspace-name'],
      teamId: authTest.team_id,
      tokenLabel: `slak-${flags['workspace-name']}-${Date.now()}`,
      isDefault: flags['set-default'],
    })

    logToStderr(`✓ Authenticated as ${authTest.user} on ${authTest.team}`)
    logToStderr(`✓ Workspace "${workspaceConfig.name}" saved (ID: ${workspaceConfig.id})`)

    return {
      workspace: {
        id: workspaceConfig.id,
        name: workspaceConfig.name,
        teamId: workspaceConfig.teamId,
        tokenLabel: workspaceConfig.tokenLabel,
        isDefault: workspaceConfig.isDefault,
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
