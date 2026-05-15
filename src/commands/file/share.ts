import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class FileShare extends BaseCommand {
  static override summary = 'Share a file publicly'
  static override args = {file: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(FileShare)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('files.sharedPublicURL', {file: args.file})
      return {file: result.file}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to share file', ExitCode.ApiError, String(error), [])
    }
  }
}
