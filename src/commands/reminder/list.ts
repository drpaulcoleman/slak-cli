import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ReminderList extends BaseCommand {
  static override summary = 'List reminders'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('reminders.list', {})
      return {reminders: result.reminders}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to list reminders', ExitCode.ApiError, String(error), [])
    }
  }
}
