import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class EventListen extends BaseCommand {
  static override summary = 'Listen to Slack events via Socket Mode'
  static override enableJsonFlag = true
  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    await this.parse(EventListen)
    try {
      // Socket Mode setup would go here
      // await this.getSlakClient()
      // TODO: Implement Socket Mode event listener
      throw new Error('Socket Mode not yet implemented')
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to listen to events', ExitCode.ApiError, String(error), [])
    }
  }
}
