---
name: slak-code-conventions
description: Code structure, command patterns, output discipline, error handling, name resolution, and pagination conventions for slak development.
metadata:
  type: reference
---

# Code Conventions

## Command Structure

### All commands extend `BaseCommand`

```typescript
import {BaseCommand} from '../../lib/base-command.js'
import {Args, Flags} from '@oclif/core'
import {ExitCode} from '../../lib/errors.js'

export default class ChannelListCommand extends BaseCommand {
  static override summary = 'List all channels'
  static override description = 'Fetch a list of channels in the workspace with optional filtering and pagination.'
  
  static override enableJsonFlag = true  // MANDATORY
  
  static override args = {
    // Rare: positional args only for primary resource IDs
  }
  
  static override flags = {
    types: Flags.string({
      multiple: true,
      description: 'Channel types to include (public_channel, private_channel, im, mpim)',
    }),
    limit: Flags.integer({
      default: 100,
      description: 'Results per page',
    }),
    cursor: Flags.string({
      description: 'Pagination cursor for next page',
    }),
    all: Flags.boolean({
      description: 'Fetch all pages',
    }),
    ...BaseCommand.baseFlags,
  }
  
  async run(): Promise<void> {
    const {flags} = await this.parse(ChannelListCommand)
    
    try {
      const client = await this.slakClient
      // Implementation here
    } catch (error) {
      this.handleError(error)
    }
  }
  
  private handleError(error: unknown): void {
    if (error instanceof SlakError) {
      this.logJson({error: error.slackError, message: error.message, code: error.exitCode, suggestions: error.suggestions})
      this.exit(error.exitCode)
    }
    // ... other error handling
  }
}
```

### Mandatory features on every command

1. `static enableJsonFlag = true` — `--json` must work
2. `static summary` — One-liner for help/topic listing
3. `static description` — Full description shown in `--help`
4. `static args` — Document positional args (often empty)
5. `static flags` — All command flags with descriptions
6. `static examples` — At least 5 examples for help drilling
7. Extend `BaseCommand`, not raw `Command`
8. Always include `...BaseCommand.baseFlags` in static flags
9. Inherit `slakClient` getter from BaseCommand

### Inherit global flags from BaseCommand

Never redefine `--json`, `--workspace`, `--no-color`, `--quiet`, etc. They come from `BaseCommand.baseFlags`.

## Output Discipline

### The Rule

**stdout = data only. stderr = everything else.**

- `this.log(text)` → stdout in human mode, omitted in JSON
- `this.logJson(obj)` → stdout as valid JSON (helper from BaseCommand)
- `this.logToStderr(msg)` → stderr unconditionally (warnings, errors, progress)
- `progress(msg)` → stderr spinner (only if TTY and not `--json`)

### Example: Channel list with progress

```typescript
async run() {
  const {flags} = await this.parse(ChannelListCommand)
  const client = await this.slakClient
  
  let spinner: Ora | undefined
  
  if (isInteractive() && !flags.json) {
    spinner = ora({text: 'Fetching channels...', stream: process.stderr}).start()
  }
  
  try {
    const channels: Channel[] = []
    
    for await (const channel of paginate(
      (params) => client.conversations.list(params),
      {types: flags.types},
      'channels',
      {limit: flags.limit, all: flags.all, cursor: flags.cursor}
    )) {
      channels.push(channel)
    }
    
    if (spinner) spinner.succeed(`Fetched ${channels.length} channels`)
    
    // Always output result (humans see formatted, agents see JSON)
    if (flags.json) {
      this.logJson({channels, next_cursor: '', total: channels.length})
    } else {
      this.log(formatChannelsTable(channels))
    }
  } catch (error) {
    if (spinner) spinner.fail()
    this.handleError(error)
  }
}
```

### Why this matters

- Humans get friendly output (colored, spinners, tables) to stderr + formatted data to stdout
- AI agents invoke with `--json` or `SLAK_OUTPUT=json`, get pure JSON to stdout, can pipe to `jq`
- Machines parsing stdout never see progress noise

## Error Handling

### Use `SlakError` with typed exit codes

```typescript
import {SlakError, ExitCode} from '../../lib/errors.js'

// Bad:
if (!channel) {
  this.error('Channel not found')  // Wrong: console.error, no exit code semantics
  process.exit(1)
}

// Good:
if (!channel) {
  throw new SlakError(
    'Channel C999 not found or you lack access',
    ExitCode.NotFound,
    'channel_not_found',
    [`Try: slak channel list to see available channels`]
  )
}
```

### Error JSON structure (always same schema)

```json
{
  "error": "channel_not_found",
  "message": "Channel C999 not found or you lack access",
  "code": 3,
  "suggestions": ["Try: slak channel list to see available channels"]
}
```

