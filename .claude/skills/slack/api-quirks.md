---
name: slak-api-quirks
description: Slack API quirks, gotchas, and edge cases to handle in slak commands — rate limits, pagination boundaries, Enterprise Grid, user restrictions, token revocation.
metadata:
  type: reference
---

# Slack API Quirks & Gotchas

## Rate Limiting

Slack's Web API enforces **request rate limits** (typically 1 request/sec, burst to 5).

### How the SDK Handles It

The `@slack/web-api` SDK automatically retries rate-limited requests using exponential backoff:

```typescript
const client = new WebClient(token, {
  retryConfig: {
    maxRetryTime: 600_000,  // 10 minutes
    retries: 3,
  }
})
```

**In slak**: The SDK's built-in retry is good enough. If a request is rate-limited after retries exhaust, exit with `ExitCode.RateLimited (4)`.

### Friendly Message

```typescript
if (error.code === 'request_timeout' || error.code === 'rate_limited') {
  throw new SlakError(
    'Hit Slack rate limit. Try again in a few seconds.',
    ExitCode.RateLimited,
    'rate_limited',
    ['Use --limit to fetch fewer items per request', 'Avoid --all on large lists']
  )
}
```

## Pagination Boundaries

### Cursor Semantics

Slack pagination uses **cursor-based** pagination, not offset-based.

- `conversations.list` returns `response_metadata.next_cursor`
- An empty string `""` means end of results
- **Never** assume a cursor is valid across time — users could add/remove channels between requests
- **Always** check for empty cursor to detect end

```typescript
// ✗ WRONG: Assuming we can generate cursors
for (let i = 0; i < total / limit; i++) {
  const cursor = calculateCursor(i)  // DON'T DO THIS
}

// ✓ CORRECT: Use returned cursor
let nextCursor = ''
do {
  const response = await client.conversations.list({cursor: nextCursor})
  // process response.channels
  nextCursor = response.response_metadata?.next_cursor || ''
} while (nextCursor)
```

### Limit Defaults

Each API method has its own default and max:

| Method | Default | Max | Notes |
|---|---|---|---|
| `conversations.list` | 20 | 1000 | |
| `conversations.history` | 20 | 1000 | Newest-first by default |
| `users.list` | 20 | 1000 | |
| `search.messages` | 20 | 100 | Full-text search limit is lower |
| `files.list` | 20 | 1000 | |
| `reactions.list` | 100 | — | Per-message only |
| `pins.list` | 100 | — | Per-channel only |

**In slak**: Use a sensible default (usually 100) and let users override with `--limit`. Respect the API's max.

## Enterprise Grid Restrictions

Some Slack workspaces are part of **Enterprise Grid**, which adds org-level constraints:

- Users may be restricted to certain channels (org policies)
- Some users can't call certain APIs (e.g., `admin.*` is org-admin only)
- Token scopes may be restricted by org policy
- `org_id` field appears in responses

### Handling It

Don't check for Enterprise Grid upfront. Let commands fail naturally:

```typescript
// If user lacks org-level permission, Slack returns:
// {ok: false, error: 'missing_scope', needed: 'admin:something'}

if (error.error === 'missing_scope') {
  throw new SlakError(
    `Your token lacks the required scope: ${error.needed}`,
    ExitCode.PermissionError,
    'missing_scope',
    ['Contact your workspace admin to grant this scope']
  )
}
```

## User-Level Restrictions

Some users can't call certain APIs:

- **Bot users** (`is_bot: true`) can't use `users.setPresence`
- **Deleted users** still appear in lists but with limited data
- **Deactivated users** appear with `deleted: true`
- **Restricted users** (Enterprise Grid) can't access certain channels

### Handling It

Again, let the API fail naturally and propagate the error:

```typescript
const resp = await client.users.setPresence({user: userId, presence: 'active'})
if (!resp.ok) {
  throw new SlakError(
    `Cannot set presence for this user: ${resp.error}`,
    ExitCode.PermissionError,
    resp.error,
    ['Bots cannot set presence', 'Deleted/deactivated users cannot change presence']
  )
}
```

## Message Timestamps (`ts`) Format

Slack uses **epoch seconds with microsecond precision as a string**:

```
"ts": "1234567890.123456"  // seconds.microseconds
```

The SDK returns this as a string, not a number. When parsing/comparing:

```typescript
// ✓ CORRECT: Compare as floats
const ts1 = parseFloat('1234567890.123456')
const ts2 = parseFloat('1234567890.123457')
console.log(ts1 < ts2)  // true

// ✗ WRONG: String comparison doesn't work for timestamps
console.log('1234567890.123456' < '1234567890.123457')  // false! Lexicographic
```

For sorting messages by time:

```typescript
messages.sort((a, b) => parseFloat(a.ts!) - parseFloat(b.ts!))
```

## Threaded Replies (`thread_ts`)

Messages can be **top-level** or **replies to a thread**.

- Top-level message: `thread_ts` is null/undefined
- Thread reply: `thread_ts` is the timestamp of the thread root
- The thread root itself has `reply_count: N` and `thread_ts: null`

### Fetching Thread Replies

Use `conversations.replies` to get all replies in a thread:

