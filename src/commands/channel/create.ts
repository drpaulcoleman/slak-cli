import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base-command.js'
import {SlakError, ExitCode} from '../../lib/errors.js'

export default class ChannelCreate extends BaseCommand {
  static override summary = 'Create a new channel'

  static override flags = {
    name: Flags.string({required: true, description: 'Channel name'}),
    'is-private': Flags.boolean({description: 'Create as private channel'}),
    description: Flags.string({description: 'Channel description'}),
    ...BaseCommand.baseFlags,
  }

  static override examples = [
    'slak channel create --name team-chat',
    'slak channel create --name secret --is-private --json',
    'slak channel create --name projects --description "Project planning" --json',
  ]

  static override enableJsonFlag = true

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ChannelCreate)
    const client = await this.getSlakClient()

    try {
      const result = await client.apiCall('conversations.create', {
        name: flags.name,
        is_private: flags['is-private'],
        description: flags.description,
      })
      return {channel: result.channel}
    } catch (error) {
      if (error instanceof SlakError) throw error
      throw new SlakError(
        'Failed to create channel',
        ExitCode.ApiError,
        String(error),
        ['Ensure channel name is valid and not already in use']
      )
    }
  }
}
