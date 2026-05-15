import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UsergroupEnable extends BaseCommand {
  static override summary = 'Enable user group'
  static override args = {usergroup: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(UsergroupEnable)
    const client = await this.getSlakClient()
    try {
      await client.apiCall('usergroups.enable', {usergroup: args.usergroup})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to enable usergroup', ExitCode.ApiError, String(error), [])
    }
  }
}
