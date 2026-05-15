import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveUser} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UserPresence extends BaseCommand {
  static override summary = 'Get user presence status'
  static override args = {user: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(UserPresence)
    const client = await this.getSlakClient()
    const userId = await resolveUser(args.user, client)
    try {
      const result = await client.apiCall('users.getPresence', {user: userId})
      return {presence: result.presence}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to get presence', ExitCode.ApiError, String(error), [])
    }
  }
}
