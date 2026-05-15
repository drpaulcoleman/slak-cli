import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class CanvasDelete extends BaseCommand {
  static override summary = 'Delete a canvas'
  static override args = {canvas: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(CanvasDelete)
    const client = await this.getSlakClient()
    try {
      await client.apiCall('canvases.delete', {canvas_id: args.canvas})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to delete canvas', ExitCode.ApiError, String(error), [])
    }
  }
}
