---
name: slak-pagination
description: Pagination patterns for slak list commands — cursor-based pagination, default limits, auto-pagination with --all, and timestamp filtering.
metadata:
  type: reference
---

# Pagination Best Practices

## Default Limits per Command

Every list command should support `--limit` with sensible defaults:

| Command | Default Limit | Max Limit | Notes |
|---|---|---|---|
| `channel list` | 100 | 1000 | Slack default is 20, but 100 is better for AI agents |
| `user list` | 100 | 1000 | |
| `file list` | 100 | 1000 | |
| `search messages` | 20 | 100 | Full-text search has lower limit |
| `channel history` | 20 | 1000 | Usually don't want entire history |
| `pins list` | 100 | — | Per-channel pins |
| `reactions list` | 100 | — | Per-message reactions |

**Rule:** Default to 100 (good balance for AI agents and humans). Let users override with `--limit`.

---

## Cursor-Based Pagination

Slack uses **cursor-based pagination** (not offset-based). Every list endpoint returns:

```json
{
  "channels": [...],
  "response_metadata": {
    "result_count": 42,
    "next_cursor": "dXNlcjpVMDEyM0FCQw=="  // Empty string when done
  }
}
```

### Cursor Semantics

- **`next_cursor`** is opaque (treat as a string, don't parse)
- **Empty string** (`""`) means no more results
- **Valid across time?** No — don't cache cursors; results may change between requests
- **Can you generate cursors?** No — must use returned cursors

### Correct Pagination Loop

```typescript
let allChannels: Channel[] = []
let nextCursor = ''

do {
  const resp = await client.conversations.list({
    cursor: nextCursor || undefined,  // omit if empty
    limit: 100,
  })
  
  allChannels.push(...resp.channels || [])
  nextCursor = resp.response_metadata?.next_cursor || ''
  
} while (nextCursor)  // Loop until cursor is empty

return allChannels
```

### ⚠️ Common Mistakes

```typescript
// ✗ WRONG: Trying to generate cursors
for (let i = 0; i < total / limit; i++) {
  const cursor = btoa(`offset:${i}`)  // WRONG! Cursors are opaque
}

// ✗ WRONG: Stopping when response is empty
if (resp.channels.length === 0) break  // WRONG! May hit exact boundary

// ✗ WRONG: Assuming same cursor works next time
const saved = resp.response_metadata.next_cursor
// ... later ...
await client.conversations.list({cursor: saved})  // May fail!
```

---

## The `--limit` Flag

### What `--limit` Does

Returns a **single page** of results (not all results):

```bash
$ slak channel list --limit 10
# Returns up to 10 channels, no pagination

$ slak channel list --limit 10 --cursor 'dXNlcjpV'
# Returns next 10 channels starting from that cursor
```

### What `--limit` Does NOT Do

```bash
# ✗ WRONG: User might think this returns 10 total
$ slak channel list --limit 10 --all

# ✓ CORRECT: --all overrides limit; fetches all with batch size of 10
$ slak channel list --limit 10 --all  # Fetches ALL, 10 at a time
```

### Flag Definition

```typescript
limit: Flags.integer({
  default: 100,
  description: 'Results per page (default: 100, max: 1000)',
  env: 'SLAK_LIMIT',  // Optional env override for agents
})
```

---

## The `--cursor` Flag

Resume pagination from a known point:

```bash
$ slak channel list --limit 10
# Returns 10 channels + next_cursor = 'xyz'

$ slak channel list --limit 10 --cursor 'xyz'
# Returns next 10 channels
```

**Typical usage:**
```bash
first=$(slak channel list --limit 10 --json | jq -r '.next_cursor')
slak channel list --limit 10 --cursor "$first" --json | jq '.channels[].name'
```

### Flag Definition

```typescript
cursor: Flags.string({
  description: 'Pagination cursor from previous response',
})
```

---

## The `--all` Flag

**Auto-iterate all pages** in a single invocation:

```bash
$ slak channel list --all
# Fetches all channels, 100 at a time, until done

$ slak channel list --limit 10 --all
# Fetches all channels, 10 at a time
```

### Implementation with `paginate()` Helper

```typescript
import {paginate} from '../../lib/paginate.js'

async run() {
  const {flags} = await this.parse(MyCommand)
  const client = await this.slakClient
  
  const results: Channel[] = []
  
  for await (const channel of paginate(
    (params) => client.conversations.list(params),
    {types: flags.types},           // API params
    'channels',                       // Result key
    {
      limit: flags.limit,             // Items per page
      all: flags.all,                 // Auto-paginate all?
      cursor: flags.cursor,           // Resume from cursor?
    }
  )) {
    results.push(channel)
  }
  
  this.logJson({channels: results, total: results.length})
}
```

### What `paginate()` Does

1. Calls API method with params
2. Extracts results from specified key (`'channels'`)
3. If `--all` is set, auto-calls next page with `next_cursor`
4. Yields each result to the async iterator
5. Stops when `next_cursor` is empty OR `limit` is reached

### Flag Definition

```typescript
all: Flags.boolean({
  description: 'Fetch all pages (may be slow on large lists)',
})
```

---

## Pagination + Filtering

### Filter in the API Call

Some APIs accept filter params that reduce results:

```bash
$ slak channel list --types public_channel --limit 100
# API filters before pagination — more efficient
```

```typescript
for await (const channel of paginate(
  (params) => client.conversations.list(params),
  {types: 'public_channel'},  // Filter param (applied by API)
  'channels',
  {limit: 100, all: flags.all}
)) {
  // Results are already filtered
}
```

### Filter in the CLI (Post-Pagination)

If the API doesn't support a filter, do it in code:

```typescript
const allChannels: Channel[] = []
for await (const channel of paginate(...)) {
  if (channel.is_archived === false) {  // Filter in code
    allChannels.push(channel)
  }
}
```

**Prefer API-side filters** (more efficient), but CLI filtering works for edge cases.

---

## Timestamp Filtering

Some commands support `--oldest` and `--latest` to filter by message timestamp:

```bash
$ slak channel history C123 --oldest 2026-01-01 --latest 2026-01-31
# Returns messages between those dates
```

### Timestamp Format

Slack uses **epoch seconds** (with optional microseconds):

```typescript
oldest: Flags.string({
  description: 'Start of time range (epoch timestamp or YYYY-MM-DD)',
  parse: (input) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      // Parse date string to epoch
      return Math.floor(new Date(input).getTime() / 1000).toString()
    }
    return input  // Already epoch
  }
})
```

### Examples

```bash
# Using date strings
$ slak channel history C123 --oldest 2026-01-01 --latest 2026-01-31

# Using epoch timestamps
$ slak channel history C123 --oldest 1704067200 --latest 1706745600

# Mixed
$ slak channel history C123 --oldest 2026-01-01 --latest 1706745600
```

---

## Pagination in JSON Output

Every paginated list's JSON should include pagination metadata:

```json
{
  "channels": [
    {id: "C1", name: "general"},
    {id: "C2", name: "random"}
  ],
  "next_cursor": "dXNlcjpV",
  "total": 42
}
```

**Fields:**
- `next_cursor`: Opaque cursor for next page (empty if done)
- `total`: Total count if available from API (otherwise omit)

### Omit cursor when done

```typescript
this.logJson({
  channels: results,
  next_cursor: nextCursor || undefined,  // Omit if empty
  total: results.length
})
```

When `next_cursor` is undefined, AI agents know pagination is complete.

---

## Performance Considerations

### Avoid `--all` for Large Lists

With millions of channels, `--all` becomes slow:

```bash
$ slak channel list --all
# Could take minutes to fetch 10,000 channels
```

**Better patterns:**
```bash
# Fetch first page
slak channel list --limit 100

# Use cursor to resume later
slak channel list --limit 100 --cursor 'dXNlcjpV'

# Or filter to reduce results
slak channel list --types public_channel --all
```

### Pagination Hints in Help

```
EXAMPLES
  # Fetch first page
  $ slak channel list --limit 100

  # Get next page
  $ slak channel list --limit 100 --cursor 'dXNlcjpV'

  # Fetch all (warning: slow on large workspaces)
  $ slak channel list --all --json

  # Better: fetch incrementally and process
  $ cursor=''
  $ while true; do
      resp=$(slak channel list --limit 100 --cursor "$cursor" --json)
      jq '.channels[].name' <<<$resp
      cursor=$(jq -r '.next_cursor' <<<$resp)
      [ -z "$cursor" ] && break
    done
```

### Rate Limits with Pagination

Each page is a separate API call. With rate limits ~1 req/sec:

- 100 channels at --limit 100 = 1 API call
- 10,000 channels at --limit 100 = 100 API calls = ~100 seconds

**Recommendation:** For bulk operations, use `--all` sparingly or add a warning:

```typescript
if (flags.all && !spinner) {
  this.logToStderr(
    chalk.yellow('⚠️  Fetching all results may take a while (1 req/sec rate limit)...')
  )
}
```

---

## Edge Cases

### Empty Results

```json
{
  "channels": [],
  "next_cursor": "",
  "total": 0
}
```

Both `channels` and `next_cursor` can be empty. This is normal (no results).

### Exact Boundary

Slack sometimes returns **exactly** the limit:

```bash
$ slak channel list --limit 100
# Returns exactly 100 channels
# next_cursor: "xyz"  (cursor is NOT empty)
```

This doesn't mean more results exist. Must call next page to confirm:

```bash
$ slak channel list --limit 100 --cursor "xyz"
# Returns 0 channels
# next_cursor: ""  (now we know we're done)
```

**Correct implementation:** Always check for empty `next_cursor`, don't assume based on result count.

### Cursor Expiration

Long-lived cursors can expire. If so:

```json
{
  "ok": false,
  "error": "invalid_cursor"
}
```

Resume from the start (`cursor: ""`) if this happens.

---

*Pagination is critical for scalability. Implement it carefully on every list command.*
