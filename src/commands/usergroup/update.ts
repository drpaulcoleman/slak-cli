import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UsergroupUpdate extends BaseCommand {
  static override summary = 'Update user group'
  static override args = {usergroup: Args.string({required: true})}
  static override flags = {name: Flags.string(), handle: Flags.string(), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(UsergroupUpdate)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('usergroups.update', {usergroup: args.usergroup, name: flags.name, handle: flags.handle})
      return {usergroup: result.usergroup}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to update usergroup', ExitCode.ApiError, String(error), [])
    }
  }
}
