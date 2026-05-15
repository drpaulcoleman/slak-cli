import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ReminderDelete extends BaseCommand {
  static override summary = 'Delete a reminder'
  static override args = {reminder: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(ReminderDelete)
    const client = await this.getSlakClient()
    try {
      await client.apiCall('reminders.delete', {reminder: args.reminder})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to delete reminder', ExitCode.ApiError, String(error), [])
    }
  }
}
