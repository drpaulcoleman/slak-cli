import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel, resolveUser} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelInvite extends BaseCommand {
  static override summary = 'Invite users to a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override flags = {
    users: Flags.string({
      required: true,
      description: 'Comma-separated user IDs or names',
    }),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel invite C123 --users U123,U456',
    'slak channel invite #general --users alice,bob --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(ChannelInvite)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    const userIds: string[] = []
    for (const user of flags.users.split(',')) {
      const userId = await resolveUser(user.trim(), client)
      userIds.push(userId)
    }

    try {
      const result = await client.apiCall('conversations.invite', {
        channel: channelId,
        users: userIds.join(','),
      })
      return {channel: result.channel}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to invite users to channel',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and user IDs']
      )
    }
  }
}
