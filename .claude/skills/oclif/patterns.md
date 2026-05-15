---
name: oclif-patterns
description: Common oclif implementation patterns — extending commands, base classes, error handling, JSON mode, pagination, custom help.
metadata:
  type: reference
---

# Common oclif Patterns & Idioms

## Pattern 1: Basic Command Extension

```typescript
import {Command, Flags, Args} from '@oclif/core'

export default class Hello extends Command {
  static summary = 'Greet someone'
  static description = 'Greet a person by name, or the world if no name is provided'
  
  static examples = [
    '<%= config.bin %> hello',
    '<%= config.bin %> hello --name Alice',
    '<%= config.bin %> hello Alice',
  ]
  
  static flags = {
    name: Flags.string({char: 'n', description: 'Person to greet'}),
  }
  
  static args = {
    name: Args.string({required: false, description: 'Name (optional)'}),
  }
  
  async run(): Promise<void> {
    const {args, flags} = await this.parse(Hello)
    const target = flags.name || args.name || 'World'
    this.log(`Hello ${target}!`)
  }
}
```

**Key points:**
- `static summary` is one-liner for help listings
- `static description` is multi-paragraph for full help
- `static examples` show realistic usage patterns
- `<%= config.bin %>` is replaced with CLI name (`slak`)
- Flags and args are parsed together, not sequentially

---

## Pattern 2: Custom Base Command (Shared Flags & Methods)

slak uses this pattern. All commands extend `BaseCommand` to inherit global flags:

```typescript
import {Command, Flags} from '@oclif/core'

export abstract class BaseCommand extends Command {
  static enableJsonFlag = true  // All commands support --json
  
  static baseFlags = {
    workspace: Flags.string({
      char: 'w',
      description: 'Workspace name or ID',
      env: 'SLAK_WORKSPACE',
    }),
    'no-color': Flags.boolean({
      description: 'Disable ANSI colors',
      env: 'NO_COLOR',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress progress indicators',
    }),
  }
  
  // Custom helper: gets active workspace
  protected get slakClient() {
    // Resolve workspace from flag → env → default
    // Return configured WebClient
  }
  
  // Custom helper: suppress output if --quiet
  protected log(msg: string): void {
    const flags = (this as any).flags as Record<string, unknown>
    if (!flags?.quiet) {
      super.log(msg)
    }
  }
}

// Concrete command:
export default class ListChannels extends BaseCommand {
  static summary = 'List channels'
  static description = '...'
  
  static flags = {
    limit: Flags.integer({default: 100}),
    ...BaseCommand.baseFlags,  // Inherit global flags
  }
  
  async run(): Promise<void> {
    const {flags} = await this.parse(ListChannels)
    const client = await this.slakClient  // Uses --workspace flag
    
    this.log('Done')  // Respects --quiet
  }
}
```

**Key points:**
- All commands extend `BaseCommand`, not raw `Command`
- Spread `...BaseCommand.baseFlags` in each command's flags
- Custom helpers (getters, methods) on `BaseCommand` are inherited
- Flags defined once, inherited everywhere

---

## Pattern 3: Error Handling with Suggestions

```typescript
import {SlakError, ExitCode} from '../../lib/errors.js'

async run(): Promise<void> {
  const {args} = await this.parse(MyCommand)
  
  if (!channelExists(args.channel)) {
    throw new SlakError(
      `Channel "${args.channel}" not found`,
      ExitCode.NotFound,
      'channel_not_found',
      [
        'Run "slak channel list" to see available channels',
        'Use #general for the default channel',
      ]
    )
  }
}
```

oclif catches `SlakError` and formats it as:
```json
{
  "error": "channel_not_found",
  "message": "Channel \"#general\" not found",
  "code": 3,
  "suggestions": ["Run \"slak channel list\" to see available channels", ...]
}
```

**Key points:**
- Always throw semantic errors with exit codes, not bare `this.error()` or `process.exit()`
- Include `suggestions` array for agent-friendly guidance
- Use `ExitCode` enum (0-7) for semantic error classification

---

## Pattern 4: JSON Mode

When a command sets `enableJsonFlag = true`, oclif adds `--json` automatically:

