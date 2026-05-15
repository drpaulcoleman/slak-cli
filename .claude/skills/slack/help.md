---
name: slak-help-system
description: Help system design for slak — custom Help class, context-sensitive drilling, examples, related commands, and spell correction prompts.
metadata:
  type: reference
---

# Help System

## Custom Help Class (`src/help/index.ts`)

Extends oclif's `Help` to provide:
- Grouped topics at root (`slak --help`)
- Command listings per topic (`slak channel --help`)
- Full flag tables with examples per command (`slak channel list --help`)
- Related command suggestions
- Spell correction hook integration

```typescript
import {Help, Topic} from '@oclif/core'
import chalk from 'chalk'

export class SlakHelp extends Help {
  async showRootHelp(): Promise<void> {
    // Banner + grouped topics
  }
  
  async showTopicHelp(topic: Topic): Promise<void> {
    // Topic description + subcommand list
  }
  
  async showCommandHelp(command: Command.Loadable): Promise<void> {
    // Full command help with flags, examples, related commands
  }
}
```

Register in `package.json`:
```json
{
  "oclif": {
    "helpClass": "./dist/help/index.js"
  }
}
```

## Root Help: `slak --help`

```
world-class Slack CLI for humans and AI agents

USAGE
  $ slak [COMMAND] [FLAGS]

COMMANDS
  Messaging
    chat              Send and manage Slack messages
    reaction          Add and remove emoji reactions
    pin               Pin and unpin items in channels
    bookmark          Manage channel bookmarks
    canvas            Read and manage Slack Canvas documents

  Workspace
    channel           List, search, and manage channels and DMs
    user              Look up and manage Slack users
    file              Upload, list, and manage Slack files
    search            Full-text search across messages and files
    reminder          Create and manage reminders
    dnd               Manage Do Not Disturb status
    emoji             List custom workspace emoji

  Team
    team              Get workspace info and audit logs
    usergroup         Manage user groups
    admin             Workspace admin operations

  Developer
    api               Call any Slack API method directly
    auth              Authenticate and manage workspace credentials
    event             Listen to real-time Slack events

GLOBAL FLAGS
  -w, --workspace NAME      Workspace name or ID to use (env: SLAK_WORKSPACE)
  --json                    Output JSON (env: SLAK_OUTPUT=json)
  --no-color                Disable ANSI colors (env: NO_COLOR=1)
  -q, --quiet               Suppress progress indicators
  --compact                 Output compact JSON (no pretty-print)
  --timeout MS              Request timeout in milliseconds (default: 30000)
  -h, --help                Show this help
  -v, --version             Show version

EXAMPLES
  # List all channels in your workspace
  $ slak channel list

  # Search for messages from alice@co.com
  $ slak search messages 'from:alice@co.com' --limit 10

  # Send a message to #general
  $ slak chat post --channel '#general' --text 'Hello team!'

  # For AI agents: fetch user data as JSON for processing
  $ slak user list --json | jq '.users[] | select(.is_bot == false)'

  # Set your status to 'In a meeting' for the next hour
  $ slak user set-presence --state dnd --minutes 60

TOPICS
  help [TOPIC]              Get help on a specific topic
  auth login                Authenticate with Slack
  autocomplete              Install shell completion (bash/zsh)

DOCS
  https://github.com/anthropics/slak
  https://slack.com/api/docs

Created with oclif
```

## Topic Help: `slak channel --help`

```
Manage Slack channels and direct messages

COMMANDS
  channel create        Create a new channel
  channel history       Fetch message history from a channel
  channel info          Get detailed information about a channel
  channel invite        Invite users to a channel
  channel join          Join a channel
  channel kick          Remove a user from a channel
  channel leave         Leave a channel
  channel list          List all channels (with filtering & pagination)
  channel mark          Mark all messages as read
  channel members       List channel members
  channel rename        Rename a channel
  channel replies       Get threaded replies in a channel
  channel topic         Set a channel's topic
  channel purpose       Set a channel's purpose
  channel archive       Archive a channel
  channel unarchive     Unarchive a channel

COMMON FLAGS
  --limit N             Results per page (default: 100)
  --cursor C            Pagination cursor for next page
  --all                 Fetch all pages
  --json                Output JSON

EXAMPLES
  # List public channels only
  $ slak channel list --types public_channel

  # Get the last 50 messages in a channel
  $ slak channel history '#general' --limit 50

  # Fetch all channels with full details
  $ slak channel list --all --json

SEE ALSO
  slak chat              Send and manage messages
  slak search messages   Search for messages in channels
  slak user              Manage users and presence

TIPS
  • Use '#general' or 'C0123ABC' to reference channels
  • Messages are returned newest-first (unless --oldest is specified)
  • The --all flag automatically paginates through all results
```

## Command Help: `slak channel list --help`

