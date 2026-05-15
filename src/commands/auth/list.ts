import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'
import {getWorkspaceManager} from '../../lib/workspaces.js'

/**
 * List all authenticated Slack workspaces.
 * Shows workspace name, team ID, and marks default workspace.
 */
export default class AuthList extends BaseCommand {
  static override summary = 'List authenticated Slack workspaces'

  static override description = `
    List all saved Slack workspace credentials.

    Shows workspace name, team ID, and marks the default workspace with *.
    Useful for managing multiple workspace authenticati on tokens.
  `

  static override examples = [
    'slak auth list',
    'slak auth list --json',
    'slak auth list --json | jq .[].name',
  ]

  static override enableJsonFlag = true

  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const manager = getWorkspaceManager()
    const workspaces = manager.listWorkspaces()

    if (workspaces.length === 0) {
      throw new SlakError(
        'No workspaces configured',
        ExitCode.AuthError,
        'invalid_auth',
        ['Run "slak auth login" to authenticate with Slack'],
      )
    }

    // Get default workspace ID
    const defaultWorkspace = manager.getWorkspace()
    const defaultId = defaultWorkspace?.id

    // Format for human-readable output
    if (!this.isJsonMode()) {
      this.log('')
      this.log('AUTHENTICATED WORKSPACES')
      this.log('')

      for (const ws of workspaces) {
        const isDefault = ws.id === defaultId ? ' *' : ''
        const line = `  ${ws.name.padEnd(20)} ${ws.teamId}${isDefault}`
        this.log(line)
      }

      this.log('')
      if (defaultWorkspace) {
        this.log(`Default: ${defaultWorkspace.name}`)
      }
      this.log('')

      return {workspaces: workspaces.length, default: defaultWorkspace?.name}
    }

    // JSON output
    return {
      workspaces: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        teamId: ws.teamId,
        isDefault: ws.id === defaultId,
        createdAt: new Date(ws.createdAt).toISOString(),
      })),
      defaultWorkspaceId: defaultId,
      total: workspaces.length,
    }
  }
}
