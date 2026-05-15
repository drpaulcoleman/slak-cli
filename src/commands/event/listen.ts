import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class EventListen extends BaseCommand {
  static override summary = 'Listen to Slack events via Socket Mode'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      // Socket Mode setup would go here
      return {status: 'listening'}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to listen to events', ExitCode.ApiError, String(error), [])
    }
  }
}