```
List all channels in the workspace

SYNOPSIS
  $ slak channel list [FLAGS]
  $ slak channel:list [FLAGS]         (colon syntax also works)

DESCRIPTION
  Fetch a paginated list of channels in the workspace with optional filtering.
  Returns stable JSON when used with --json flag for machine parsing.

FLAGS
  -t, --types TYPE              Filter by type (comma-separated or repeated):
                                  public_channel, private_channel, im, mpim
  --exclude-archived            Exclude archived channels
  -l, --limit N                 Results per page (default: 100)
  -c, --cursor C                Pagination cursor (from previous response)
  --all                         Fetch all pages automatically
  -w, --workspace NAME          Use different workspace
  --json                        Output as JSON (stable schema)
  --no-color                    Disable ANSI colors
  -q, --quiet                   Suppress progress indicators
  -h, --help                    Show this help

OUTPUT
  Human mode (default):
    General        | Type            | Members | Topic
    ─────────────────────────────────────────────────────
    general        | public_channel  | 42      | General discussion
    random         | public_channel  | 38      | Random stuff
    engineering    | private_channel | 12      | Engineering team
    alice-dm       | direct_message  | 2       | —

  JSON mode (--json):
    {
      "channels": [
        {
          "id": "C0123ABC",
          "name": "general",
          "type": "public_channel",
          "is_archived": false,
          "num_members": 42,
          "topic": { "value": "General discussion", "creator": "U789", "last_set": 1234567890 },
          "purpose": { "value": "...", "creator": "U789", "last_set": 1234567890 }
        }
      ],
      "next_cursor": "dXNlcjpV",
      "total": 42
    }

EXAMPLES
  # List all channels
  $ slak channel list

  # List only public channels
  $ slak channel list --types public_channel

  # List channels and filter out archived ones
  $ slak channel list --exclude-archived

  # Pagination: get first 50, then next 50
  $ slak channel list --limit 50
  $ slak channel list --limit 50 --cursor 'dXNlcjpV'

  # For AI agents: fetch all channels as JSON for processing
  $ slak channel list --all --json | jq '.channels[] | select(.is_archived == false) | .name'

  # Use in a loop to process each channel
  $ slak channel list --json | jq -r '.channels[].name' | while read ch; do
      echo "Processing #$ch"
      slak channel history "$ch" --limit 1 --json
    done

RELATED COMMANDS
  slak channel info        Get detailed info for one channel
  slak channel history     Fetch message history
  slak channel create      Create a new channel
  slak search messages     Search for specific messages
  slak user list           List all users

GLOBAL FLAGS
  These flags work with every slak command:

  -w, --workspace NAME      Workspace to use (env: SLAK_WORKSPACE)
  --json                    Machine-readable JSON output
  --no-color                Disable colored output (env: NO_COLOR=1)
  -q, --quiet               Suppress progress spinners and info messages
  --compact                 Output compact (non-pretty) JSON
  --timeout MS              Request timeout in milliseconds (default: 30000)
  -h, --help                Show this help
  -v, --version             Show version

ENVIRONMENT VARIABLES
  SLAK_WORKSPACE            Default workspace to use
  SLAK_OUTPUT=json          Enable --json by default
  NO_COLOR=1                Disable colors (standard)
  SLAK_QUIET=1              Enable --quiet by default
  SLAK_TIMEOUT=30000        Default timeout in ms
  SLACK_BOT_TOKEN           Bot token (overrides workspace auth)
  SLACK_USER_TOKEN          User token (overrides workspace auth)

SCHEMA VERSION
  This command's JSON output follows schema version 1.0.0
  Breaking changes require a version bump
  See: docs/schemas/channel-list.json

SEE ALSO
  https://slack.com/api/conversations.list (underlying Slack API method)
  https://github.com/anthropics/slak/issues (report bugs)

TIPS
  • Results are returned in arbitrary order; sort by name if needed
  • Use --all to fetch all channels at once (may be slow on large workspaces)
  • The --cursor flag is for resuming pagination, not typically typed by hand
  • DMs and group DMs are included in results (type: 'im' and 'mpim')
```

## Help Best Practices

### Every command must have:

1. **SYNOPSIS** — Show command and common flag patterns
   ```
   $ slak channel list [FLAGS]
   $ slak channel:list [FLAGS]
   ```

2. **DESCRIPTION** — 2-3 sentences explaining what the command does
   ```
   Fetch a paginated list of channels in the workspace with optional filtering.
   Returns stable JSON when used with --json flag for machine parsing.
   ```

3. **FLAGS** — Table of all flags with descriptions
   - Grouped: required, common, optional, global
   - Include env var overrides (e.g., `env: SLAK_WORKSPACE`)
   - Show defaults

4. **OUTPUT** — Show both human and JSON formats
   - Human: colored table or formatted text
   - JSON: actual example with all fields

5. **EXAMPLES** — At least 5 examples covering:
   - Basic usage (no flags)
   - Common flags
   - Pagination
   - AI-agent idiom (piped to `jq`)
   - Advanced/less obvious patterns

6. **RELATED COMMANDS** — Suggest similar or complementary commands

7. **GLOBAL FLAGS** — Document inherited flags from BaseCommand

8. **ENVIRONMENT VARIABLES** — Document all env-var overrides

9. **SCHEMA VERSION** — If command outputs JSON, reference its schema file

10. **TIPS** — Common gotchas and best practices

### Writing Examples

Make examples realistic and progressively complex:

```
# Basic: no flags, obvious usage
$ slak channel list

# Common: typical real-world flags
$ slak channel list --types public_channel --limit 50

# Advanced: less obvious but powerful
$ slak channel list --all --json | jq '.channels[] | select(.is_archived == false) | .name'

# AI agent: piped to other tools
$ slak channel history '#general' --limit 10 --json | jq '.messages[0]'

# Tips: edge case or performance hint
$ slak channel list --all  # Warning: may be slow on large workspaces
```

### Spell Correction Prompts (when `!stdin.isTTY`)

Non-interactive fallback (for AI agents):

```
Unknown command "channal". Did you mean: channel, chat?
```

Interactive fallback (for humans):

```
Unknown command "channal". Did you mean "channel"? [Y/n]
```

---

*Help system is the first impression. Every command must have world-class help.*