Written to:
- stdout if `--json` flag is active (agents parse stdout)
- stderr if human mode (doesn't pollute piped data)

Exit code is always non-zero; agents check `echo $?`.

### Error exit codes (from `ExitCode` enum)

| Code | Name | When to use |
|------|------|---|
| 0 | Success | Command completed successfully |
| 1 | ApiError | Slack API returned error (generic) |
| 2 | AuthError | Authentication failed (invalid token, revoked, missing scope) |
| 3 | NotFound | Resource doesn't exist (channel, user, message) |
| 4 | RateLimited | Hit Slack rate limit (after retries exhausted) |
| 5 | PermissionError | Missing required scope or insufficient permissions |
| 6 | ValidationError | Invalid input (bad flag value, missing required arg) |
| 7 | NetworkError | Network failure (timeout, ECONNRESET, DNS) |

Always exit with one of these. Never bare `process.exit()`.

## Name→ID Resolution

### Pattern: Accept both names and IDs

Users know channel names (`#general`) and email addresses (`alice@co.com`), not always IDs.

```typescript
import {resolveChannel, resolveUser} from '../../lib/resolve.js'

// In command run():
const channelId = await resolveChannel(flags.channel, client)  // Accepts 'C123' or '#general'
const userId = await resolveUser(flags.user, client)           // Accepts 'U456' or 'alice@co.com'
```

### Resolution order

**Channels:**
1. If already ID format (`C*`), use it
2. If name format (`#general`), lookup via `conversations.list` + cache
3. If bare name (`general`), same as above
4. If not found, throw `SlakError(..., ExitCode.NotFound, 'channel_not_found')`

**Users:**
1. If already ID format (`U*`), use it
2. If email format (`alice@co.com`), lookup via `users.lookupByEmail`
3. If name format (`alice`), lookup via `users.list` + filter
4. If not found, throw error

### Caching

Resolved names are cached in-memory with 5-minute TTL to avoid repeated API calls during pagination.

## Pagination

[[pagination]]

### Pattern: Use `paginate<T>()` helper

```typescript
import {paginate} from '../../lib/paginate.js'

async run() {
  const {flags} = await this.parse(MyCommand)
  const client = await this.slakClient
  
  const results: Item[] = []
  
  for await (const item of paginate(
    (params) => client.conversations.list(params),  // API method
    {types: flags.types},                            // params
    'channels',                                       // result key
    {limit: flags.limit, all: flags.all, cursor: flags.cursor}  // pagination options
  )) {
    results.push(item)
  }
  
  this.logJson({items: results, total: results.length})
}
```

**Options:**
- `limit` (default 100): Results per page
- `all` (default false): Auto-iterate all pages
- `cursor` (default undefined): Start from specific cursor

### What `paginate()` does

1. Calls the API method with the params + pagination params
2. Extracts results from the specified key
3. If `--all` is set, auto-calls next page with `next_cursor`
4. Yields each result to the async iterator
5. Stops when cursor is empty or `limit` is reached

## Flags: Required vs Optional

### Required flags (bare `.string()` with no default)

```typescript
channel: Flags.string({
  required: true,
  description: 'Channel name or ID'
})
```

Used when: The command can't operate without this parameter.

### Optional flags (with default)

```typescript
limit: Flags.integer({
  default: 100,
  description: 'Results per page'
})
```

Used when: The command has sensible behavior without it.

### Boolean flags

```typescript
all: Flags.boolean({
  description: 'Fetch all pages'
})
```

No `default` needed; `false` if omitted.

## Message Formatting

### Slack message blocks vs plain text

If sending messages (`slak chat post`), support both:

```typescript
// Plain text (simple case)
--text "hello world"

// Rich blocks (advanced case)
--blocks '[{"type":"section","text":{"type":"mrkdwn","text":"*bold* _italic_"}}]'
```

In JSON output, always include both `text` and `blocks` for round-trip compatibility.

## Token Safety

Tokens **never** appear in:
- Log output
- Error messages
- JSON output
- Help text or examples
- Test fixtures

Acceptable patterns:

```typescript
// Good: Placeholder in examples
slak chat post --token '$SLACK_BOT_TOKEN' --channel C123 --text "hello"

// Good: Env var acceptance (logs the env var name, not value)
const token = process.env.SLACK_BOT_TOKEN

// Bad: Logging the token
console.log(`Using token: ${token}`)  // NO!

// Bad: Token in error message
throw new Error(`Token ${token} is invalid`)  // NO!
```

---

*All slak code must follow these conventions. They ensure human usability, AI agent compatibility, and team consistency.*
