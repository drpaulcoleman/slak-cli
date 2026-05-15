import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class CanvasEdit extends BaseCommand {
  static override summary = 'Edit canvas content'
  static override args = {canvas: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(CanvasEdit)
    const client = await this.getSlakClient()
    try {
      await client.apiCall('canvases.edit', {canvas_id: args.canvas})
      return {ok: true}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to edit canvas', ExitCode.ApiError, String(error), [])
    }
  }
}
