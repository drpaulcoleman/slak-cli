import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class CanvasList extends BaseCommand {
  static override summary = 'List canvases'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('canvases.list', {})
      return {canvases: result.canvases}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to list canvases', ExitCode.ApiError, String(error), [])
    }
  }
}
