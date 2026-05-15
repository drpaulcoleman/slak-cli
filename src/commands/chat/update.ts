import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChatUpdate extends BaseCommand {
  static override summary = 'Update a message'
  static override flags = {channel: Flags.string({required: true}), ts: Flags.string({required: true}), text: Flags.string({required: true}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ChatUpdate)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)
    try {
      await client.apiCall('chat.update', {channel: channelId, ts: flags.ts, text: flags.text})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to update message', ExitCode.ApiError, String(error), [])
    }
  }
}
