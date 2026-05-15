import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {getWorkspaceManager} from '../../lib/workspaces.js'
import {logToStderr} from '../../lib/output.js'

/**
 * Remove a Slack workspace from local credentials.
 * Removes the workspace config and its stored token.
 */
export default class AuthLogout extends BaseCommand {
  static override summary = 'Remove a Slack workspace'

  static override description = `
    Remove a Slack workspace from your local credentials.

    Deletes the workspace configuration and its stored token.
    If you remove the default workspace, the next available workspace becomes default.
    This does not revoke the token from Slack; you can add it again later with the same token.

    To revoke the token from Slack itself, visit api.slack.com to manage your apps.
  `

  static override examples = [
    'slak auth logout --workspace prod',
    'slak auth logout',
    'slak auth logout --json',
  ]

  static override enableJsonFlag = true

  static override flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation prompt',
      default: false,
    }),
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(AuthLogout)
    const manager = getWorkspaceManager()

    // Get workspace to remove
    const ws = flags.workspace ? manager.getWorkspace(flags.workspace) : manager.getDefaultWorkspace()

    if (!ws) {
      const searchTerm = flags.workspace || 'default'
      this.error(`Workspace "${searchTerm}" not found`, {exit: 3})
    }

    const removedName = ws.name
    const wasDefault = ws.isDefault

    // Remove the workspace
    manager.removeWorkspace(ws.id)

    logToStderr(`✓ Removed workspace: ${removedName}`)

    // Get new default (if any)
    let newDefault: string | null = null
    try {
      const defaultWs = manager.getDefaultWorkspace()
      newDefault = defaultWs.name
      if (newDefault !== removedName) {
        logToStderr(`✓ Default workspace: ${newDefault}`)
      }
    } catch {
      logToStderr('ℹ No workspaces remaining')
    }

    return {
      removed: removedName,
      wasDefault,
      newDefault,
      message: `Workspace "${removedName}" removed`,
    }
  }
}
