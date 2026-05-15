import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel, resolveUser} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelKick extends BaseCommand {
  static override summary = 'Remove a user from a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override flags = {
    user: Flags.string({required: true, description: 'User ID or name'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel kick C123 --user U456',
    'slak channel kick #general --user alice --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(ChannelKick)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)
    const userId = await resolveUser(flags.user, client)

    try {
      await client.apiCall('conversations.kick', {
        channel: channelId,
        user: userId,
      })
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to remove user from channel',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and user ID']
      )
    }
  }
}
