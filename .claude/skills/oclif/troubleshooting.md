---
name: oclif-troubleshooting
description: oclif troubleshooting guide — debugging command discovery, flag parsing, help system, flag constraints, config/pjson distinction, manifest caching.
metadata:
  type: reference
---

# oclif Troubleshooting & Advanced Topics

## Debugging Tips

### 1. Command Not Found

When `slak channel list` doesn't work:

**Check the file path:**
```
src/commands/channel/list.ts  →  command id: "channel:list" (or "channel list")
```

If the command ID doesn't match, rename the file or override `static id`.

**Verify the glob in `package.json`:**
```json
{
  "oclif": {
    "commands": "./dist/commands",
    "globPatterns": ["**/*.js", "!**/*.test.js"]
  }
}
```

Ensure:
- Compiled `.js` file is in `dist/commands/`
- Path matches the glob pattern
- File is not excluded (e.g., not `*.test.js`)

**Rebuild:**
```bash
npm run build
npm test -- -- slak channel list
```

---

### 2. Flag Parsing Errors

If flags aren't being recognized:

**Check flag definition:**
```typescript
static flags = {
  limit: Flags.integer({char: 'l'}),  // Correct type?
  verbose: Flags.boolean(),             // Boolean has no value
}
```

**Verify parsing in run():**
```typescript
const {args, flags} = await this.parse(MyCommand)  // Parse BEFORE using flags
// Now flags are available
```

**Test both forms:**
```bash
slak channel list --limit 10
slak channel list --limit=10
slak channel list -l 10
```

All three should work.

---

### 3. JSON Output Not Appearing

If `--json` doesn't produce JSON:

**Check enableJsonFlag:**
```typescript
static enableJsonFlag = true  // Required!
```

**Return a value from run():**
```typescript
async run(): Promise<Record<string, unknown>> {
  return {items: [...]}  // Must return something
}
```

**Don't call this.log() in JSON mode:**
```typescript
// Wrong:
async run(): Promise<void> {
  this.log('Processing...')  // Pollutes JSON
  return {items: [...]}      // Can't return AND log
}

// Right:
async run(): Promise<Record<string, unknown>> {
  // No this.log() in JSON path
  return {items: [...]}      // Return data; oclif handles serialization
}
```

**Override toSuccessJson() if needed:**
```typescript
toSuccessJson(): Record<string, unknown> {
  // Transform return value if needed
  return {processed: this.result}
}
```

---

### 4. Help Text Oddities

If help looks weird:

**Check description:**
```typescript
static summary = 'Short one-liner'
static description = `
  Full description.
  Can be multi-line.
  Markdown is supported.
`
```

**Use template variables in examples:**
```typescript
static examples = [
  '<%= config.bin %> channel list',      // ← gets replaced with "slak"
  '<%= command.id %> --limit 10',        // ← gets replaced with "channel:list"
]
```

**Verify helpClass in package.json:**
```json
{
  "oclif": {
    "helpClass": "./dist/help/index.js"  // Must point to compiled file
  }
}
```

---

## Flag Constraints System

oclif has a powerful **constraints** system for validating flag relationships:

```typescript
export default class MyCommand extends Command {
  static flags = {
    format: Flags.string({description: 'Output format'}),
    json: Flags.boolean({description: 'Output as JSON'}),
    yaml: Flags.boolean({description: 'Output as YAML'}),
    csv: Flags.boolean({description: 'Output as CSV'}),
    interactive: Flags.boolean({description: 'Interactive mode'}),
    batch: Flags.boolean({description: 'Batch mode'}),
  }
  
  static constraints = [
    {type: 'exactly-one', flags: ['json', 'yaml', 'csv']},  // Mutually exclusive
    {type: 'all-or-none', flags: ['interactive', 'batch']},  // Related options
    {type: 'one-or-more', flags: ['json', 'yaml', 'csv']},   // At least one required
  ]
  
  async run() {
    const {flags} = await this.parse(MyCommand)
    // If constraints are violated, parse() throws before run() is called
  }
}
```

**Constraint Types:**

| Type | Behavior | Use case |
|---|---|---|
| `exactly-one` | Exactly one flag must be true | Mutually exclusive formats |
| `at-least-one` | At least one flag must be true | Require choosing method |
| `all-or-none` | All or none (same truthy value) | Related options |
| `one-or-more` | One or more flags true | Require at least one |

