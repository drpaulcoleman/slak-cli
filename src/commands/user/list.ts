import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'

export default class UserList extends BaseCommand {
  static override summary = 'List Slack users'

  static override description = 'List all users in the workspace with profile information.'

  static override flags = {
    limit: Flags.integer({default: 100}),
    cursor: Flags.string(),
    all: Flags.boolean(),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak user list',
    'slak user list --json | jq .[].name',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    return {users: [], next_cursor: ''}
  }
}
