import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class PinRemove extends BaseCommand {
  static override summary = 'Unpin a message from a channel'

  static override flags = {
    channel: Flags.string({required: true, description: 'Channel ID or name'}),
    ts: Flags.string({required: true, description: 'Message timestamp'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak pin remove --channel C123 --ts 1234567890.123456',
    'slak pin remove --channel #general --ts 1234567890.123456 --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(PinRemove)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)

    try {
      await client.apiCall('pins.remove', {
        channel: channelId,
        timestamp: flags.ts,
      })
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to unpin message',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and message timestamp']
      )
    }
  }
}
