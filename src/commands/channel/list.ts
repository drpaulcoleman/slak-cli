import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakClient} from '../../lib/client.js'
import {paginateAll} from '../../lib/paginate.js'

export default class ChannelList extends BaseCommand {
  static override summary = 'List Slack channels'

  static override description = `
    List all Slack channels in the workspace.
    Supports filtering by type (public, private, direct messages, etc.)
    and excluding archived channels.
  `

  static override examples = [
    'slak channel list',
    'slak channel list --json',
    'slak channel list --types public_channel --exclude-archived',
    'slak channel list --all --json | jq .[].name',
  ]

  static override enableJsonFlag = true

  static override flags = {
    limit: Flags.integer({default: 100, description: 'Max channels per page'}),
    cursor: Flags.string({description: 'Resume from cursor'}),
    all: Flags.boolean({description: 'Fetch all pages'}),
    types: Flags.string({description: 'Comma-separated types: public_channel,private_channel,im,mpim'}),
    'exclude-archived': Flags.boolean({description: 'Exclude archived channels'}),
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ChannelList)
    const client = new SlakClient('') // Token set via env/config in real impl

    const params: Record<string, unknown> = {
      exclude_archived: flags['exclude-archived'],
    }

    if (flags.types) {
      params.types = flags.types
    }

    // Use pagination helper
    const channels = await paginateAll(client, 'conversations.list', params, 'channels', flags.limit)

    if (!this.isJsonMode()) {
      this.log('')
      this.log('CHANNELS')
      for (const ch of channels) {
        this.log(`  ${(ch as any).name.padEnd(20)} (${(ch as any).id})`)
      }
      this.log('')
    }

    return {channels, next_cursor: '', total: channels.length}
  }
}
