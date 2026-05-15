import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class DndInfo extends BaseCommand {
  static override summary = 'Get DND info'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('dnd.info', {})
      return {dnd_enabled: result.dnd_enabled, next_dnd_start_ts: result.next_dnd_start_ts}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to get DND info', ExitCode.ApiError, String(error), [])
    }
  }
}
