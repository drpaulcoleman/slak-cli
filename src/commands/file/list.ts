import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {paginate} from '../../lib/paginate.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class FileList extends BaseCommand {
  static override summary = 'List files'
  static override flags = {channel: Flags.string(), limit: Flags.integer({default: 100}), cursor: Flags.string(), all: Flags.boolean(), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(FileList)
    const client = await this.getSlakClient()
    const files: unknown[] = []
    const params: Record<string, unknown> = {}
    if (flags.channel) params.channel_id = await resolveChannel(flags.channel, client)
    try {
      for await (const file of paginate(client, 'files.list', params, 'files', {limit: flags.limit, all: flags.all, cursor: flags.cursor})) files.push(file)
      return {files}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to list files', ExitCode.ApiError, String(error), [])
    }
  }
}
