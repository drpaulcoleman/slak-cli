import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'

export default class ChannelHistory extends BaseCommand {
  static override summary = 'Get message history from a channel'

  static override args = {
    channel: Args.string({required: true, description: 'Channel ID or name'}),
  }

  static override flags = {
    limit: Flags.integer({default: 100}),
    cursor: Flags.string(),
    all: Flags.boolean(),
    oldest: Flags.string({description: 'Timestamp to get messages after'}),
    latest: Flags.string({description: 'Timestamp to get messages before'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel history C123 --json',
    'slak channel history #general --limit 50',
    'slak channel history C123 --oldest 1234567890 --json | jq .[].text',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    await this.parse(ChannelHistory)
    return {messages: [], has_more: false, next_cursor: ''}
  }
}
