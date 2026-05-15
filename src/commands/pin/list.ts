import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {paginate} from '../../lib/paginate.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class PinList extends BaseCommand {
  static override summary = 'List pinned messages in a channel'

  static override flags = {
    channel: Flags.string({required: true, description: 'Channel ID or name'}),
    limit: Flags.integer({default: 100}),
    cursor: Flags.string(),
    all: Flags.boolean(),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak pin list --channel C123',
    'slak pin list --channel #general --json',
    'slak pin list --channel C123 --all --json | jq length',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(PinList)
    const client = await this.getSlakClient()
    const channelId = await resolveChannel(flags.channel, client)
    const items: unknown[] = []

    try {
      for await (const item of paginate(
        client,
        'pins.list',
        {channel: channelId},
        'items',
        {limit: flags.limit, all: flags.all, cursor: flags.cursor}
      )) {
        items.push(item)
      }

      return {items}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to list pinned messages',
        ExitCode.ApiError,
        String(error),
        ['Check channel ID and permissions']
      )
    }
  }
}