```typescript
export default class List extends BaseCommand {
  static summary = 'List channels'
  static enableJsonFlag = true  // Auto-adds --json flag
  
  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(List)
    const channels = await this.slakClient.conversations.list()
    
    // Return data; oclif handles the rest
    return {
      channels,
      total: channels.length,
    }
  }
}
```

Usage:
```bash
$ slak channel list                    # Human output to stdout
$ slak channel list --json             # JSON to stdout
$ slak channel list --json | jq '.channels[].name'  # Pipe to jq
```

**Key points:**
- Return structured data from `run()`
- oclif serializes to JSON when `--json` is set
- No `this.log()` calls in JSON mode (they're suppressed)
- Always set `enableJsonFlag = true` for read operations (mandatory in slak)

---

## Pattern 5: Pagination (via Cursor Iterator)

slak uses a `paginate()` helper (not shown here, but follows this pattern):

```typescript
export async function* paginate<T>(
  method: (params: any) => Promise<{items: T[]; next_cursor: string}>,
  params: Record<string, unknown>,
  options: {limit: number; all: boolean; cursor?: string}
): AsyncIterable<T> {
  let nextCursor = options.cursor ?? ''
  
  do {
    const response = await method({...params, limit: options.limit, cursor: nextCursor})
    
    for (const item of response.items) {
      yield item
    }
    
    nextCursor = response.next_cursor
    
    if (!options.all) break  // Stop after first page if --all not set
    
  } while (nextCursor)
}

// In a command:
async run(): Promise<void> {
  const {flags} = await this.parse(List)
  const results: Channel[] = []
  
  for await (const channel of paginate(
    (params) => this.slakClient.conversations.list(params),
    {types: flags.types},
    {limit: flags.limit, all: flags.all, cursor: flags.cursor}
  )) {
    results.push(channel)
  }
  
  return {channels: results, total: results.length}
}
```

**Key points:**
- Use async iterators (`for await...of`) for lazy evaluation
- Support `--limit`, `--cursor`, `--all` flags consistently
- Never roll manual pagination loops — use helper

---

## Pattern 6: Custom Help Class

Override oclif's Help class for custom formatting, grouping, or behavior:

```typescript
import {Help} from '@oclif/core'

export class SlakHelp extends Help {
  async showRootHelp(): Promise<void> {
    // Custom banner + grouped topics
    this.log('╭─────────────────────────────────────╮')
    this.log('│  world-class Slack CLI for AI       │')
    this.log('╰─────────────────────────────────────╯')
    
    // Group topics by category
    const topics = {
      Messaging: ['chat', 'reaction', 'pin'],
      Workspace: ['channel', 'user', 'file', 'search'],
      Developer: ['api', 'auth'],
    }
    
    for (const [category, cmds] of Object.entries(topics)) {
      this.log(`\n${category}`)
      for (const cmd of cmds) {
        this.log(`  ${cmd}...`)
      }
    }
  }
  
  async showCommandHelp(command): Promise<void> {
    // Custom command help with rich examples
    super.showCommandHelp(command)
    
    // Add custom section
    this.log('\nRELATED COMMANDS')
    command.aliases?.forEach(alias => {
      this.log(`  ${alias}`)
    })
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

**When to customize Help:**
- Custom banner or ASCII art
- Grouping topics by category (Messaging, Workspace, Admin, etc.)
- Highlighting specific sections
- Custom formatting for examples

---

## Pattern 7: Command Aliases

Provide alternative names for commands:

```typescript
export default class ChannelList extends BaseCommand {
  static summary = 'List channels'
  static aliases = ['channels', 'list-channels']
  
  async run(): Promise<void> { ... }
}
```

Usage:
```bash
$ slak channel list     # Primary
$ slak channels         # Alias
$ slak list-channels    # Alias
```

---

## Pattern 8: Deprecation

Mark old commands as deprecated:

```typescript
export default class OldCommand extends Command {
  static summary = 'Old command (deprecated)'
  static deprecated = {
    version: '1.0.0',
    to: 'new-command',  // Suggest replacement
  }
  
  async run(): Promise<void> {
    this.warn('This command is deprecated. Use "slak new-command" instead.')
    // ... rest of implementation
  }
}
```

---

*For cheat sheets and best practices, see [reference.md](./reference.md). For troubleshooting and advanced topics, see [troubleshooting.md](./troubleshooting.md).*
