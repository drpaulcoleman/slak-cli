import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'

export default class SearchMessages extends BaseCommand {
  static override summary = 'Search for messages'

  static override args = {
    query: Args.string({required: true, description: 'Search query'}),
  }

  static override flags = {
    in: Flags.string({description: 'Filter by channel'}),
    limit: Flags.integer({default: 20}),
    sort: Flags.string({options: ['relevance', 'timestamp'], default: 'relevance'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak search messages "from:alice" --json',
    'slak search messages "error" --in #general',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(SearchMessages)
    // TODO: Implement search.messages API call
    return {matches: [], total: 0, query: args.query}
  }
}
