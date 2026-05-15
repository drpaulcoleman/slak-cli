---
name: slak-design-decisions
description: Detailed architectural decisions for slak — command design, pagination, args vs flags, humans vs agents, workspaces, error recovery, schema versioning, API escape hatch.
metadata:
  type: reference
---

# Detailed Design Decisions

## Command vs Flag: When to Create a New Command

### Create a separate command when:

- **Semantically distinct** — `slak channel create` vs `slak channel delete` are opposite operations. Make them separate commands, not `slak channel --create`.
- **Commonly used standalone** — Users should be able to run it without chaining. If you have to explain "run X then Y", it's two commands.
- **Different error handling** — Creating vs deleting have different error paths and recovery strategies.
- **Different arguments** — `slak channel create <name> --topic "x"` is clear. `slak channel --create <name>` mixes modes.

### Add a flag instead when:

- **Modifies behavior of same operation** — `slak user list --exclude-archived` is still listing; `--exclude-archived` refines the result.
- **Mutually exclusive options** — `slak search --in #general --in #random` (multiple values of same flag, not separate commands).
- **Optional refinement** — `slak channel history C123 --limit 50 --oldest 2026-05-01` — all flags refine the core operation (read history).

### Examples

| Scenario | Design | Rationale |
|---|---|---|
| Send vs edit message | Separate `post` and `update` | Different args (post: text, update: ts); different semantics |
| List channels, filtered | Single `list` with `--types`, `--exclude-archived` | Same operation, just refined |
| Pin vs unpin | Separate `add` and `remove` | Opposite operations, different error handling |
| Get one user vs list users | Separate `info` and `list` | Different return types and pagination |
| Filter by date range | Flags `--oldest`, `--latest` on `history` | Refines one operation |

---

## Pagination: When to Include

### Always include pagination when:

- **API returns a list** (channels, users, messages, files, etc.)
- **List could realistically be >100 items** (even if 100 is large in practice)
- **Slack API supports cursor pagination** (most modern endpoints do)

Support three modes:
```typescript
static flags = {
  limit: Flags.integer({default: 100}),      // Results per page
  cursor: Flags.string(),                     // Resume from cursor
  all: Flags.boolean(),                       // Fetch all pages
}
```

### Skip pagination when:

- **Result set is inherently small** (≤20 items: user reminders, channel bookmarks)
- **Slack API doesn't support cursor** (rare; document if true)

Even for small lists, support `--all` for consistency.

---

## Arguments vs Flags: When to Use Each

### Use positional arguments when:

- **Required primary resource ID** — `slak channel history <channel-id>` — channel is the thing being operated on.
- **Naturally comes first** — User thinking: "I want to delete THIS file" → file path comes first.
- **≤2 positional args** — More than 2, users forget order. Switch to flags.

### Use flags for:

- **Optional refinements** — `--limit`, `--oldest`, `--latest` refine a command
- **Configuration** — `--force`, `--no-color`, `--json`
- **Named choices** — `--format json|yaml|csv`
- **Multiple values** — `--types public_channel,private_channel`

### Examples

| Command | Design | Rationale |
|---|---|---|
| `slak channel history C123 --limit 50` | ID as arg, limit as flag | Channel is the resource; limit refines |
| `slak chat post --channel C123 --text "hello"` | Both as flags | No clear "primary" resource |
| `slak file upload ./README.md --channel C123` | File as arg, channel as flag | File is what's being uploaded |
| `slak user info <user-id>` | ID as arg | User ID is what we're querying |
| `slak search messages "from:alice" --limit 10 --in #general` | Query as arg, filters as flags | Query is primary; location/limit refine |

---

## Designing for Both Humans and AI Agents

### Shared principles

Both benefit from:
- **Stable output schemas** — No breaking JSON changes without version bump
- **Helpful errors with suggestions** — Exit codes + JSON + next steps
- **Consistent flag naming** — `--limit`, `--cursor` across commands
- **Comprehensive examples** — Help text shows realistic usage

### Human-specific UX

- **Short flags** (`-l`, `-c`) for common operations
- **Colored output** (spinners, green checkmarks, red errors)
- **Interactive prompts** when reasonable ("Did you mean 'channel list'?")
- **Tab completion** via `@oclif/plugin-autocomplete`
- **Progress indicators** (spinners) for long operations
- **Friendly errors** (no stack traces unless `DEBUG=*`)

### Agent-specific UX

- **Non-interactive by default** — No prompts when stdin isn't TTY
- **Semantic exit codes** — Agents detect error type from exit code
- **JSON error payloads** — Include `suggestions[]` for navigation
- **Env-var configuration** — `SLAK_OUTPUT=json` without flags
- **Deterministic output** — Sorted lists, stable field order
- **Name→ID resolution** — Accept `#general`, not just `C123`

### Handling conflicts

When human UX conflicts with agent UX: **Default to agents.**

Why? Humans can read code/docs to understand a choice. Agents depend on API predictability.

**Examples:**
- **Spell correction** — Prompt to humans (TTY), JSON suggestions to agents (non-TTY). Both get what they need.
- **Spinners** — Output to stderr, never stdout. Humans see spinners; agents parse clean stdout.
- **Output ordering** — Sort in `--json` mode (agent-friendly); human mode can be colorful but unsorted.

---

## Workspace & Multi-Tenancy

### Design questions

