import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChatPermalink extends BaseCommand {
  static override summary = 'Get message permalink'
  static override flags = {channel: Flags.string({required: true}), ts: Flags.string({required: true}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ChatPermalink)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)
    try {
      const result = await client.apiCall('chat.getPermalink', {channel: channelId, message_ts: flags.ts})
      return {permalink: result.permalink}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to get permalink', ExitCode.ApiError, String(error), [])
    }
  }
}
