import {Command, Flags} from '@oclif/core'
import {SlakClient} from './client.js'

/**
 * Base command class for all slak commands.
 * Provides global flags, auth context, output helpers, and JSON mode support.
 */
export abstract class BaseCommand extends Command {
  static override enableJsonFlag = true

  static override baseFlags = {
    workspace: Flags.string({
      char: 'w',
      description: 'Workspace name or ID to use (overrides default)',
      env: 'SLAK_WORKSPACE',
      helpGroup: 'GLOBAL',
    }),
    'no-color': Flags.boolean({
      description: 'Disable ANSI color output',
      env: 'NO_COLOR',
      helpGroup: 'GLOBAL',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress progress indicators and status messages',
      env: 'SLAK_QUIET',
      helpGroup: 'GLOBAL',
    }),
    compact: Flags.boolean({
      description: 'Output compact (non-pretty-printed) JSON',
      env: 'SLAK_COMPACT',
      helpGroup: 'GLOBAL',
    }),
    timeout: Flags.integer({
      description: 'Request timeout in milliseconds',
      default: 30000,
      env: 'SLAK_TIMEOUT',
      helpGroup: 'GLOBAL',
    }),
  }

  /**
   * Check if running in interactive mode (TTY with prompts enabled).
   * Returns false if stdin is not a TTY or SLAK_NON_INTERACTIVE is set.
   * Critical for AI agent compatibility — agents must never hang on prompts.
   */
  isInteractive(): boolean {
    return (
      process.stdin.isTTY === true &&
      !process.env.SLAK_NON_INTERACTIVE
    )
  }

  /**
   * Check if output should be JSON.
   * True if --json flag is passed or SLAK_OUTPUT=json env var is set.
   */
  isJsonMode(): boolean {
    return (
      process.argv.includes('--json') ||
      process.env.SLAK_OUTPUT === 'json'
    )
  }

  /**
   * Check if output should be compact (not pretty-printed).
   */
  isCompactMode(): boolean {
    return process.env.SLAK_COMPACT === '1'
  }

  /**
   * Get the Slack client for the current workspace.
   * Resolves workspace from --workspace flag, env var, or default.
   * Throws if no workspace is configured.
   */
  protected get slakClient(): Promise<SlakClient> {
    // This is a placeholder; full implementation in client.ts
    // Will be called as: const client = await this.slakClient
    return Promise.resolve({} as SlakClient)
  }

  /**
   * Output message to stdout (data).
   * Automatically suppressed in JSON mode.
   */
  override log(message = ''): void {
    if (!this.isJsonMode()) {
      super.log(message)
    }
  }

  /**
   * Output structured JSON to stdout.
   * Uses pretty-printing unless --compact is set.
   */
  logJson(data: unknown): void {
    const indent = this.isCompactMode() ? 0 : 2
    process.stdout.write(JSON.stringify(data, null, indent) + '\n')
  }

  /**
   * Output message to stderr (progress/errors/debug).
   * Always outputs, never suppressed in JSON mode.
   */
  logToStderr(message: string): void {
    process.stderr.write(message + '\n')
  }
}