1. **Should this command work on all workspaces or just the default?**
   - Most commands: support `--workspace <id|name>` to override
   - Exception: `auth` commands (workspace is implicit)

2. **Should this command error if no default workspace is set?**
   - Yes. Require explicit auth before any data operation.
   - Error: `"No workspace configured. Run 'slak auth login' first."`

3. **Should token scopes be checked upfront?**
   - No, not worth the round-trip. Let the command fail naturally.
   - Slack returns `error: 'missing_scope'` → map to `ExitCode.PermissionError (5)`

### Implementation pattern

```typescript
async run() {
  const {flags} = await this.parse(MyCommand)
  
  // slakClient getter resolves --workspace flag → env → default
  // Throws if none available
  const client = await this.slakClient
  
  // Use client; it's already scoped to the right workspace
}
```

---

## Environment Variable Overrides

Add env-var override for every flag an AI agent might want to set globally.

### Always override:

- `--workspace` → `SLAK_WORKSPACE`
- `--json` → `SLAK_OUTPUT=json`
- `--no-color` → `NO_COLOR=1` (standard)
- `--quiet` → `SLAK_QUIET=1`
- `--timeout` → `SLAK_TIMEOUT=<ms>`

### Optionally override:

- `--limit` → `SLAK_LIMIT` (agents with global page size preference)

### Never override:

- Data-specific flags like `--channel`, `--user`, `--text` (command-specific, not global)

### Implementation

```typescript
static flags = {
  workspace: Flags.string({
    char: 'w',
    env: 'SLAK_WORKSPACE',  // ← env-var override
    description: 'Workspace name or ID',
  }),
}
```

---

## Error Recovery & Retry Patterns

### When to retry automatically (inside CLI)

- **Rate-limit (429)** — SDK auto-retries with exponential backoff. If exhausted: exit with `ExitCode.RateLimited (4)`.
- **Transient network error** (timeout, ECONNRESET) — Retry up to 2x with 1s delay, then fail with `ExitCode.NetworkError (7)`.
- **Slack server error** (500, 502, 503) — Retry up to 2x with exponential backoff, then fail with `ExitCode.ApiError (1)`.

### When to fail fast (require user/agent action)

- **Auth error** (401, invalid_auth) — Fail immediately with `ExitCode.AuthError (2)`. Suggest re-auth.
- **Not found** (404, channel_not_found) — Fail immediately with `ExitCode.NotFound (3)`. Suggest listing.
- **Permission error** (403, missing_scope) — Fail immediately with `ExitCode.PermissionError (5)`. Suggest scope grant.
- **Invalid argument** (invalid_arg) — Fail immediately with `ExitCode.ValidationError (6)`.

### Backoff strategy for retries

```
Attempt 1: immediate
Attempt 2: 100ms + random jitter
Attempt 3: 200ms + random jitter
Give up after 3 attempts
```

---

## API Escape Hatch: When to Use `slak api`

The `slak api` command lets agents call any Slack method directly:

```bash
slak api chat.postMessage --param channel=C123 --param text="hello" --json
slak api admin.users.list --data '{"team_id":"T123","limit":10}' --json
```

### Design principle

Never implement a slak command for a rarely-used Slack method. Use `slak api` as a workaround. Keeps command surface lean while remaining flexible.

### When to implement a named command

- **Frequently used** (`chat.postMessage`, `conversations.list`, `users.info`)
- **Complex parameters** that benefit from flag UI (blocks, rich text)
- **Deep documentation** (examples, related commands, pitfalls)
- **Command-specific error handling** (name→ID resolution, etc.)

### When to punt to `slak api`

- **Niche methods** (`oauth.v2.exchange`, `tooling.tokens.rotate`)
- **Admin-only methods** rarely used outside setup
- **Experimental APIs** that might change

Document `slak api` in main help under DEVELOPER section.

---

## Schema Stability & Versioning

### Breaking changes (require minor version bump: 0.X.0)

- Adding/removing top-level JSON key
- Changing key type (string → number)
- Changing nested object structure
- Reordering keys (sort consistently to avoid)

### Non-breaking changes (patch version: 0.0.X)

- Adding optional key
- Adding to `suggestions[]` in errors
- Adding new command
- Changing human-readable output (not JSON)
- Improving error messages

### Schema documentation

Every command's output must have schema file:

```json
// docs/schemas/channel-list.json
{
  "schema_version": "1.0.0",
  "description": "Output of 'slak channel list --json'",
  "channels": [
    {"id": "C123", "name": "general", "is_archived": false}
  ],
  "next_cursor": ""
}
```

Add snapshot test to prevent schema drift:
```typescript
it('output matches schema', async () => {
  const {stdout} = await runCommand(['channel', 'list', '--json'])
  const result = JSON.parse(stdout)
  expect(result).toMatchSnapshot()
})
```

---

## Subcommand vs Unified Command

Example: Should `slak user` have `list` and `info` as separate commands or unified as one command with optional arg?

### Separate commands (recommended)

```
slak user list      # List all users
slak user info      # Get one user's info
slak user presence  # Check presence
```

When operations are semantically distinct with different return types and pagination.

### Unified command

```
slak user [user-id]  # If user-id given, show one; else list all
```

When the operation is fundamentally the same, just scoped differently.

**Rule of thumb**: One command per Slack API method (or one per "operation type" within a method like filters).

---

*Quick reference: See [index.md](./index.md) for the quick decisions table. For implementation, consult the slack skill files.*
