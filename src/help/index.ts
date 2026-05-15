import {Help} from '@oclif/core'

/**
 * Custom Help class for slak CLI.
 * Extends oclif's default Help with slak-specific formatting.
 * Used for context-sensitive help at multiple levels.
 *
 * Future enhancements:
 * - Topic grouping by category (messaging, workspace, admin, etc.)
 * - Example patterns (use with jq, env vars, etc.)
 * - Related commands suggestions
 */
export class SlakHelp extends Help {
  // For now, use oclif's default Help behavior
  // Customizations can be added as the CLI matures
}

