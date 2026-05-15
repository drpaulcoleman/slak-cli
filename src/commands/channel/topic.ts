import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelTopic extends BaseCommand {
  static override summary = 'Set the topic of a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override flags = {
    value: Flags.string({required: true, description: 'New topic value'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel topic C123 --value "General discussion"',
    'slak channel topic #general --value "" --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(ChannelTopic)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    try {
      const result = await client.apiCall('conversations.setTopic', {
        channel: channelId,
        topic: flags.value,
      })
      return {channel: result.channel}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to set channel topic',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and permissions']
      )
    }
  }
}
