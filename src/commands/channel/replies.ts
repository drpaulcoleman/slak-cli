import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'

export default class ChannelReplies extends BaseCommand {
  static override summary = 'Get replies in a thread'

  static override args = {
    channel: Args.string({required: true}),
    ts: Args.string({required: true, description: 'Thread timestamp'}),
  }

  static override flags = {
    limit: Flags.integer({default: 100}),
    cursor: Flags.string(),
    all: Flags.boolean(),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel replies C123 1234567890.000100 --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    return {messages: [], has_more: false, next_cursor: ''}
  }
}
