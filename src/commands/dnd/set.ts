import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class DndSet extends BaseCommand {
  static override summary = 'Set Do Not Disturb'
  static override flags = {duration: Flags.integer({description: 'Minutes of snooze'}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(DndSet)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('dnd.setSnooze', {num_minutes: flags.duration || 60})
      return {snooze_enabled: result.snooze_enabled}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to set DND', ExitCode.ApiError, String(error), [])
    }
  }
}
