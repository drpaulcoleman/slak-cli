import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelInfo extends BaseCommand {
  static override summary = 'Get detailed info about a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override examples = [
    'slak channel info C123',
    'slak channel info #general --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(ChannelInfo)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    try {
      const result = await client.apiCall('conversations.info', {channel: channelId})
      return {channel: result.channel}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to get channel info',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and try again']
      )
    }
  }
}
