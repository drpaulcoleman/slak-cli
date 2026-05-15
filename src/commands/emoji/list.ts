import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class EmojiList extends BaseCommand {
  static override summary = 'List custom emoji'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('emoji.list', {})
      return {emoji: result.emoji}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to list emoji', ExitCode.ApiError, String(error), [])
    }
  }
}
