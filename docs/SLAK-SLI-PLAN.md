# slak — Project Specification

> **`slak`** is a TypeScript, oclif-based, global npm CLI that provides comprehensive Slack Web API access optimized for AI agent workflows. It is the stateless-CLI equivalent of the official Slack MCP server — same capabilities, none of the per-call context bloat in an LLM session.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [MCP Parity Map](#4-mcp-parity-map)
5. [Command Taxonomy](#5-command-taxonomy)
6. [Authentication Architecture](#6-authentication-architecture)
7. [Help System Specification](#7-help-system-specification)
8. [Spell Correction & Did-You-Mean](#8-spell-correction--did-you-mean)
9. [Output Specification](#9-output-specification)
10. [Error Catalog & Exit Codes](#10-error-catalog--exit-codes)
11. [Global Flags & Environment Variables](#11-global-flags--environment-variables)
12. [Pagination Strategy](#12-pagination-strategy)
13. [The `api` Escape Hatch](#13-the-api-escape-hatch)
14. [Real-Time Events (Socket Mode)](#14-real-time-events-socket-mode)
15. [World-Class CLI Best Practices Checklist](#15-world-class-cli-best-practices-checklist)
16. [Project Structure](#16-project-structure)
17. [Dependencies](#17-dependencies)
18. [Test-Driven Development Workflow](#18-test-driven-development-workflow)
19. [Implementation Roadmap](#19-implementation-roadmap)
20. [Verification & Acceptance](#20-verification--acceptance)
21. [Open Questions & Future Work](#21-open-questions--future-work)

---

## 1. Executive Summary

### What it is
A globally installable npm CLI (`npm i -g slak`) that wraps the entire Slack Web API (~150+ methods across 30+ namespaces) behind a fast, ergonomic, oclif-powered command surface. Both human users and AI coding agents are first-class consumers.

### Why it exists
The official **Slack MCP server** is functional but imposes a hidden tax in agentic AI sessions: every tool result is injected verbatim into the LLM's context window. A 200-message channel history fetched via MCP burns context the model never reclaims. With `slak`:

- The agent invokes `slak channel history C123 --json --limit 50` via the Bash tool.
- The output returns as a tool result the agent can `jq` / `head` / count / summarize before adding anything to context.
- A 50-message history might contribute only a 1-sentence summary to context instead of 200 messages of raw JSON.
- Over a long agent session, this can be the difference between staying within the context budget and degrading model performance.

`slak` also serves humans who want a Slack CLI that doesn't feel like a 2014 bash script — context-sensitive help, spell correction, multi-workspace, structured output, real ergonomics.

### Design north stars
1. **Stateless** — every invocation is independent; no daemons, no persistent connections
2. **Machine-readable first** — `--json` on every command, stable schemas, semantic exit codes
3. **Human-friendly second** — rich help, colored output, spinners, fuzzy command suggestions
4. **Full API surface** — every Slack Web API method reachable, either by a named command or via `slak api`
5. **AI-agent-aware** — non-interactive by default when stdin isn't a TTY, env-var configuration, suggestion-rich errors

---

## 2. Goals & Non-Goals

### Goals
- ✅ Wrap every Slack Web API namespace (chat, conversations, users, files, search, canvases, lists, reactions, pins, bookmarks, reminders, dnd, emoji, team, usergroups, admin, etc.)
- ✅ Support both **standard tokens** (xoxb/xoxp/xapp) and **browser session tokens** (xoxd/xoxc, no Slack app required)
- ✅ Multi-workspace config with per-invocation override
- ✅ Stable, versioned JSON output schemas
- ✅ Context-sensitive help with drill-down (`-h` and `--help` at every level)
- ✅ Spell correction with Y/n prompt (interactive) / suggestions JSON (non-interactive)
- ✅ Both `space-delimited` and `colon-delimited` subcommand syntax
- ✅ Cursor-based pagination with `--all` auto-iteration
- ✅ Name→ID resolution for channels and users
- ✅ Socket Mode event listener (`slak event listen`) for real-time use
- ✅ `slak api` passthrough for any not-yet-wrapped method
- ✅ Test-driven development from day one; ≥90% coverage of `lib/`

### Non-Goals (for v1)
- ❌ Slack RTM (deprecated by Slack; use Socket Mode)
- ❌ Webhook receiver server mode (out of scope — `slak event listen` is enough)
- ❌ GUI / TUI dashboard (CLI-only)
- ❌ Built-in scheduled-job runner (use OS cron + `slak` invocations)
- ❌ Custom DSL or scripting language (compose via shell + jq)

---

## 3. Architecture Overview

```
       ┌────────────────────────────────────────────────────────┐
       │  User: $ slak channel list --json                      │
       │  AI agent: Bash("slak channel list --json --limit 10") │
       └─────────────────────────┬──────────────────────────────┘
                                 │
       ┌─────────────────────────▼──────────────────────────────┐
       │  bin/run.js  →  @oclif/core run()                      │
       └─────────────────────────┬──────────────────────────────┘
                                 │
       ┌─────────────────────────▼──────────────────────────────┐
       │  Hooks: init → preparse → prerun                       │
       │  Help class (custom): SlakHelp                         │
       │  command_not_found: spell-correction hook              │
       └─────────────────────────┬──────────────────────────────┘
                                 │
       ┌─────────────────────────▼──────────────────────────────┐
       │  Command: src/commands/channel/list.ts                 │
       │  - Parses flags (global + command-specific)            │
       │  - Resolves workspace via WorkspaceManager             │
       │  - Calls SlakClient.listChannels()                     │
       └─────────────────────────┬──────────────────────────────┘
                                 │
       ┌─────────────────────────▼──────────────────────────────┐
       │  SlakClient (src/lib/client.ts)                        │
       │  ├── Standard auth → @slack/web-api WebClient          │
       │  └── Browser auth → custom fetch with xoxd/xoxc        │
       │  - Auto retry + exponential backoff (p-retry)          │
       │  - Auto rate-limit handling                            │
       │  - Pagination iterator (lib/paginate.ts)               │
       └─────────────────────────┬──────────────────────────────┘
                                 │
       ┌─────────────────────────▼──────────────────────────────┐
       │  Slack Web API                                         │
       └─────────────────────────┬──────────────────────────────┘
                                 │
       ┌─────────────────────────▼──────────────────────────────┐
       │  Output                                                │
       │  ├── --json: structured JSON to stdout                 │
       │  ├── Default: chalk-formatted human output to stdout   │
       │  └── Progress/errors: stderr (via ora + this.warn)     │
       └────────────────────────────────────────────────────────┘
```

---

## 4. MCP Parity Map

slak achieves and **exceeds** the surface of the official Slack MCP server. Every MCP tool maps to a slak command:

| Slack MCP tool | slak command | Slack API |
|---|---|---|
| `slack_list_channels` | `slak channel list` | `conversations.list` |
| `slack_post_message` | `slak chat post` | `chat.postMessage` |
| `slack_reply_to_thread` | `slak chat post --thread-ts <ts>` | `chat.postMessage` |
| `slack_add_reaction` | `slak reaction add` | `reactions.add` |
| `slack_get_channel_history` | `slak channel history <id>` | `conversations.history` |
| `slack_get_thread_replies` | `slak channel replies <id> <ts>` | `conversations.replies` |
| `slack_get_users` | `slak user list` | `users.list` |
| `slack_get_user_profile` | `slak user info` | `users.info` |
| `slack_search_messages` | `slak search messages` | `search.messages` |

### Why slak is preferable to the MCP server for agents

| Concern | MCP server | slak CLI |
|---|---|---|
| Tool result lands in context? | **Yes — every byte** | Only what the agent chooses to read |
| Filter/slice before context? | No (raw injection) | Yes (`jq`, `head`, `wc`, agent summarization) |
| Persistent connection? | Yes (state-bearing) | No (stateless invocation) |
| Auth scope changes mid-session? | Restart MCP | Just edit `~/.config/slak/` and re-run |
| Compose with other tools? | Limited | Full shell composability |
| Beyond the MCP-defined tools? | Tool author must add | `slak api <method>` covers ANY API call |

---

## 5. Command Taxonomy

`slak` uses `oclif.topicSeparator: " "` so commands read naturally (`slak channel list`). Both `slak channel list` and `slak channel:list` resolve to the same command — oclif normalizes them internally. All tests exercise both forms.

### Topics & commands

#### `slak auth` — Authentication & workspace management
- `slak auth login` — Add a workspace (bot/user/app token or browser tokens)
- `slak auth logout [workspace]` — Remove a workspace
- `slak auth list` — Show configured workspaces
- `slak auth set-default <workspace>` — Set default workspace
- `slak auth test` — Verify current token via `auth.test`
- `slak auth parse-curl` — Extract xoxd/xoxc from DevTools cURL command (stdin)
- `slak auth token` — Print active token (with confirmation) for piping

#### `slak chat` — Messaging
- `slak chat post` — Send a message (text, blocks, attachments, threads, scheduling)
- `slak chat update` — Edit a message
- `slak chat delete` — Delete a message
- `slak chat ephemeral` — Send an ephemeral message (visible only to one user)
- `slak chat schedule` — Schedule a message for future delivery
- `slak chat permalink` — Get a permalink for a message
- `slak chat stream` — Stream text progressively (AI/long-output use)

#### `slak channel` — Channels, DMs, groups (conversations.*)
- `slak channel list` — List channels (filterable by type)
- `slak channel info <id>` — Channel metadata
- `slak channel history <id>` — Message history (paginated)
- `slak channel replies <id> <ts>` — Thread replies
- `slak channel members <id>` — List members
- `slak channel create <name>` — Create a channel
- `slak channel archive <id>` / `unarchive <id>`
- `slak channel join <id>` / `leave <id>`
- `slak channel rename <id> <new-name>`
- `slak channel topic <id> <text>` / `purpose <id> <text>`
- `slak channel invite <id> <user>` / `kick <id> <user>`
- `slak channel mark <id> <ts>` — Set read cursor
- `slak channel unread` — List channels with unread messages

#### `slak user` — Users & presence
- `slak user list` — List workspace users
- `slak user info <id-or-email>` — User profile
- `slak user presence <id>` — Get presence
- `slak user set-presence <auto|away>` — Set own presence
- `slak user profile <id>` — Full profile fields

#### `slak file` — Files
- `slak file upload <path>` — Upload a file (uses `files.uploadV2`)
- `slak file list` — List files (filterable)
- `slak file info <id>` — File metadata
- `slak file delete <id>` — Delete a file
- `slak file share <id> <channel>` — Share to channel

#### `slak search` — Full-text search
- `slak search messages <query>` — Search messages
- `slak search files <query>` — Search files
- `slak search channels <query>` — Search channels (with browser-auth fallback)

#### `slak reaction` — Emoji reactions
- `slak reaction add <channel> <ts> <emoji>` — Add reaction
- `slak reaction remove <channel> <ts> <emoji>` — Remove reaction
- `slak reaction list` — List the user's recent reactions

#### `slak pin` — Pinned items
- `slak pin add <channel> <ts>` — Pin a message
- `slak pin remove <channel> <ts>` — Unpin
- `slak pin list <channel>` — List pinned items

#### `slak bookmark` — Channel bookmarks
- `slak bookmark add <channel> <title> <link>` — Add
- `slak bookmark remove <channel> <id>` — Remove
- `slak bookmark list <channel>` — List
- `slak bookmark edit <channel> <id>` — Edit

#### `slak canvas` — Slack Canvas
- `slak canvas list` — List canvases
- `slak canvas read <id>` — Read as Markdown
- `slak canvas create` — Create a canvas
- `slak canvas edit <id>` — Edit a canvas
- `slak canvas delete <id>` — Delete a canvas

#### `slak reminder` — Reminders
- `slak reminder add <text> <time>` — Create reminder
- `slak reminder complete <id>` — Mark complete
- `slak reminder delete <id>` — Delete
- `slak reminder info <id>` — Get details
- `slak reminder list` — List user's reminders

#### `slak dnd` — Do Not Disturb / snooze
- `slak dnd set <minutes>` — Snooze for N minutes
- `slak dnd end` — End snooze
- `slak dnd info [user]` — Check DND status

#### `slak emoji` — Custom emoji
- `slak emoji list` — List workspace's custom emoji

#### `slak team` — Workspace metadata
- `slak team info` — Workspace info
- `slak team logs` — Access/integration logs (admin)

#### `slak usergroup` — User groups
- `slak usergroup list` — List user groups
- `slak usergroup create <name>` — Create
- `slak usergroup update <id>` — Update
- `slak usergroup enable <id>` / `disable <id>`
- `slak usergroup users <id>` — List members

#### `slak admin` — Admin operations (gated on admin scopes)
- `slak admin users invite|deactivate|list|set-role|set-expiration`
- `slak admin channels list|archive|bulk-delete|set-retention|set-teams`
- `slak admin emoji add|list|rename|remove`
- `slak admin teams list|create|set-icon|set-default-channels`
- `slak admin apps approve|restrict|list-requests|uninstall`

#### `slak event` — Real-time events
- `slak event listen` — Connect to Socket Mode, stream events to stdout as NDJSON

#### `slak api` — Raw API passthrough (escape hatch)
- `slak api <method> [--data JSON] [--param k=v ...]` — Call any Slack API method directly

---

## 6. Authentication Architecture

### Supported token types

| Token | Prefix | Source | Use |
|---|---|---|---|
| Bot token | `xoxb-` | Slack app install | Most commands |
| User token | `xoxp-` | Slack app install w/ user scopes | User-context ops (search, profile, presence) |
| App-level token | `xapp-` | Slack app config | Socket Mode (`slak event listen`) |
| Browser session | `xoxd-` (cookie) + `xoxc-` (token) | DevTools cURL extraction | No Slack app required; full user permissions |

### Storage

**Primary**: OS native keychain via `keytar` (service: `slak`, account: `<workspace-id>:<token-kind>`).

**Fallback** (when keytar unavailable, e.g. headless Linux without libsecret): `~/.config/slak/workspaces.json` with file mode `0o600` and a warning printed to stderr on every command.

**Override**: Environment variables (`SLACK_BOT_TOKEN`, `SLACK_USER_TOKEN`, `SLACK_APP_TOKEN`) take precedence over stored credentials — agents/CI can set these per-invocation without touching config.

### Config schema (`~/.config/slak/workspaces.json`)

```json
{
  "default_workspace": "T01ABCD",
  "workspaces": {
    "T01ABCD": {
      "id": "T01ABCD",
      "name": "Acme Co",
      "url": "https://acme.slack.com",
      "auth_type": "standard",
      "token_kinds": ["bot", "user"],
      "added_at": "2026-05-14T10:00:00Z"
    },
    "T02EFGH": {
      "id": "T02EFGH",
      "name": "Other Team",
      "url": "https://other.slack.com",
      "auth_type": "browser",
      "added_at": "2026-05-14T11:30:00Z"
    }
  }
}
```

Tokens are stored separately in keytar, keyed by `<id>:bot`, `<id>:user`, `<id>:app`, `<id>:xoxd`, `<id>:xoxc`.

### Auth flows

#### Bot/user token (most common)
```bash
slak auth login --token xoxb-abc123... --workspace-name "Acme"
# Calls auth.test to verify; stores in keytar; sets as default if first workspace
```

#### Browser tokens (no Slack app)
```bash
# Method 1: paste curl from DevTools
slak auth parse-curl < curl.txt
# Method 2: interactive
slak auth login --browser
```

#### Multi-workspace usage
```bash
slak channel list                       # uses default workspace
slak channel list --workspace acme      # by name
slak channel list -w T01ABCD            # by ID
SLAK_WORKSPACE=acme slak channel list   # by env
```

---

## 7. Help System Specification

`slak` ships a custom `Help` class (`src/help/index.ts`) extending `@oclif/core`'s `Help`. It produces context-sensitive output at three levels.

### Level 1: `slak --help` (root)

```
slak — Slack CLI for humans and AI agents

USAGE
  $ slak <topic> <command> [args] [flags]

MESSAGING
  chat        Send and manage Slack messages
  channel     List, search, and manage channels and DMs
  reaction    Add/remove emoji reactions
  pin         Pin/unpin items
  bookmark    Manage channel bookmarks
  canvas      Read/manage Slack Canvas documents

WORKSPACE
  user        Look up users and manage presence
  team        Workspace info and logs
  emoji       List custom emoji
  usergroup   Manage user groups
  dnd         Do Not Disturb / snooze
  reminder    Personal reminders

DATA
  file        Upload, list, manage files
  search      Search messages, files, channels
  event       Real-time events (Socket Mode)

ADMIN
  admin       Workspace admin operations

DEVELOPER
  auth        Workspace credentials
  api         Call any Slack API method (escape hatch)

GLOBAL FLAGS
  --json                  Machine-readable JSON output
  --workspace, -w <name>  Override default workspace
  --no-color              Disable ANSI colors (or set NO_COLOR=1)
  --quiet, -q             Suppress progress messages
  --compact               Minified JSON output (with --json)
  --timeout <ms>          Request timeout

LEARN MORE
  $ slak <topic> --help                e.g. slak channel --help
  $ slak <topic> <command> --help      e.g. slak channel list --help
  Docs: https://github.com/.../slak
```

### Level 2: `slak channel --help` (topic)

```
slak channel — List, search, and manage Slack channels and DMs

USAGE
  $ slak channel <command> [args] [flags]

COMMANDS
  list        List channels (filterable by type)
  info        Get channel metadata
  history     Read channel message history
  replies     Read thread replies
  members     List channel members
  create      Create a new channel
  archive     Archive a channel
  unarchive   Unarchive a channel
  join        Join a channel
  leave       Leave a channel
  rename      Rename a channel
  topic       Set channel topic
  purpose     Set channel purpose
  invite      Invite user(s) to channel
  kick        Remove user from channel
  mark        Set read cursor
  unread      List channels with unread messages

TOP EXAMPLES
  List public channels as JSON:
    $ slak channel list --types public_channel --json

  Read last 50 messages from #general:
    $ slak channel history '#general' --limit 50 --json

  Get all replies in a thread:
    $ slak channel replies C123 1234.5678 --all --json

LEARN MORE
  $ slak channel <command> --help     e.g. slak channel list --help
```

### Level 3: `slak channel list --help` (command)

```
slak channel list — List channels in the workspace

USAGE
  $ slak channel list [FLAGS]

DESCRIPTION
  Returns conversations (channels, private channels, DMs, group DMs) the
  authenticated user/bot has access to. Supports cursor-based pagination
  and type filtering. Output is alphabetically sorted by channel name in
  JSON mode for deterministic agent consumption.

FLAGS
  --types <types>          Comma-separated: public_channel,private_channel,mpim,im
                           [default: public_channel,private_channel]
  --exclude-archived       Exclude archived channels [default: false]
  --limit <n>              Results per page [default: 100, max: 999]
  --cursor <cursor>        Pagination cursor for next page
  --all                    Auto-paginate through all pages

GLOBAL FLAGS
  --json                   JSON output
  --workspace, -w <name>   Override default workspace
  --no-color               Disable colors
  --quiet, -q              Suppress progress
  --compact                Compact JSON
  --timeout <ms>           Request timeout [default: 30000]

EXAMPLES
  List all channels as JSON:
    $ slak channel list --json

  Only public channels, auto-paginate everything:
    $ slak channel list --types public_channel --all --json

  Pipe to jq to extract just names:
    $ slak channel list --json | jq -r '.channels[].name'

  AI-agent: get 10 most recently active channels:
    $ slak channel list --limit 10 --json | jq '.channels | sort_by(.updated) | reverse'

  Use a non-default workspace:
    $ slak channel list -w acme --json

  Set workspace via env (handy for AI agents):
    $ SLAK_WORKSPACE=acme slak channel list --json

RELATED COMMANDS
  slak channel info        Get details about one channel
  slak channel history     Read messages from a channel
  slak channel members     List who's in a channel
```

### Implementation

```typescript
// src/help/index.ts
import {Help, Command, Topic} from '@oclif/core'

export class SlakHelp extends Help {
  async showRootHelp(): Promise<void> {
    this.printRootBanner()
    this.printGroupedTopics({
      'MESSAGING':  ['chat', 'channel', 'reaction', 'pin', 'bookmark', 'canvas'],
      'WORKSPACE':  ['user', 'team', 'emoji', 'usergroup', 'dnd', 'reminder'],
      'DATA':       ['file', 'search', 'event'],
      'ADMIN':      ['admin'],
      'DEVELOPER':  ['auth', 'api'],
    })
    this.printGlobalFlags()
    this.printLearnMore()
  }

  async showTopicHelp(topic: Topic): Promise<void> {
    this.printTopicHeader(topic)
    this.printSubCommandTable(topic)
    this.printTopExamples(topic)  // first 3 examples from any command in the topic
    this.printLearnMore()
  }

  async showCommandHelp(command: Command.Loadable): Promise<void> {
    this.printCommandSummary(command)
    this.printUsage(command)
    this.printDescription(command)
    this.printFlags(command, {grouped: ['required', 'optional', 'global']})
    this.printExamples(command)        // requires ≥5
    this.printRelatedCommands(command) // from optional static relatedCommands prop
  }
}
```

---

## 8. Spell Correction & Did-You-Mean

When a user types an unknown command, the `command_not_found` hook fires.

### Algorithm

1. Compute Levenshtein distance from input to every command ID using `fastest-levenshtein`.
2. Take the closest 3 with distance ≤ 3.
3. If zero suggestions → exit with a clean error.
4. Otherwise, branch on TTY status.

### Interactive (TTY stdin, no `--json`)

```
$ slak chanell list
✗ Unknown command "chanell list"

? Did you mean "channel list"? (Y/n) [Y]
✓ Running: slak channel list
[results...]
```

### Non-interactive (AI agent, pipe, `--json`, or `SLAK_NON_INTERACTIVE=1`)

stdout:
```json
{
  "error": "unknown_command",
  "message": "Unknown command 'chanell list'",
  "code": 6,
  "suggestions": ["channel list", "channel info"]
}
```
Exit code: 6 (`ValidationError`).

### Implementation (excerpt)

```typescript
// src/hooks/command-not-found.ts
import {Hook} from '@oclif/core'
import {distance} from 'fastest-levenshtein'

export const commandNotFound: Hook.CommandNotFound = async function({id, config}) {
  const allIds = config.commandIDs                          // includes both : and space forms
  const suggestions = allIds
    .map(cmd => ({cmd, d: distance(id, cmd)}))
    .filter(x => x.d <= 3)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.cmd)

  const nonInteractive =
    !process.stdin.isTTY ||
    process.argv.includes('--json') ||
    process.env.SLAK_NON_INTERACTIVE === '1'

  if (suggestions.length === 0) {
    this.error(`Unknown command: ${id}`, {exit: 6})
  }

  if (nonInteractive) {
    const payload = {error: 'unknown_command', message: `Unknown command '${id}'`, code: 6, suggestions}
    process.stdout.write(JSON.stringify(payload) + '\n')
    this.exit(6)
  }

  // Interactive prompt
  const {default: inquirer} = await import('inquirer')
  const {confirm} = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Did you mean "${suggestions[0]}"?`,
    default: true,
  }])
  if (confirm) {
    await config.runCommand(suggestions[0], process.argv.slice(3))
  } else {
    this.exit(6)
  }
}
```

---

## 9. Output Specification

### Two modes

#### Human mode (default)
- Chalk-colored output
- Tables via `cli-table3`
- Spinners via `ora`, to stderr
- Newline-terminated, designed to be read

#### JSON mode (`--json`)
- Pure JSON to stdout, ending with `\n`
- No ANSI codes, no spinners, no progress
- Errors also emit JSON (to stderr **and** stdout for AI agent convenience), then exit non-zero
- `--compact` removes pretty-printing whitespace (for very large outputs)

### Stream discipline

| Stream | What goes here |
|---|---|
| **stdout** | Only the requested data (formatted or JSON) |
| **stderr** | Spinners, progress messages, warnings, errors (when not in `--json` mode) |
| **exit code** | 0 for success, semantic non-zero for failures (see §10) |

### Canonical JSON schemas

Documented under `docs/schemas/<topic>-<cmd>.json`. Every schema has:
- A `schema_version` field (semver) bumped on breaking changes
- Stable field order (alphabetical within objects)
- Snake_case field names (matching Slack API conventions)
- Null for missing optional fields (never omitted)

Example: `docs/schemas/channel-list.json`
```json
{
  "schema_version": "1.0.0",
  "channels": [
    {
      "id": "string",
      "is_archived": "boolean",
      "is_member": "boolean",
      "is_private": "boolean",
      "name": "string",
      "num_members": "number|null",
      "purpose": "string|null",
      "topic": "string|null",
      "type": "public_channel|private_channel|im|mpim",
      "updated": "number"
    }
  ],
  "next_cursor": "string",
  "total": "number"
}
```

### Determinism

- Lists are **sorted** in JSON mode (e.g., channels by `name`, messages by `ts` ascending)
- Timestamps preserved as Slack's native string format (`"1234567890.123456"`)
- `next_cursor: ""` (empty string) when there's no more data — never `null`, never omitted

---

## 10. Error Catalog & Exit Codes

```typescript
export enum ExitCode {
  Success         = 0,
  ApiError        = 1,  // Slack returned ok=false (generic)
  AuthError       = 2,  // not_authed, invalid_auth, token_revoked, account_inactive
  NotFound        = 3,  // channel_not_found, user_not_found, message_not_found, no_such_subteam
  RateLimited     = 4,  // ratelimited (after retries exhausted)
  PermissionError = 5,  // missing_scope, not_in_channel, restricted_action
  ValidationError = 6,  // invalid args, unknown command, malformed flag value
  NetworkError    = 7,  // DNS, timeout, connection refused
}
```

### Error JSON shape

```json
{
  "error": "channel_not_found",
  "message": "Channel 'C999' not found or not accessible to this token",
  "code": 3,
  "suggestions": [
    "Run 'slak channel list' to see available channels",
    "Check that the token has the right scopes (channels:read, groups:read)"
  ]
}
```

When `--json` is set, this is written to **both** stdout and stderr (so a downstream pipe still gets it), then the process exits non-zero. When `--json` is not set, only a human-formatted error goes to stderr.

### Slack error → exit code mapping

| Slack error code | slak ExitCode |
|---|---|
| `not_authed`, `invalid_auth`, `token_revoked`, `token_expired`, `account_inactive` | `AuthError (2)` |
| `channel_not_found`, `user_not_found`, `message_not_found`, `file_not_found` | `NotFound (3)` |
| `ratelimited` (after retries) | `RateLimited (4)` |
| `missing_scope`, `not_in_channel`, `restricted_action`, `not_authorized` | `PermissionError (5)` |
| `invalid_arg_name`, `invalid_array_arg`, `invalid_charset` | `ValidationError (6)` |
| Any other `ok: false` | `ApiError (1)` |
| Network/timeout | `NetworkError (7)` |

---

## 11. Global Flags & Environment Variables

Every command inherits these via `BaseCommand.baseFlags`:

| Flag | Short | Env var | Default | Effect |
|---|---|---|---|---|
| `--json` |  | `SLAK_OUTPUT=json` |  | Structured JSON output |
| `--workspace` | `-w` | `SLAK_WORKSPACE` | default workspace | Choose workspace |
| `--no-color` |  | `NO_COLOR` |  | Disable ANSI colors |
| `--quiet` | `-q` | `SLAK_QUIET=1` |  | Suppress stderr progress |
| `--compact` |  | `SLAK_COMPACT=1` |  | Minified JSON (use with `--json`) |
| `--timeout` |  | `SLAK_TIMEOUT` | 30000 | Per-request timeout (ms) |
| `--help` | `-h` |  |  | Show help (any command) |
| `--version` | `-v` |  |  | Show version (root only) |

### Token env vars (override stored credentials)

| Env var | Token type |
|---|---|
| `SLACK_BOT_TOKEN` | `xoxb-` |
| `SLACK_USER_TOKEN` | `xoxp-` |
| `SLACK_APP_TOKEN` | `xapp-` |
| `SLACK_XOXD_TOKEN` | Browser cookie |
| `SLACK_XOXC_TOKEN` | Browser API token |

### AI-agent-only env vars

| Env var | Purpose |
|---|---|
| `SLAK_NON_INTERACTIVE=1` | Force non-interactive even if stdin is a TTY |
| `SLAK_OUTPUT=json` | Force `--json` mode for all invocations |
| `SLAK_WORKSPACE=name` | Set default workspace per-invocation |

---

## 12. Pagination Strategy

Every list command supports three modes:

| Mode | Flag | Behavior |
|---|---|---|
| Single page | `--limit N` (default 100) | One round-trip; `next_cursor` returned |
| Resume | `--cursor X` | One round-trip from cursor X |
| Auto-paginate | `--all` | Iterate all pages, accumulate; warn after 10 pages |

### Helper (`src/lib/paginate.ts`)

```typescript
export async function* paginate<T>(
  fetch: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>,
  options: { limit?: number; cursor?: string; all?: boolean }
): AsyncGenerator<T> {
  let cursor = options.cursor
  let pages = 0
  do {
    const {items, nextCursor} = await fetch(cursor)
    for (const item of items) yield item
    cursor = nextCursor
    pages++
    if (!options.all) break
    if (pages === 10 && options.all && process.stderr.isTTY) {
      process.stderr.write('Warning: > 10 pages, this may take a while...\n')
    }
  } while (cursor)
}
```

---

## 13. The `api` Escape Hatch

Any Slack API method, immediately callable:

```bash
# Pass params as flags
slak api chat.postMessage --param channel=C123 --param text="hello"

# Or as JSON body
slak api admin.users.list --data '{"team_id":"T123","limit":10}'

# Combine flags + JSON (flags override JSON keys)
slak api conversations.history --data '{"channel":"C1"}' --param limit=5

# Get raw response
slak api auth.test --json | jq '.team'
```

### Command spec

```typescript
export default class ApiCommand extends BaseCommand {
  static summary = 'Call any Slack API method directly (escape hatch)'
  static description = `Useful for methods not yet wrapped by a named slak command...`
  static args = {
    method: Args.string({required: true, description: 'Slack API method, e.g. chat.postMessage'}),
  }
  static flags = {
    data: Flags.string({description: 'JSON body to send'}),
    param: Flags.string({multiple: true, description: 'Key=value param (repeatable)'}),
    ...BaseCommand.baseFlags,
  }
  static examples = [/* ≥5 examples covering common patterns */]

  async run() {
    const {args, flags} = await this.parse(ApiCommand)
    const params = {...(flags.data ? JSON.parse(flags.data) : {}), ...parseParamFlags(flags.param)}
    const result = await this.slakClient.raw().apiCall(args.method, params)
    return result  // oclif emits as JSON when --json
  }
}
```

---

## 14. Real-Time Events (Socket Mode)

`slak event listen` opens a Socket Mode connection (requires `xapp-` token) and streams events to stdout as **newline-delimited JSON** (NDJSON).

```bash
# Stream all events
slak event listen

# Filter by type
slak event listen --types message,reaction_added

# Pipe into another tool
slak event listen --types message --json | jq 'select(.user == "U123")'
```

Each line is one event object. The agent or downstream consumer reads streamingly. Ctrl+C cleanly closes the WebSocket and exits 0.

---

## 15. World-Class CLI Best Practices Checklist

Borrowed from sf (Salesforce), Heroku, gcloud, claude, and oclif's own conventions:

- ☑ `--help` and `-h` work at every level (root, topic, command)
- ☑ `--version` and `-v` at root
- ☑ Every command has a `summary` (one-liner) and `description` (paragraph)
- ☑ Every command has ≥5 examples in `--help`
- ☑ `--json` on every command for machine-readable output
- ☑ Stable, versioned JSON schemas documented under `docs/schemas/`
- ☑ Semantic exit codes (typed enum, see §10)
- ☑ `--no-color` and `NO_COLOR` env var honored
- ☑ stdout = data, stderr = progress/errors (always)
- ☑ Non-interactive when stdin isn't a TTY (no hanging prompts for AI agents/CI)
- ☑ Spell correction with `did you mean?` Y/n in interactive mode
- ☑ Context-sensitive help drilling (`slak`, `slak <topic>`, `slak <topic> <cmd>`)
- ☑ Both `space` and `colon` subcommand syntax (`slak channel list` = `slak channel:list`)
- ☑ Cursor pagination with `--all` for auto-iteration
- ☑ Name→ID resolution (`#general`, `@alice`, `alice@co.com`)
- ☑ Env-var overrides for every flag (for AI agents and CI)
- ☑ `slak api <method>` escape hatch for any uncovered method
- ☑ XDG-compliant config paths (`~/.config/slak/` on Linux/macOS; `%APPDATA%\slak\` on Windows)
- ☑ Tokens stored in OS keychain (keytar) with `0o600` file fallback
- ☑ Rate-limit retry with exponential backoff (SDK-handled)
- ☑ Tab completion via `@oclif/plugin-autocomplete`
- ☑ Plugin support via `@oclif/plugin-plugins`
- ☑ Self-update via `slak update` (via `@oclif/plugin-update`)
- ☑ Manifest caching (`oclif.manifest.json`) for fast startup
- ☑ Single-binary distribution available via `bun build --compile` (optional)
- ☑ Telemetry: **off by default**; if added later, opt-in only
- ☑ Cross-platform tested (Linux x64, macOS x64/arm64, Windows x64)

---

## 16. Project Structure

```
slak/
├── bin/
│   ├── run.js              # Production entry
│   └── dev.js              # Dev entry (ts-node)
├── src/
│   ├── commands/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── channel/
│   │   ├── user/
│   │   ├── file/
│   │   ├── search/
│   │   ├── reaction/
│   │   ├── pin/
│   │   ├── bookmark/
│   │   ├── canvas/
│   │   ├── reminder/
│   │   ├── dnd/
│   │   ├── emoji/
│   │   ├── team/
│   │   ├── usergroup/
│   │   ├── admin/
│   │   ├── event/
│   │   └── api.ts
│   ├── hooks/
│   │   ├── init.ts
│   │   ├── command-not-found.ts
│   │   └── finally.ts
│   ├── lib/
│   │   ├── base-command.ts
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── workspaces.ts
│   │   ├── curl-parser.ts
│   │   ├── canvas-parser.ts
│   │   ├── output.ts
│   │   ├── paginate.ts
│   │   ├── suggest.ts
│   │   ├── resolve.ts
│   │   ├── errors.ts
│   │   └── theme.ts
│   ├── help/
│   │   └── index.ts
│   └── types/
│       └── index.ts
├── test/
│   ├── commands/           # mirrors src/commands/
│   ├── lib/
│   ├── hooks/
│   ├── help/
│   └── fixtures/
├── docs/
│   ├── SLAK-SLI-PLAN.md    # this file
│   └── schemas/            # per-command JSON schemas
├── .claude/
│   └── skills/
│       └── slack.md        # AI dev governance skill
├── reference/              # read-only references (oclif, slack-cli, slackcli)
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
├── CLAUDE.md
└── README.md
```

---

## 17. Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `@oclif/core` | Framework foundation |
| `@oclif/plugin-help` | Help system (extended) |
| `@oclif/plugin-plugins` | Runtime plugin install |
| `@oclif/plugin-autocomplete` | Tab completion |
| `@oclif/plugin-update` | Self-update |
| `@slack/web-api` | Slack Web API client |
| `@slack/oauth` | OAuth flows |
| `@slack/socket-mode` | Real-time events |
| `fastest-levenshtein` | Spell correction |
| `conf` | XDG-compliant config storage |
| `keytar` | OS keychain access |
| `chalk` | ANSI colors |
| `ora` | Spinners |
| `inquirer` | Interactive prompts |
| `cli-table3` | Tables |
| `mime-types` | File upload helpers |
| `p-retry` | Retry with backoff |

### Dev

| Package | Purpose |
|---|---|
| `@oclif/test` | Command runner for tests |
| `vitest` | Test framework |
| `@vitest/coverage-v8` | Coverage |
| `nock` | HTTP mocking |
| `typescript` | Type system |
| `@types/node` | Node types |
| `eslint-config-oclif` | Lint config |
| `prettier` | Formatter |

---

## 18. Test-Driven Development Workflow

**TDD is non-negotiable** — see `.claude/skills/slack.md` for the binding rules. Summary:

### For every new command

1. Create `test/commands/<topic>/<cmd>.test.ts` — write tests **first**, run them, watch them fail (RED).
2. Create matching fixtures under `test/fixtures/`.
3. Implement `src/commands/<topic>/<cmd>.ts`.
4. Run tests, watch them pass (GREEN).
5. Refactor if needed; tests stay GREEN.

### Required test coverage per command

| Test case | Asserts |
|---|---|
| Happy path | Stdout JSON matches expected shape; exit 0 |
| `--json` output | Schema snapshot matches `docs/schemas/<topic>-<cmd>.json` |
| Auth error | Exits with `ExitCode.AuthError (2)`; error JSON includes Slack code |
| API error | Exits with `ExitCode.ApiError (1)`; error JSON includes Slack code |
| Not-found error | Exits with `ExitCode.NotFound (3)` |
| Pagination single page | `--limit 5` returns at most 5 items + cursor |
| Pagination all | `--all` exhausts pages, mock returns 3 pages |
| Name resolution | `slak chat post --channel "#general"` resolves to channel ID |
| Both syntaxes | `slak channel list` and `slak channel:list` both work |
| Non-interactive | With stdin not a TTY, no prompts appear |

### Test stack

- **Vitest** — fast, ESM-first, native TypeScript
- **@oclif/test** — `runCommand()` helper to invoke commands in-process
- **nock** — HTTP-level mocking for Slack API
- **snapshot tests** — for JSON output stability

### Coverage targets

- `src/lib/` — 90%+ branch coverage
- `src/commands/` — every flag combination tested
- `src/hooks/` — all branches (0, 1, 2+ suggestions; TTY vs non-TTY)

---

## 19. Implementation Roadmap

Implement in this strict order. Each tier is a usable shippable milestone.

### Tier 0 — Foundation (no commands yet)
1. Skill file (`.claude/skills/slack.md`) ✅
2. Project spec (`docs/SLAK-SLI-PLAN.md`) ✅
3. Fetch oclif supplemental docs to `reference/oclif-*.md`
4. `package.json` with oclif config
5. `tsconfig.json`, `vitest.config.ts`, `.eslintrc.json`, `.prettierrc`
6. `CLAUDE.md` (repo-level Claude instructions)
7. `src/lib/errors.ts` + tests
8. `src/lib/output.ts` + tests
9. `src/lib/workspaces.ts` + tests
10. `src/lib/client.ts` + tests
11. `src/lib/paginate.ts` + tests
12. `src/lib/suggest.ts` + tests
13. `src/lib/resolve.ts` + tests
14. `src/lib/base-command.ts` + tests
15. `src/hooks/command-not-found.ts` + tests
16. `src/help/index.ts` + tests
17. `bin/run.js`, `bin/dev.js`

### Tier 1 — Auth (must come before everything else)
1. `slak auth login` (standard token)
2. `slak auth test`
3. `slak auth list`
4. `slak auth logout`
5. `slak auth set-default`

### Tier 2 — MCP Parity
1. `slak channel list`
2. `slak channel history`
3. `slak channel replies`
4. `slak user list`
5. `slak user info`
6. `slak chat post`
7. `slak search messages`
8. `slak reaction add`

**Milestone**: After Tier 2, `slak` matches the official Slack MCP server. Ship as `v0.1.0`.

### Tier 3 — Beyond MCP (priority order)
1. `slak chat update`, `slak chat delete`
2. `slak channel info`, `slak channel members`
3. `slak reaction remove`
4. `slak file upload`, `slak file list`, `slak file info`, `slak file delete`
5. `slak pin add`, `slak pin remove`, `slak pin list`
6. `slak canvas list`, `slak canvas read`
7. `slak user presence`, `slak user set-presence`, `slak user profile`
8. `slak reminder add|complete|delete|list|info`
9. `slak dnd set|end|info`
10. `slak bookmark add|remove|list|edit`
11. `slak search files`, `slak search channels`
12. `slak channel create|archive|unarchive|join|leave|rename|topic|purpose|invite|kick|mark|unread`
13. `slak emoji list`
14. `slak team info`, `slak team logs`
15. `slak usergroup list|create|update|enable|disable|users`
16. `slak chat ephemeral`, `slak chat schedule`, `slak chat permalink`, `slak chat stream`
17. `slak auth parse-curl` (browser tokens)
18. `slak event listen` (Socket Mode)
19. `slak api` (passthrough)
20. `slak admin *` (gated subcommands)

**Milestone**: After Tier 3, ship as `v1.0.0`.

### Tier 4 — Extras
- Tab completion via `@oclif/plugin-autocomplete`
- Self-update via `@oclif/plugin-update`
- Homebrew formula
- Single-binary distribution
- Telemetry (opt-in only)

---

## 20. Verification & Acceptance

### Smoke tests (run after Tier 2)

```bash
# Help
slak --help | grep -q MESSAGING
slak channel --help | grep -q "List channels"
slak channel list --help | grep -q EXAMPLES

# Spell correction
echo "" | slak chanell list 2>&1 | grep -q "Did you mean"

# Auth (requires SLACK_BOT_TOKEN env)
slak auth login --token "$SLACK_BOT_TOKEN" --workspace-name test
slak auth test --json | jq -e '.ok == true'

# Core commands
slak channel list --json | jq -e '.channels | length > 0'
slak channel list --json | jq -e '.channels[].name' | head -5
slak user list --limit 10 --json | jq -e '.users | length <= 10'

# Pagination
slak channel list --limit 5 --json | jq -e '.next_cursor != ""'
slak channel list --all --json | jq -e '.next_cursor == ""'

# AI-agent idiom
SLAK_OUTPUT=json slak channel list | jq -e '.channels'

# Both syntaxes
slak channel list --json | jq -e '.channels'
slak channel:list --json | jq -e '.channels'

# Exit codes
slak channel info NOTAREALCHANNEL --json; test $? -eq 3

# Escape hatch
slak api auth.test --json | jq -e '.ok'
```

### TDD acceptance

```bash
npm run type-check    # 0 errors
npm test              # all green
npm run test:coverage # ≥90% on src/lib/
npm run lint          # 0 warnings
```

### Release acceptance (Tier 2 milestone)

- [ ] All commands in Tier 0+1+2 implemented
- [ ] Each command has ≥6 tests (happy, json, auth, api, not-found, pagination)
- [ ] `docs/schemas/` has a JSON schema for every command
- [ ] `slak --help` renders the grouped topic layout
- [ ] `slak <topic> --help` renders sub-command tables
- [ ] `slak <topic> <cmd> --help` renders the full command page with ≥5 examples
- [ ] Spell correction works in both interactive and non-interactive modes
- [ ] Multi-workspace switching via flag, env, and config-default all work
- [ ] CI green on Linux, macOS, Windows
- [ ] Published to npm as `slak@0.1.0`

---

## 21. Open Questions & Future Work

### To resolve during implementation
- Is `keytar` reliable enough on Windows? If not, fall back to `0o600` file with a stderr warning every command.
- Does the Slack SDK's auto-retry logic suffice, or do we need a custom retry wrapper with our own logging?
- Should `--json` errors go to stdout, stderr, or both? Current plan: both (best for downstream pipes that swallow stderr).
- For commands that don't naturally produce data (e.g., `slak chat delete`), what's the success JSON shape? Plan: `{ok: true, deleted_ts: "..."}`.

### Future enhancements
- A `slak watch` subcommand that polls a channel and emits NDJSON when new messages arrive (useful for AI-driven monitoring)
- A `slak bulk` subcommand for batch operations from a TSV/CSV file
- A plugin (`slak-plugin-llm`) that calls Claude/GPT on slack content via slak's data
- Slack Connect / external-team support deepening
- Workflow Builder integration once Slack stabilizes that API

---

*This spec is binding for the slak project. Changes require a PR amending this file. AI agents working in this repo MUST consult `.claude/skills/slack.md` for governance rules; humans MUST read this file before contributing.*
