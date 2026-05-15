import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class FileInfo extends BaseCommand {
  static override summary = 'Get file info'
  static override args = {file: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(FileInfo)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('files.info', {file: args.file})
      return {file: result.file}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to get file info', ExitCode.ApiError, String(error), [])
    }
  }
}
