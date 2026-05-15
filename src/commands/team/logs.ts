import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class TeamLogs extends BaseCommand {
  static override summary = 'Get audit logs'
  static override flags = {limit: Flags.integer({default: 100}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(TeamLogs)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('team.accessLogs', {count: flags.limit})
      return {entries: result.entries}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to get logs', ExitCode.ApiError, String(error), [])
    }
  }
}
