import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'

export default class UserInfo extends BaseCommand {
  static override summary = 'Get info about a Slack user'

  static override args = {
    user: Args.string({required: true, description: 'User ID, email, or name'}),
  }

  static override examples = [
    'slak user info U123',
    'slak user info alice@example.com --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    return {user: {}}
  }
}
