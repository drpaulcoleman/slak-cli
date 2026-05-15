import {distance} from 'fastest-levenshtein'

/**
 * Spell correction suggestions using Levenshtein distance.
 * Used by command_not_found hook for "Did you mean...?" prompts.
 */

/**
 * Find command suggestions for a typo.
 * Returns up to 3 suggestions with distance <= 3 characters.
 */
export function findClosestCommands(input: string, allIds: string[]): string[] {
  const suggestions = allIds
    .map((id) => ({id, dist: distance(input.toLowerCase(), id.toLowerCase())}))
    .filter((x) => x.dist <= 3)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((x) => x.id)

  return suggestions
}

/**
 * Find closest string match.
 * Returns the single best match (lowest distance) or undefined if no close match.
 */
export function findClosestMatch(input: string, candidates: string[]): string | undefined {
  if (candidates.length === 0) {
    return undefined
  }

  const best = candidates.reduce((prev, curr) => {
    const prevDist = distance(input.toLowerCase(), prev.toLowerCase())
    const currDist = distance(input.toLowerCase(), curr.toLowerCase())
    return currDist < prevDist ? curr : prev
  })

  const bestDist = distance(input.toLowerCase(), best.toLowerCase())

  // Only suggest if reasonably close (max 3 edits)
  if (bestDist <= 3) {
    return best
  }

  return undefined
}

/**
 * Levenshtein distance between two strings.
 * Returns the number of single-character edits (insertions, deletions, substitutions).
 */
export function levenshteinDistance(a: string, b: string): number {
  return distance(a, b)
}
