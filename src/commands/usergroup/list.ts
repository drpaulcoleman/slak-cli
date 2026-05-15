import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class UsergroupList extends BaseCommand {
  static override summary = 'List user groups'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('usergroups.list', {})
      return {usergroups: result.usergroups}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to list usergroups', ExitCode.ApiError, String(error), [])
    }
  }
}
