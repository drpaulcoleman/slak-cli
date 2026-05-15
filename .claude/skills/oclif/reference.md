---
name: oclif-reference
description: oclif reference guide — static properties cheat sheet, flag types, best practices checklist.
metadata:
  type: reference
---

# oclif Quick Reference

## Static Properties Cheat Sheet

```typescript
// Identifiers
static id = 'command:id'                    // Inferred from file path if omitted
static aliases = ['alt1', 'alt2']           // Alternative command names

// Documentation
static summary = 'One-line summary'         // For help listings (max 1 line)
static description = 'Long description'     // For --help (can be multi-line)
static examples = [...]                     // Usage examples (≥3 recommended)
static usage = 'custom usage line'          // Override default usage string

// Behavior
static hidden = false                       // Hide from help listings
static deprecated = {                       // Mark as deprecated
  version: '2.0.0',
  to: 'new-command',  // Suggested replacement
}
static strict = true                        // Enforce exact arg count
static state = 'beta'                       // Show state badge in help

// I/O & Output
static enableJsonFlag = false               // Auto-add --json flag (mandatory in slak)
static baseFlags = {...}                    // Flags inherited by all commands

// Input Structure
static args = {...}                         // Positional arguments
static flags = {...}                        // Named options

// Framework
static plugin: Plugin                       // Parent plugin (auto-set)
static pluginName: string                   // Plugin name (auto-set)
```

---

## Flag Types Cheat Sheet

```typescript
import {Flags} from '@oclif/core'

// String
Flags.string({
  char: 'n',                    // Short form: -n
  description: 'User name',     // Help text
  required: true,               // Must be provided
  default: 'alice',             // Default value
  options: ['a', 'b'],          // Restrict to choices
  env: 'MY_VAR',                // Read from env var if not provided
  hidden: false,                // Hide from help
  multiple: true,               // Allow repeated: --tag foo --tag bar
})

// Boolean
Flags.boolean({
  char: 'v',
  allowNo: true,                // Allow --no-verbose
  default: false,
})

// Integer / Number
Flags.integer({
  default: 10,
  min: 0,
  max: 100,
})

// Option (enum)
Flags.option({
  options: ['json', 'yaml', 'csv'],
  default: 'json',
})

// URL
Flags.url({
  description: 'API endpoint',
})

// File / Directory
Flags.file({
  exists: true,                 // Error if file doesn't exist
  description: 'Input file',
})

Flags.directory({
  exists: true,                 // Error if directory doesn't exist
})

// Help & Version (built-in)
Flags.help({})
Flags.version({})

// Custom type
Flags.custom<MyType>({
  parse: async (input) => {
    // Custom parse logic
    return customValue
  },
})
```

---

## Argument Types Cheat Sheet

```typescript
import {Args} from '@oclif/core'

// String
Args.string({
  required: true,               // Error if omitted
  description: 'Channel name',
})

// Option (enum)
Args.option({
  options: ['json', 'yaml'],
  required: true,
})
```

---

## Best Practices (12 Rules for Tier-1 CLIs)

Followed by sf, heroku, gcloud, and other world-class CLIs. **All apply to slak:**

1. **Always provide a summary** — one-liner for help listings (`static summary`). Max 1 line.

2. **Examples are mandatory** — ≥3 examples per command, covering common use cases. Include AI-agent-idiomatic patterns (piped to `jq`).

3. **Flags over arguments** — prefer flags for readability and script-ability. Arguments are OK for primary resource IDs.

4. **Global flags via baseFlags** — `--json`, `--verbose`, `--quiet` inherited by all commands. No duplication.

5. **Error codes matter** — non-zero exit on any failure. Use semantic codes (2=auth, 3=not found, etc.) from `ExitCode` enum.

6. **Suggestions in errors** — always provide actionable next steps. Example: "Run 'slak auth login' to re-authenticate."

7. **Respect `--json`** — always set `enableJsonFlag = true` on read operations. Return structured, stable data.

8. **Multi-command support** — organize via topics. `slak channel list` vs `slak channel:list` both work.

9. **Help drill-down** — context-sensitive help at root, topic, and command levels. Different information at each level.

10. **Non-interactive by default** — no blocking prompts when stdin isn't a TTY. Detect `process.stdin.isTTY` and fall back gracefully.

11. **Parity between syntaxes** — both `cmd:subcmd` and `cmd subcmd` work identically. Tests cover both.

12. **Plugin extensibility** — design so users can add commands without forking. Support `@oclif/plugin-plugins` for dynamic installation.

---

## Command Implementation Checklist

Before marking a command complete:

- [ ] `static summary` (one-liner, max 1 line)
- [ ] `static description` (full description)
- [ ] `static examples` (≥5 examples, ≥1 uses `--json | jq`)
- [ ] `static enableJsonFlag = true` (mandatory)
- [ ] `static flags` include all relevant options
- [ ] `static args` defined for positional inputs (if any)
- [ ] Extends `BaseCommand` (not raw `Command`)
- [ ] Flags include `...BaseCommand.baseFlags`
- [ ] All Slack API errors mapped to `SlakError` with exit codes
- [ ] Name resolution applied (channels, users)
- [ ] Pagination via `paginate()` helper (if applicable)
- [ ] Both space-separated and colon-separated syntax tested
- [ ] Non-TTY behavior tested (stdin closed, no prompts)
- [ ] `--json` output is stable and schema-tested
- [ ] Error messages include actionable suggestions
- [ ] Tokens never leak to logs or errors

---

## Common Mistakes to Avoid

| Mistake | Fix |
|---|---|
| Using `console.log()` | Use `this.log()` (auto-suppressed in `--json` mode) |
| Bare `process.exit(1)` | Throw `SlakError` with `ExitCode` enum |
| No error suggestions | Always include `suggestions: [...]` in errors |
| Non-interactive on TTY | Check `process.stdin.isTTY` before prompting |
| Not supporting `--json` | Set `static enableJsonFlag = true` on all commands |
| Manual pagination loops | Use `paginate()` helper async iterator |
| Extending raw Command | Extend `BaseCommand` to inherit global flags |
| Redefining global flags | Use `...BaseCommand.baseFlags` to inherit |
| Unclear help text | Provide `summary` + `description` + ≥3 `examples` |
| Inconsistent exit codes | Use only `ExitCode` enum values (0-7) |

---

*For patterns and examples, see [patterns.md](./patterns.md). For troubleshooting and advanced topics, see [troubleshooting.md](./troubleshooting.md).*
