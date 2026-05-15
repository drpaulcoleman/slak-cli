import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelUnarchive extends BaseCommand {
  static override summary = 'Unarchive a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override examples = [
    'slak channel unarchive C123',
    'slak channel unarchive #old-project --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(ChannelUnarchive)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    try {
      await client.apiCall('conversations.unarchive', {channel: channelId})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to unarchive channel',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and permissions']
      )
    }
  }
}