**Advantage**: Validation happens in `parse()`, before `run()`. Invalid input fails fast with clear error messages.

---

## Config vs pjson: Key Distinction

oclif uses two related but different concepts:

### `pjson` — The Raw package.json Config

This is the raw `oclif` section from `package.json`:

```json
{
  "oclif": {
    "bin": "slak",
    "commands": "./dist/commands",
    "topicSeparator": " ",
    "plugins": ["@oclif/plugin-help"],
    "hooks": {...}
  }
}
```

Access via: `this.config.pjson.oclif`

Use when you need **static metadata**: plugin names, command glob, bin name, version.

### `config` — The Runtime Config Object

This is the `Config` class instantiated at CLI startup. It:
- Parses the pjson
- Discovers all commands via globs
- Loads all plugins
- Sets up cache paths, env vars
- Provides methods like `findCommand(id)`, `runHook(name)`, `getAllCommandIDs()`

Access via: `this.config`

Use when you need **computed data**: all available commands, plugin instances, cache directories.

**When to Use Each:**

| Scenario | Use |
|---|---|
| Get static metadata (bin, version) | `this.config.pjson.oclif` |
| Find all available commands | `this.config.getAllCommandIDs()` |
| Call a hook | `this.config.runHook(...)` |
| Look up a specific command | `this.config.findCommand(id)` |
| Check if a plugin is loaded | `this.config.plugins.map(p => p.name)` |
| Get cache/data directory | `this.config.cacheDir`, `this.config.dataDir` |

---

## Manifest Caching for Faster Startup

For large CLIs (100+ commands), oclif can cache command metadata in `oclif.manifest.json` to skip filesystem globs during startup.

### When It Matters

- **Large CLIs**: manifest cuts startup from ~500ms to ~50ms
- **Distributed CLIs**: single manifest file instead of globbing
- **CI/CD pipelines**: faster tests

### How to Enable

Add to `package.json`:

```json
{
  "oclif": {
    "commands": "./dist/commands",
    "plugins": ["@oclif/plugin-help"]
  },
  "scripts": {
    "prepack": "oclif manifest"
  }
}
```

The `prepack` script runs before `npm publish`, regenerating the manifest.

### Generate Manifest

```bash
# First time or after major command changes
oclif manifest

# Or as part of build
npm run build && oclif manifest
```

This creates/updates `oclif.manifest.json` with all command metadata. Commit this file (it's safe).

---

## Troubleshooting Checklist

- [ ] Command file exists in `src/commands/`
- [ ] File path matches intended command ID
- [ ] TypeScript compiles to `dist/commands/`
- [ ] `package.json` has correct `commands` glob
- [ ] `static run()` is defined (or inherited)
- [ ] Tests use `@oclif/test`'s `runCommand()` helper
- [ ] Flags are parsed before use: `const {flags} = await this.parse(...)`
- [ ] `--json` works: `enableJsonFlag = true` + command returns value
- [ ] Help looks right: `summary` + `description` + ≥3 `examples`
- [ ] Errors exit non-zero: throw `SlakError`, not `process.exit()`
- [ ] No `console.log()` — use `this.log()` (auto-suppressed in `--json` mode)
- [ ] Both syntaxes work: `slak channel list` and `slak channel:list`
- [ ] Non-TTY tested: command works when stdin is closed (no prompts)

---

## Common Issues & Solutions

| Issue | Solution |
|---|---|
| `command.id = 'undefined'` | File path doesn't match convention, or `static id` not set |
| Flag not recognized | Check flag definition type (`Flags.string`, `Flags.boolean`, etc.) |
| `--json` produces no output | Check `enableJsonFlag = true` and that `run()` returns a value |
| Help text cut off | Increase terminal width or check `description` formatting |
| Errors don't exit non-zero | Use `throw new SlakError(...)` or `this.error()`, not bare `process.exit()` |
| Tests hang on prompt | Ensure no interactive prompts when stdin isn't TTY |
| Command found but fails | Run `npm run build` to recompile, clear `node_modules/.cache` if present |

---

*For patterns and examples, see [patterns.md](./patterns.md). For references and cheat sheets, see [reference.md](./reference.md).*
