import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ReactionList extends BaseCommand {
  static override summary = 'List emoji reactions on a message'

  static override flags = {
    channel: Flags.string({required: true, description: 'Channel ID or name'}),
    ts: Flags.string({required: true, description: 'Message timestamp'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak reaction list --channel C123 --ts 1234567890.123456',
    'slak reaction list --channel #general --ts 1234567890.123456 --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ReactionList)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)

    try {
      const result = await client.apiCall('reactions.get', {
        channel: channelId,
        timestamp: flags.ts,
      })
      return {message: result.message}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to list reactions',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and message timestamp']
      )
    }
  }
}
