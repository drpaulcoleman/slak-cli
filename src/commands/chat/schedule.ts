import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChatSchedule extends BaseCommand {
  static override summary = 'Schedule a message'
  static override flags = {channel: Flags.string({required: true}), text: Flags.string({required: true}), time: Flags.string({required: true}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ChatSchedule)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)
    try {
      const result = await client.apiCall('chat.scheduleMessage', {channel: channelId, text: flags.text, post_at: flags.time})
      return {scheduled_message_id: result.scheduled_message_id}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to schedule message', ExitCode.ApiError, String(error), [])
    }
  }
}
