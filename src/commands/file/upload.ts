import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {resolveChannel} from '../../lib/resolve.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class FileUpload extends BaseCommand {
  static override summary = 'Upload a file to Slack'
  static override flags = {
    channel: Flags.string({description: 'Channel ID or name'}),
    title: Flags.string({description: 'File title'}),
    ...BaseCommand.baseFlags,
  }
  static override examples = [
    'slak file upload --channel C123 --title "My File"',
    'slak file upload --channel #general --title "Report" --json',
  ]
  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(FileUpload)
    const client = await this.getSlakClient()
    const channelId = flags.channel ? await resolveChannel(flags.channel, client) : undefined

    try {
      const result = await client.apiCall('files.upload', {
        channel_id: channelId,
        title: flags.title,
      })
      return {file: result.file}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to upload file', ExitCode.ApiError, String(error), [])
    }
  }
}
