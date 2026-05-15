import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class CanvasRead extends BaseCommand {
  static override summary = 'Read canvas content'
  static override args = {canvas: Args.string({required: true})}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args} = await this.parse(CanvasRead)
    const client = await this.getSlakClient()
    try {
      const result = await client.apiCall('canvases.info', {canvas_id: args.canvas})
      return {canvas: result.canvas}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('Failed to read canvas', ExitCode.ApiError, String(error), [])
    }
  }
}
