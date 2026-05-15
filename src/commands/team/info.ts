import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class TeamInfo extends BaseCommand {
  static override summary = 'Get workspace info'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('team.info', {})
      return {team: result.team}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to get team info', ExitCode.ApiError, String(error), [])
    }
  }
}
