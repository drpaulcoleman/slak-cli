import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel, resolveUser} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChatEphemeral extends BaseCommand {
  static override summary = 'Send ephemeral message'
  static override flags = {channel: Flags.string({required: true}), user: Flags.string({required: true}), text: Flags.string({required: true}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ChatEphemeral)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)
    const userId = await resolveUser(flags.user, client)
    try {
      const result = await client.apiCall('chat.postEphemeral', {channel: channelId, user: userId, text: flags.text})
      return {message_ts: result.message_ts}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to send ephemeral', ExitCode.ApiError, String(error), [])
    }
  }
}
