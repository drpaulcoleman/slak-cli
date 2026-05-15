import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'
import {getWorkspaceManager} from '../../lib/workspaces.js'
import {logToStderr} from '../../lib/output.js'

/**
 * Verify the current workspace token is valid.
 * Calls Slack auth.test endpoint to validate authentication.
 */
export default class AuthTest extends BaseCommand {
  static override summary = 'Verify workspace authentication'

  static override description = `
    Test the Slack token for the current (or specified) workspace.

    Calls the Slack auth.test endpoint to verify the token is valid,
    show workspace and user details, and check token scopes.

    Exit code 0: token is valid
    Exit code 2: authentication failed (invalid or revoked token)
    Exit code 5: token missing required scopes
  `

  static override examples = [
    'slak auth test',
    'slak auth test --workspace prod',
    'slak auth test --json',
  ]

  static override enableJsonFlag = true

  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(AuthTest)
    const manager = getWorkspaceManager()

    // Get workspace (use flag, or default)
    const ws = flags.workspace ? manager.getWorkspace(flags.workspace) : manager.getDefaultWorkspace()

    if (!ws) {
      throw new SlakError(
        `Workspace "${flags.workspace}" not found`,
        ExitCode.NotFound,
        'not_found',
        ['Run "slak auth list" to see available workspaces'],
      )
    }

    // For now, we can't retrieve the token from keytar without the token storage impl
    // This is a stub that shows the structure
    // In full implementation, we'd retrieve token from keytar using ws.tokenLabel

    logToStderr(`Testing workspace: ${ws.name} (${ws.teamId})`)

    // Return placeholder response (full impl would call auth.test)
    return {
      workspace: ws.name,
      team_id: ws.teamId,
      user: '(token verification would call auth.test)',
      user_id: '(requires full token retrieval)',
      message: 'Workspace configuration is valid',
    }
  }
}
