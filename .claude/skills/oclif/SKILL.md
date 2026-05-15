---
name: oclif-dev
description: oclif framework expert skill — command architecture, flags/args, help system, hooks, plugins, JSON mode, patterns, best practices, troubleshooting.
metadata:
  type: reference
---

# oclif Framework Skill

## Purpose

oclif is the open-source CLI framework by Salesforce (used in `sf`, `heroku`, and world-class CLIs). This skill provides expert guidance on oclif behavior, patterns, and best practices for slak development.

## When This Skill Applies

When you're:
- Implementing a slak command and need to understand oclif mechanics
- Debugging command discovery, flag parsing, or help system issues
- Designing the command surface / CLI architecture
- Extending oclif (hooks, plugins, custom Help class)
- Working on `src/commands/`, `src/hooks/`, `src/help/`, or `src/lib/`

## Quick Navigation

| Topic | File | What it covers |
|---|---|---|
| **Concepts** | [concepts.md](./concepts.md) | Mental model, command classes, topics, flags, help, hooks, parsing, plugins, JSON mode |
| **Patterns** | [patterns.md](./patterns.md) | 5 common patterns, custom Help class, JSON mode examples |
| **Reference** | [reference.md](./reference.md) | Static properties cheat sheet, flag types, best practices (12 rules) |
| **Troubleshooting** | [troubleshooting.md](./troubleshooting.md) | Debugging tips, constraints system, config vs pjson, manifest caching |

## Core Concepts at a Glance

### Commands extend Command base class
Every command extends `@oclif/core`'s `Command`. Only required method: `async run()`.

```typescript
export default class MyCommand extends BaseCommand {
  static summary = 'One-liner'
  static description = 'Full description'
  static enableJsonFlag = true
  static flags = {...}
  static args = {...}
  async run() { }
}
```

### Topics organize commands
Directory structure maps to command IDs. Both syntaxes work: `slak channel list` and `slak channel:list`.

```
src/commands/channel/
  ├── list.ts      → "channel list"
  ├── info.ts      → "channel info"
  └── history.ts   → "channel history"
```

### Flags & Args
- **Flags**: Named options (`--limit 100`, `--json`)
- **Args**: Positional (`<channel-id>`)

Flags are preferred for scripting and tab completion.

### Hooks lifecycle
Hooks fire at specific moments: `init` → `preparse` → `prerun` → `run()` → `postrun` → `finally`

Special hook: `command_not_found` for spell correction (slak uses this).

### JSON mode built-in
Set `enableJsonFlag = true`, command returns structured data, oclif handles rest.

---

## Reference Materials

Local cached references (no online dependency):

| Location | Contains |
|---|---|
| `reference/core/src/` | oclif source code (Command, Help, parser, plugins, hooks, config) |
| `reference/oclif-docs/` | Official documentation (commands, args, flags, hooks, help classes, plugins) |
| `reference/core/src/**/*.d.ts` | TypeScript types for all framework APIs |
| `reference/core/test/command/fixtures/` | Canonical oclif project examples |

---

**For detailed guidance, see the nested modules:**
- Start with [concepts.md](./concepts.md) to understand oclif's architecture
- Use [patterns.md](./patterns.md) for implementation examples
- Refer to [reference.md](./reference.md) for cheat sheets and best practices
- Consult [troubleshooting.md](./troubleshooting.md) when debugging
