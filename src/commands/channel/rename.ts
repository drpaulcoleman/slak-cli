import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelRename extends BaseCommand {
  static override summary = 'Rename a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override flags = {
    name: Flags.string({required: true, description: 'New channel name'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel rename C123 --name new-name',
    'slak channel rename #old-name --name team-updates --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(ChannelRename)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(args.channel, client)

    try {
      const result = await client.apiCall('conversations.rename', {
        channel: channelId,
        name: flags.name,
      })
      return {channel: result.channel}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to rename channel',
        ExitCode.ApiError,
        String(error),
        ['Ensure new name is valid and not already in use']
      )
    }
  }
}
