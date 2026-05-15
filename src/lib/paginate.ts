import {SlakClient} from './client.js'

/**
 * Cursor-based pagination helper for Slack API list operations.
 * Returns an async iterator that yields items, automatically handling pagination.
 *
 * Usage:
 *   for await (const channel of paginate(client, 'conversations.list', {}, 'channels')) {
 *     console.log(channel.name)
 *   }
 */

export interface PaginationOptions {
  limit?: number // Page size (default: 100)
  cursor?: string // Resume from cursor
  all?: boolean // Fetch all pages (default: false)
}

export interface PaginatedResponse {
  response_metadata?: {
    next_cursor?: string
  }
}

/**
 * Paginate through Slack API results.
 * Yields individual items from the result list, handling cursor pagination.
 *
 * @param client - SlakClient instance
 * @param method - Slack API method name (e.g. 'conversations.list')
 * @param params - Base parameters for the API call
 * @param itemKey - Key in response containing the items array (e.g. 'channels', 'members')
 * @param options - Pagination options (limit, cursor, all)
 */
export async function* paginate<T>(
  client: SlakClient,
  method: string,
  params: Record<string, unknown>,
  itemKey: string,
  options: PaginationOptions = {},
): AsyncGenerator<T> {
  const limit = options.limit ?? 100
  const fetchAll = options.all ?? false
  let cursor = options.cursor

  let hasMore = true

  while (hasMore) {
    const callParams: Record<string, unknown> = {...params, limit}
    if (cursor) {
      callParams.cursor = cursor
    }

    const response = await client.apiCall<Record<string, unknown>>(method, callParams)

    const items = (response[itemKey] as T[]) || []

    for (const item of items) {
      yield item
    }

    // Check for next page
    const metadata = response.response_metadata as {next_cursor?: string} | undefined
    cursor = metadata?.next_cursor
    hasMore = fetchAll && !!cursor

    // If not fetching all, stop after first page
    if (!fetchAll) {
      break
    }
  }
}

/**
 * Fetch all results from a paginated endpoint.
 * Convenience wrapper around paginate() for when you want all items at once.
 *
 * @returns Array of all items
 */
export async function paginateAll<T>(
  client: SlakClient,
  method: string,
  params: Record<string, unknown>,
  itemKey: string,
  limit = 100,
): Promise<Array<T>> {
  const results: Array<T> = []

  for await (const item of paginate<T>(client, method, params, itemKey, {limit, all: true})) {
    results.push(item)
  }

  return results
}
