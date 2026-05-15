import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class PinAdd extends BaseCommand {
  static override summary = 'Pin a message in a channel'

  static override flags = {
    channel: Flags.string({required: true, description: 'Channel ID or name'}),
    ts: Flags.string({required: true, description: 'Message timestamp'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak pin add --channel C123 --ts 1234567890.123456',
    'slak pin add --channel #general --ts 1234567890.123456 --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(PinAdd)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)

    try {
      await client.apiCall('pins.add', {
        channel: channelId,
        timestamp: flags.ts,
      })
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to pin message',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and message timestamp']
      )
    }
  }
}
