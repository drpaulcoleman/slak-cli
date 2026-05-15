import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UsergroupDisable extends BaseCommand {
  static override summary = 'Disable user group'
  static override args = {usergroup: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(UsergroupDisable)
    const client = await this.getSlakClient()
    try {
      await client.apiCall('usergroups.disable', {usergroup: args.usergroup})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to disable usergroup', ExitCode.ApiError, String(error), [])
    }
  }
}
