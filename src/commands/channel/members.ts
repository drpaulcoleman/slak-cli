import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {paginate} from '../../lib/paginate.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelMembers extends BaseCommand {
  static override summary = 'List members of a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override flags = {
    limit: Flags.integer({default: 100}),
    cursor: Flags.string(),
    all: Flags.boolean(),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel members C123',
    'slak channel members #general --json',
    'slak channel members C123 --all --json | jq length',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(ChannelMembers)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)
    const members: string[] = []

    try {
      for await (const memberId of paginate(
        client,
        'conversations.members',
        {channel: channelId},
        'members',
        {limit: flags.limit, all: flags.all, cursor: flags.cursor}
      )) {
        members.push(memberId as string)
      }

      return {members}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to list channel members',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and try again']
      )
    }
  }
}
