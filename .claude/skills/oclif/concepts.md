---
name: oclif-concepts
description: oclif mental model and core concepts — command classes, topics, flags/args, help system, hooks, plugins, JSON mode.
metadata:
  type: reference
---

# oclif Core Concepts

## Mental Model: 8 Foundational Concepts

### 1. Command Class Inheritance

Every command extends `Command`. The only **required** method is `async run()`. Everything else is optional static properties:

```typescript
export class MyCommand extends Command {
  static id = 'my:command'              // Inferred from file path if omitted
  static summary = '...'                // One-liner for help listings
  static description = '...'            // Full description for --help
  static examples = [...]               // Usage examples
  static args = {...}                   // Positional arguments
  static flags = {...}                  // Named flags / options
  static aliases = [...]                // Alternative command names
  static enableJsonFlag = false          // Auto-add --json flag
  static strict = true                  // Enforce exact arg count
  static baseFlags = {...}              // Flags inherited by subclasses
  
  async run(): Promise<void> {
    // Command implementation
  }
}
```

In slak, all commands extend `BaseCommand` (not raw `Command`), which provides shared flags like `--json`, `--workspace`, `--no-color`.

### 2. Topics & Multi-Level Commands

Commands are organized by directory structure into topics:

```
src/commands/
  ├── hello.ts           → command id: "hello"
  ├── channel/
  │   ├── list.ts        → command id: "channel:list" (or "channel list")
  │   ├── info.ts        → command id: "channel:info"
  │   └── history.ts     → command id: "channel:history"
  └── user/
      ├── list.ts        → command id: "user:list"
      └── info.ts        → command id: "user:info"
```

The `topicSeparator` in `package.json` controls display style:
- `topicSeparator: ":"` → `slak channel:list` (traditional)
- `topicSeparator: " "` → `slak channel list` (natural language, what slak uses)

**Both syntaxes always work** — oclif normalizes internally. `slak channel:list` and `slak channel list` invoke the same command.

### 3. Flags & Arguments

**Flags** are named options:
```typescript
static flags = {
  name: Flags.string({char: 'n', description: 'User name'}),
  limit: Flags.integer({default: 100}),
  verbose: Flags.boolean({char: 'v'}),
}
```

Usage: `slak channel list --limit 50 -v` or `slak channel list --limit=50`

**Args** are positional:
```typescript
static args = {
  channel: Args.string({required: true}),
  format: Args.option({options: ['json', 'yaml']}),
}
```

Usage: `slak channel history #general json`

Both are parsed via: `const {args, flags} = await this.parse(MyCommand)`

**Design principle**: Prefer flags over args for slak. Flags work better with tab completion and scripting.

### 4. Help System

Help is auto-generated from static metadata. Sections: USAGE, DESCRIPTION, ARGUMENTS, FLAGS, EXAMPLES, RELATED COMMANDS.

Customization:
- Extend `@oclif/core`'s `Help` class
- Override `showRootHelp()`, `showTopicHelp()`, `showCommandHelp()`
- Provide custom `helpClass` in `package.json` > `oclif.helpClass`

slak uses a custom Help class at `src/help/index.ts` for grouped topics and context-sensitive drilling.

### 5. Hooks

Hooks are lifecycle events. Fired at specific moments:

| Hook | When | Use case |
|---|---|---|
| `init` | CLI starts, before parsing | Setup, env checks, version checks |
| `preparse` | Before flag parser | Modify argv, expand aliases |
| `prerun` | Command found, before run() | Pre-flight checks |
| `postrun` | After run() succeeds | Logging, analytics |
| `finally` | Always, at shutdown | Teardown (runs even on error) |
| `command_not_found` | Unknown command typed | Spell correction, suggestions |
| `command_incomplete` | Partial match found | Offer choices |

Defined in `package.json`:
```json
{
  "oclif": {
    "hooks": {
      "init": "./dist/hooks/init.js",
      "command_not_found": "./dist/hooks/command-not-found.js"
    }
  }
}
```

slak uses `command_not_found` for spell correction with Levenshtein distance.

### 6. Parsing & Flag Processing

The parser transforms argv into structured `{args, flags}`:

```typescript
const {args, flags} = await this.parse(MyCommand)
// args: {channel: '#general', format: 'json'}
// flags: {limit: 50, verbose: true, workspace: 'personal'}
```

The parser is **optional and replaceable** — you can use a different parser or parse argv manually.

### 7. Plugins

Plugins extend a CLI with new commands and hooks at runtime:

```json
{
  "oclif": {
    "plugins": ["@oclif/plugin-help", "@oclif/plugin-plugins"],
    "devPlugins": ["@oclif/plugin-test"]
  }
}
```

At startup, oclif loads all plugins and merges their commands into the command surface. Users can also install plugins via `slak plugins install`.

### 8. JSON Mode

When a command sets `static enableJsonFlag = true`, oclif auto-adds a `--json` flag:

```typescript
export default class List extends Command {
  static enableJsonFlag = true
  
  async run(): Promise<Record<string, unknown>> {
    const items = [{id: '1', name: 'Alice'}]
    return {items}  // Auto-emitted as JSON when --json is set
  }
}
```

With `--json`:
- oclif suppresses normal `this.log()` output
- oclif calls `toSuccessJson()` to serialize the return value
- Output is JSON-formatted and exit code is 0 (or error code on failure)

This is **mandatory for slak** — every command must support `--json`.

---

## Key Framework Files & Classes

| File | Class | Purpose |
|---|---|---|
| `src/command.ts` | `Command` | Base class for all commands |
| `src/parser/index.ts` | `Parser` | Flag & arg parsing engine |
| `src/help/index.ts` | `Help` | Help text generation & customization |
| `src/config/config.ts` | `Config` | CLI config (commands, topics, plugins, settings) |
| `src/config/plugin.ts` | `Plugin` | Plugin representation & loading |
| `src/errors/errors/index.ts` | `CLIError` | Friendly error class |
| `src/interfaces/hooks.ts` | — | Hook event type definitions |
| `src/flags.ts` | — | Flag type definitions (`Flags.string`, `Flags.boolean`, etc.) |
| `src/args.ts` | — | Arg type definitions |
| `src/help/command.ts` | `CommandHelp` | Per-command help rendering |
| `src/ux/index.ts` | `ux` | UX helpers (spinners, tables, prompts) |

---

## How It All Fits Together

When a user runs `slak channel list --limit 10 --json`:

1. **init hook** fires — setup, env checks
2. **preparse hook** fires — argv can be modified
3. **Parser** parses argv → `{args: {}, flags: {limit: 10, json: true}}`
4. **Config** finds `channel/list.ts` via glob → loads `ChannelList` command class
5. **prerun hook** fires → pre-flight checks
6. **run()** executes → returns result object
7. **toSuccessJson()** serializes result (because `--json` is set)
8. **postrun hook** fires → logging, cleanup
9. **finally hook** fires → teardown (always, even on error)
10. **Exit code** is set (0 on success, semantic code on error)

For slak specifically:
- `BaseCommand` (custom base class) provides `slakClient` getter, workspace resolution, output helpers
- Custom `Help` class groups topics and provides context-sensitive drilling
- `command_not_found` hook provides spell correction
- All commands extend `BaseCommand`, not raw `Command`

---

*Next: See [patterns.md](./patterns.md) for implementation examples, [reference.md](./reference.md) for cheat sheets, [troubleshooting.md](./troubleshooting.md) for debugging.*
