import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'

export default class ChatPost extends BaseCommand {
  static override summary = 'Post a message to a channel'

  static override flags = {
    channel: Flags.string({required: true, description: 'Channel ID or name'}),
    text: Flags.string({required: true, description: 'Message text'}),
    'thread-ts': Flags.string({description: 'Thread timestamp for replies'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak chat post --channel C123 --text "Hello world"',
    'slak chat post --channel #general --text "Hi team"',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    return {ts: '', channel: '', message: {}}
  }
}
