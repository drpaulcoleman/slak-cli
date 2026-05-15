import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UsergroupCreate extends BaseCommand {
  static override summary = 'Create user group'
  static override flags = {name: Flags.string({required: true}), handle: Flags.string(), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(UsergroupCreate)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('usergroups.create', {name: flags.name, handle: flags.handle})
      return {usergroup: result.usergroup}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to create usergroup', ExitCode.ApiError, String(error), [])
    }
  }
}
