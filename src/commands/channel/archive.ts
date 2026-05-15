import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelArchive extends BaseCommand {
  static override summary = 'Archive a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override examples = [
    'slak channel archive C123',
    'slak channel archive #old-project --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(ChannelArchive)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    try {
      await client.apiCall('conversations.archive', {channel: channelId})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to archive channel',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and permissions']
      )
    }
  }
}
