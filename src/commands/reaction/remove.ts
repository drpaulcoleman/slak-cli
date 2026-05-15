import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ReactionRemove extends BaseCommand {
  static override summary = 'Remove an emoji reaction from a message'

  static override flags = {
    emoji: Flags.string({required: true, description: 'Emoji name (without colons)'}),
    channel: Flags.string({required: true, description: 'Channel ID or name'}),
    ts: Flags.string({required: true, description: 'Message timestamp'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak reaction remove --emoji thumbsup --channel C123 --ts 1234567890.123456',
    'slak reaction remove --emoji heart --channel #general --ts 1234567890.123456 --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ReactionRemove)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)

    try {
      await client.apiCall('reactions.remove', {
        name: flags.emoji,
        channel: channelId,
        timestamp: flags.ts,
      })
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to remove reaction',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID, message timestamp, and emoji name']
      )
    }
  }
}
