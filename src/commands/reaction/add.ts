import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ReactionAdd extends BaseCommand {
  static override summary = 'Add an emoji reaction to a message'

  static override flags = {
    emoji: Flags.string({required: true, description: 'Emoji name (without colons)'}),
    channel: Flags.string({required: true, description: 'Channel ID or name'}),
    ts: Flags.string({required: true, description: 'Message timestamp'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak reaction add --emoji thumbsup --channel C123 --ts 1234567890.123456',
    'slak reaction add --emoji heart --channel #general --ts 1234567890.123456 --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ReactionAdd)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)

    try {
      await client.apiCall('reactions.add', {
        name: flags.emoji,
        channel: channelId,
        timestamp: flags.ts,
      })
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to add reaction',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID, message timestamp, and emoji name']
      )
    }
  }
}
