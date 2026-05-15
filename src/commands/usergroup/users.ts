import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UsergroupUsers extends BaseCommand {
  static override summary = 'List usergroup members'
  static override args = {usergroup: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(UsergroupUsers)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('usergroups.users.list', {usergroup: args.usergroup})
      return {users: result.users}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to list usergroup users', ExitCode.ApiError, String(error), [])
    }
  }
}
