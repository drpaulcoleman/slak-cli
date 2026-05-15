import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelJoin extends BaseCommand {
  static override summary = 'Join a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override examples = [
    'slak channel join C123',
    'slak channel join #general --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(ChannelJoin)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    try {
      const result = await client.apiCall('conversations.join', {channel: channelId})
      return {channel: result.channel}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to join channel',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and permissions']
      )
    }
  }
}