```typescript
const replies = await client.conversations.replies({
  channel: channelId,
  ts: threadTs,  // The root message's ts, not the reply
})
// replies.messages includes [root, reply1, reply2, ...]
```

## Channel Types

Slack distinguishes several channel types:

| Type | What it is | Can list? | Notes |
|---|---|---|---|
| `public_channel` | Public channel | Yes (by default) | `#general` etc. |
| `private_channel` | Private channel | Yes | Requires membership |
| `im` | Direct message (1:1) | Yes | With `types: 'im'` |
| `mpim` | Group DM | Yes | Deprecated but still returned |

When listing with `conversations.list`, specify `--types public_channel,private_channel,im` to include all.

```typescript
const channels = await client.conversations.list({
  types: 'public_channel,private_channel,im',
  limit: 100,
})
```

## File Types & Limitations

When uploading files with `files.upload`:

- **Max file size**: 1 GB
- **Allowed types**: Any (no whitelist)
- **Scanning**: Slack may scan for malware
- **Retention**: Depends on workspace plan

### Handling Upload Errors

```typescript
try {
  await client.files.upload({filename, channels: [channelId], file: fs.createReadStream(path)})
} catch (error) {
  if (error.error === 'invalid_arg_name' && error.provided === 'file') {
    throw new SlakError(
      `File upload failed: file too large (max 1 GB)`,
      ExitCode.ValidationError,
      'file_too_large'
    )
  }
}
```

## Presence & DND (Do Not Disturb)

Users have two presence-related statuses:

1. **Presence** (`users.setPresence`): `active` or `away`
   - Auto-reset after 30 min of inactivity
   - Can be set by user or bot with appropriate scope
2. **DND** (`dnd.setSnooze`): "snooze" period with minutes duration
   - Temporarily disables notifications
   - Expires after specified minutes
   - Can set end time or duration

### They're Independent

A user can be:
- `presence: 'away'` and `dnd: off` → appears away but gets notifications
- `presence: 'active'` and `dnd: on` → appears active but notifications are snoozed

## Search Limitations

Full-text search (`search.messages`) has quirks:

- **Index lag**: Results may lag 1-2 seconds behind recent messages
- **Limit cap**: Max 100 results (much lower than list commands)
- **Not all messages**: Some archived/deleted messages don't appear
- **Query syntax**: Specific format (see Slack docs)

### Query Syntax Examples

```
from:@alice                     # Messages from alice
in:#general                     # In #general channel
before:2026-01-01               # Before a date
after:2026-01-01                # After a date
has:reactions                   # Has emoji reactions
has:pin                         # Pinned messages
topic:                          # Topic or purpose
```

## Emoji Handling

Custom workspace emoji are returned by `emoji.list`:

```json
{
  "emoji": {
    "thumbsup": "https://example.slack.com/emoji/thumbsup",
    "custom-emoji": "alias:slack-emoji-name"
  }
}
```

- Standard emoji (😀) are in every workspace
- Custom emoji start with custom prefix or alias
- "Alias" emoji point to other emoji (chains allowed)

When displaying, resolve aliases recursively (up to 5 levels).

## Blocks & Rich Text

Modern Slack messages use **Block Kit** for rich formatting:

```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*bold* _italic_ `code`"
      }
    }
  ]
}
```

Some messages have both `text` (plain) and `blocks` (rich). When displaying:

1. If `blocks` exists, render blocks (more accurate)
2. Otherwise fall back to `text` (plain text)

In JSON output, **always include both** for round-trip compatibility.

## Token Revocation & Scope Loss

Tokens can be revoked or lose scopes at runtime:

- User manually revokes app (Slack settings)
- Workspace admin removes app
- App loses scope through org policy
- Token explicitly rotated (`oauth.v2.access`)

When this happens, the next API call returns:

```json
{ok: false, error: 'invalid_auth'}
// OR
{ok: false, error: 'account_inactive'}
// OR
{ok: false, error: 'missing_scope', needed: 'chat:write'}
```

### Handling Token Loss

Exit immediately with `ExitCode.AuthError (2)` and suggest re-authentication:

```typescript
if (error.error === 'invalid_auth' || error.error === 'account_inactive') {
  throw new SlakError(
    'Your authentication token is no longer valid',
    ExitCode.AuthError,
    'invalid_auth',
    ['Run: slak auth login to re-authenticate']
  )
}
```

## Rate Limits with Concurrent Commands

If a user runs multiple `slak` commands concurrently (in a loop or `&` background), each invocation is a separate request:

```bash
for channel in $(slak channel list --json | jq -r '.channels[].id'); do
  slak channel history "$channel" --limit 1 &
done
wait
```

This fires N concurrent requests, which **will hit rate limits** if N > 5.

**In slak**: Don't try to coordinate across invocations (stateless CLI). Instead, document this in help and suggest using `--all` and piping.

## Empty Results vs Errors

Some APIs return empty lists on "not found" (vs. error):

- `conversations.history` with invalid channel: empty `[]`
- `users.info` with invalid user: explicit error `{ok: false, error: 'user_not_found'}`

Check the Slack API docs per method. If in doubt, test behavior.

---

*These quirks are not bugs — they're features of the Slack API we must accommodate gracefully.*
