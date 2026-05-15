import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UserSetPresence extends BaseCommand {
  static override summary = 'Set presence status'
  static override flags = {presence: Flags.string({required: true, options: ['active', 'away']}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(UserSetPresence)
    const client = await this.getSlakClient()
    try {
      await client.apiCall('users.setPresence', {presence: flags.presence})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to set presence', ExitCode.ApiError, String(error), [])
    }
  }
}
