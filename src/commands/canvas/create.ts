import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class CanvasCreate extends BaseCommand {
  static override summary = 'Create a new canvas'
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('canvases.create', {})
      return {canvas: result.canvas}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to create canvas', ExitCode.ApiError, String(error), [])
    }
  }
}
