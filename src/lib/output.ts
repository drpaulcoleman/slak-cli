/**
 * Output helpers for slak CLI.
 * Critical discipline: ALL data to stdout, ALL progress/errors/debug to stderr.
 * This separation is essential for AI agents that pipe stdout to jq and need clean JSON.
 */

/**
 * Output JSON to stdout (data).
 * Pretty-prints by default unless compact=true.
 * Never write to stderr.
 */
export function printJson(data: unknown, compact = false): void {
  const indent = compact ? 0 : 2
  process.stdout.write(JSON.stringify(data, null, indent) + '\n')
}

/**
 * Output formatted table to stdout (data).
 * Each row is an object, columns specify which keys to display.
 */
export function printTable(
  rows: Array<Record<string, unknown>>,
  columns: string[],
): void {
  if (rows.length === 0) {
    return
  }

  // Simple TSV-style table output (respects NO_COLOR)
  const header = columns.join('\t')
  const lines = [header]

  for (const row of rows) {
    const values = columns.map((col) => {
      const val = row[col]
      return val === null || val === undefined ? '' : String(val)
    })
    lines.push(values.join('\t'))
  }

  const output = lines.join('\n') + '\n'
  process.stdout.write(output)
}

/**
 * Output progress/status message to stderr (never stdout).
 * Shows spinner when running interactively; silent otherwise.
 */
export function progress(message?: string): void {
  if (isJsonMode() || isQuiet()) {
    return
  }

  if (message) {
    logToStderr(message)
  }

  if (isInteractive()) {
    // Spinner would go here (ora integration)
    // For now, just suppress in non-TTY mode
    return
  }
}

/**
 * Output message to stderr (errors, warnings, debug).
 * Always outputs, never suppressed in JSON mode.
 */
export function logToStderr(message: string): void {
  process.stderr.write(message + '\n')
}

/**
 * Check if running in JSON output mode.
 */
export function isJsonMode(): boolean {
  return (
    process.argv.includes('--json') ||
    process.env.SLAK_OUTPUT === 'json'
  )
}

/**
 * Check if running in compact (non-pretty-printed) JSON mode.
 */
export function isCompactMode(): boolean {
  return process.env.SLAK_COMPACT === '1'
}

/**
 * Check if quiet mode is enabled (suppress progress).
 */
export function isQuiet(): boolean {
  return (
    process.env.SLAK_QUIET === '1' ||
    process.argv.includes('--quiet') ||
    process.argv.includes('-q')
  )
}

/**
 * Check if running in interactive mode (TTY with prompts allowed).
 * Returns false if stdin is not a TTY or SLAK_NON_INTERACTIVE is set.
 */
export function isInteractive(): boolean {
  return (
    process.stdin.isTTY === true &&
    !process.env.SLAK_NON_INTERACTIVE
  )
}

/**
 * Check if NO_COLOR env var is set (standard UNIX convention).
 */
export function isNoColor(): boolean {
  return process.env.NO_COLOR === '1' || process.env.NO_COLOR === 'true'
}

/**
 * Truncate a string to max length, adding ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength - 3) + '...'
}

