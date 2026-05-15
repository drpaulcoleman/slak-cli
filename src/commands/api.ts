import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../lib/base-command.js'
import {SlakError, ExitCode} from '../lib/errors.js'

export default class ApiCommand extends BaseCommand {
  static override summary = 'Call any Slack API method'
  static override args = {method: Args.string({required: true, description: 'Slack API method (e.g. chat.postMessage)'})}
  static override flags = {data: Flags.string({description: 'JSON body'}), param: Flags.string({multiple: true, description: 'Key=value param'}), ...BaseCommand.baseFlags}
  static override enableJsonFlag = true
  async run(): Promise<Record<string, unknown>> {
    const {args, flags} = await this.parse(ApiCommand)
    const client = await this.getSlakClient()
    const params: Record<string, unknown> = {}
    if (flags.data) {
      try {
        Object.assign(params, JSON.parse(flags.data))
      } catch {
        throw new SlakError('Invalid JSON in --data', ExitCode.ValidationError, '', [])
      }
    }
    for (const param of flags.param || []) {
      const [key, value] = param.split('=')
      params[key] = value
    }
    try {
      const result = await client.apiCall(args.method, params)
      return result
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError('API call failed', ExitCode.ApiError, String(error), [])
    }
  }
}
