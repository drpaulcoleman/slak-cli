import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelMark extends BaseCommand {
  static override summary = 'Mark messages as read in a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override flags = {
    ts: Flags.string({required: true, description: 'Message timestamp to mark as read'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel mark C123 --ts 1234567890.123456',
    'slak channel mark #general --ts 1234567890.123456 --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(ChannelMark)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    try {
      await client.apiCall('conversations.mark', {
        channel: channelId,
        ts: flags.ts,
      })
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to mark channel',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and timestamp']
      )
    }
  }
}
