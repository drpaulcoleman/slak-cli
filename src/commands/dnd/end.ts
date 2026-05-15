import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class DndEnd extends BaseCommand {
  static override summary = 'End Do Not Disturb'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      await client.apiCall('dnd.endSnooze', {})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to end DND', ExitCode.ApiError, String(error), [])
    }
  }
}
