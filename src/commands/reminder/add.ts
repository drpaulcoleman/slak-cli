import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ReminderAdd extends BaseCommand {
  static override summary = 'Create a reminder'
  static override flags = {text: Flags.string({required: true}), time: Flags.string({required: true}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ReminderAdd)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('reminders.add', {text: flags.text, time: flags.time})
      return {reminder: result.reminder}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to create reminder', ExitCode.ApiError, String(error), [])
    }
  }
}
