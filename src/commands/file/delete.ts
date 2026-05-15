import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class FileDelete extends BaseCommand {
  static override summary = 'Delete a file'
  static override args = {file: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(FileDelete)
    const client = await this.getSlakClient()
    try {
      await client.apiCall('files.delete', {file: args.file})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to delete file', ExitCode.ApiError, String(error), [])
    }
  }
}
