import {SlakClient} from './client.js'
import {SlakError, ExitCode} from './errors.js'

/**
 * Name→ID resolution with local caching (TTL: 5 minutes).
 * Accepts channel names (#general), user emails (alice@co.com), or IDs directly.
 * Critical for AI agent UX — agents know friendly names, not IDs.
 */

interface CacheEntry<T> {
  value: T
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const channelCache = new Map<string, CacheEntry<string>>()
const userCache = new Map<string, CacheEntry<string>>()

/**
 * Clear all caches (for testing).
 */
export function clearResolveCache(): void {
  channelCache.clear()
  userCache.clear()
}

/**
 * Resolve a channel name or email to channel ID.
 * Accepts: "C123" (ID), "#general" (name), "general" (name without #).
 * Returns channel ID like "C123456789ABC".
 * Throws SlakError if not found.
 */
export async function resolveChannel(
  nameOrId: string,
  client: SlakClient,
): Promise<string> {
  // Already an ID
  if (nameOrId.startsWith('C')) {
    return nameOrId
  }

  // Remove # prefix if present
  const name = nameOrId.startsWith('#') ? nameOrId.slice(1) : nameOrId

  // Check cache first
  const cached = getCached(channelCache, name)
  if (cached) {
    return cached
  }

  // List all channels and find by name
  const response = await client.apiCall<{
    channels: Array<{id: string; name: string}>
  }>('conversations.list', {types: 'public_channel,private_channel'})

  const channels = response.channels || []
  const found = channels.find((ch) => ch.name === name)

  if (!found) {
    throw new SlakError(
      `Channel "${nameOrId}" not found`,
      ExitCode.NotFound,
      'channel_not_found',
      [
        `Run "slak channel list" to see available channels`,
        `Did you mean one of: ${channels.slice(0, 3).map((ch) => `#${ch.name}`).join(', ')}?`,
      ],
    )
  }

  // Cache the result
  setCached(channelCache, name, found.id)
  return found.id
}

/**
 * Resolve a user name or email to user ID.
 * Accepts: "U123" (ID), "alice@co.com" (email), "alice" (name).
 * Returns user ID like "U123456789ABC".
 * Throws SlakError if not found.
 */
export async function resolveUser(
  nameOrEmailOrId: string,
  client: SlakClient,
): Promise<string> {
  // Already an ID
  if (nameOrEmailOrId.startsWith('U')) {
    return nameOrEmailOrId
  }

  // Check cache first
  const cached = getCached(userCache, nameOrEmailOrId)
  if (cached) {
    return cached
  }

  // List all users and find by name or email
  const response = await client.apiCall<{
    members: Array<{id: string; name: string; profile?: {email?: string}}>
  }>('users.list')

  const members = response.members || []
  const found = members.find((user) => {
    const isName = user.name === nameOrEmailOrId
    const isEmail = user.profile?.email === nameOrEmailOrId
    return isName || isEmail
  })

  if (!found) {
    throw new SlakError(
      `User "${nameOrEmailOrId}" not found`,
      ExitCode.NotFound,
      'user_not_found',
      [
        `Run "slak user list" to see available users`,
        `Did you mean one of: ${members.slice(0, 3).map((u) => u.name).join(', ')}?`,
      ],
    )
  }

  // Cache the result
  setCached(userCache, nameOrEmailOrId, found.id)
  return found.id
}

/**
 * Get a value from cache if not expired.
 */
function getCached(cache: Map<string, CacheEntry<string>>, key: string): string | null {
  const entry = cache.get(key)
  if (!entry) {
    return null
  }

  const age = Date.now() - entry.timestamp
  if (age > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }

  return entry.value
}

/**
 * Set a value in cache with timestamp.
 */
function setCached(cache: Map<string, CacheEntry<string>>, key: string, value: string): void {
  cache.set(key, {value, timestamp: Date.now()})
}
