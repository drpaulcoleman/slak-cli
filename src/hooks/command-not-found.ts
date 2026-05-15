import {Hook} from '@oclif/core'
import inquirer from 'inquirer'
import {findClosestCommands} from '../lib/suggest.js'
import {isInteractive, logToStderr} from '../lib/output.js'

/**
 * Hook: command_not_found
 * Triggered when user types an unknown command.
 * - For interactive mode (TTY): Shows Y/n prompt for first suggestion
 * - For non-interactive mode (pipes, CI): Shows JSON suggestions and exits
 * Critical for AI agent compatibility — never hangs on prompts.
 */
export const commandNotFound: Hook.CommandNotFound = async function ({id, config}) {
  const allCommandIds = config.getAllCommandIDs()
  const suggestions = findClosestCommands(id, allCommandIds)

  if (suggestions.length === 0) {
    // No close matches
    logToStderr(`Unknown command: "${id}"`)
    logToStderr(`Run "slak --help" for available commands.`)
    process.exit(6) // ValidationError
    return
  }

  // Non-interactive mode (AI agents, pipes, CI/CD)
  if (!isInteractive()) {
    logToStderr(`Unknown command: "${id}"`)
    logToStderr(`Suggestions: ${suggestions.join(', ')}`)
    process.exit(6) // ValidationError
    return
  }

  // Interactive mode: prompt user for first suggestion
  const {confirmed} = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Unknown command "${id}". Did you mean "${suggestions[0]}"?`,
      default: true,
    },
  ])

  if (!confirmed) {
    logToStderr(`Run "slak --help" to see available commands.`)
    process.exit(6) // ValidationError
    return
  }

  // Re-run with corrected command
  await config.runCommand(suggestions[0], process.argv.slice(3))
}
