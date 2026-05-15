import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class AdminUsers extends BaseCommand {
  static override summary = 'List workspace users'
  static override flags = {limit: Flags.integer({default: 100}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(AdminUsers)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('admin.users.list', {limit: flags.limit})
      return {users: result.users}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to list users', ExitCode.ApiError, String(error), [])
    }
  }
}
