# Claude Code Development Guide for slak

This document contains instructions for Claude when working in the slak repository.

## Quick Start

1. **Read the skill files first:**
   - `.claude/skills/slack/` — mandatory rules, TDD workflow, code conventions
   - `.claude/skills/oclif.md` — framework reference
   - `.claude/skills/slak-design/index.md` — design decisions

2. **Run these before marking a task complete:**
   ```bash
   npm run type-check    # MUST pass with zero TypeScript errors
   npm test              # MUST pass with all tests green
   npm run lint          # SHOULD pass; fix new lint warnings
   ```

3. **Always use Vitest for unit tests** — it's configured in `vitest.config.ts`

## Mandatory Development Rules

These are **binding constraints**, not suggestions:

1. **Test-First (TDD)** — Every command, library module, and hook must have tests written **before** implementation
2. **`--json` on Every Command** — Set `static enableJsonFlag = true` on all commands
3. **stdout = data; stderr = everything else** — Never `console.log()` directly
4. **No Interactive Prompts When stdin is Not TTY** — AI agents must never hang on prompts
5. **Tokens Never Leak** — Use keytar for storage, env vars for access, never log
6. **Typed Exit Codes Only** — Use `ExitCode` enum from `src/lib/errors.ts`
7. **Type-Check + Test Before Done** — Red build = incomplete task

## Key Files & Architecture

| File | Purpose |
|---|---|
| `src/lib/errors.ts` | ExitCode enum + SlakError class (ALWAYS use, never bare process.exit) |
| `src/lib/base-command.ts` | All commands extend this, not raw Command |
| `src/lib/output.ts` | stdout/stderr helpers (this.log, this.logJson, progress) |
| `src/lib/client.ts` | WebClient wrapper with retry + workspace scoping |
| `src/lib/resolve.ts` | Name→ID resolution (#general → C123, alice@co.com → U789) |
| `src/lib/paginate.ts` | Cursor pagination async iterator |
| `src/help/index.ts` | Custom Help class extending oclif Help |
| `src/hooks/command-not-found.ts` | Spell correction (Y/n prompt or JSON suggestions) |
| `src/commands/**/*.ts` | Command implementations (TDD: test first) |
| `test/**/*.test.ts` | Vitest test files (mirrors src structure) |
| `test/fixtures/` | Mock Slack API responses (one JSON per API method) |

## When to Use Each Skill

- **slack skill**: When implementing commands, following TDD, error handling, name resolution, pagination
- **oclif skill**: When confused about flag parsing, help system, hooks, command discovery
- **slak-design skill**: When deciding if something should be a command vs flag, how to handle workspace multi-tenancy, when to retry vs fail fast

## Testing with Vitest + nock

Every command test follows this pattern:

```typescript
import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'

describe('channel list', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {ok: true, channels: [...], response_metadata: {next_cursor: ''}})
  })
  afterEach(() => nock.cleanAll())

  it('returns JSON with --json flag', async () => {
    const {stdout, error} = await runCommand(['channel', 'list', '--json'])
    expect(error).toBeUndefined()
    const result = JSON.parse(stdout)
    expect(result).toMatchSnapshot()
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {ok: false, error: 'invalid_auth'})
    
    const {exit} = await runCommand(['channel', 'list', '--json'])
    expect(exit).toBe(2)
  })
})
```

**Key points:**
- No real API calls — `nock` mocks all Slack API requests
- `@oclif/test`'s `runCommand()` invokes the command in-process
- Always test both syntaxes: `channel list` and `channel:list`
- Test auth errors, not found errors, pagination, and non-TTY (stdin closed) behavior

## Command Implementation Checklist

When adding a new command `slak <topic> <cmd>`:

- [ ] Write test file FIRST at `test/commands/<topic>/<cmd>.test.ts`
- [ ] Create fixture(s) at `test/fixtures/<api.method>.json` (mock Slack responses)
- [ ] Create command at `src/commands/<topic>/<cmd>.ts` (extends BaseCommand)
- [ ] Set `static enableJsonFlag = true`
- [ ] Set `static summary` (≤1 line) and `static description` (full)
- [ ] Include ≥5 `static examples`, ≥1 using `--json | jq` (AI-agent idiom)
- [ ] Map all Slack API errors to `SlakError` with appropriate `ExitCode`
- [ ] Use name resolution: `resolveChannel()`, `resolveUser()` for any channel/user input
- [ ] Use `paginate()` helper for list commands (never manual loop)
- [ ] Create schema at `docs/schemas/<topic>-<cmd>.json` and add snapshot test
- [ ] Verify both space-separated and colon-separated syntax work
- [ ] Run `npm test` — must be all green
- [ ] Run `npm run type-check` — must be zero errors
- [ ] Run `npm run lint` — fix any new warnings

## Token Safety

Before committing any code:

- [ ] No `console.log(token)` or `this.log(token)`
- [ ] No tokens in `examples` arrays (use `$SLACK_BOT_TOKEN` placeholder or `xoxb-...`)
- [ ] No tokens in error messages (use `redactToken()` if token might leak)
- [ ] No tokens in test fixtures (use `xoxb-test-fake-...` for fake tokens)
- [ ] Tests verify no token leakage to stdout
- [ ] `auth` command stores via `keytar`, falls back to `0o600` file with warning

## Common Patterns

### Error handling with SlakError

```typescript
import {SlakError, ExitCode} from '../../lib/errors.js'

if (!channel) {
  throw new SlakError(
    `Channel "${nameOrId}" not found`,
    ExitCode.NotFound,
    'channel_not_found',
    ['Run "slak channel list" to see available channels']
  )
}
```

### Output (data to stdout, progress to stderr)

```typescript
import {progress} from '../../lib/output.js'

async run() {
  const {flags} = await this.parse(MyCommand)
  
  progress('Fetching...')  // → stderr spinner (only if TTY + not --json)
  const data = await fetch()
  
  if (flags.json) {
    this.logJson({items: data})  // → stdout as JSON
  } else {
    this.log(formatTable(data))  // → stdout formatted
  }
}
```

### Name resolution

```typescript
import {resolveChannel, resolveUser} from '../../lib/resolve.js'

const channelId = await resolveChannel(flags.channel, this.slakClient)  // Accepts 'C123' or '#general'
const userId = await resolveUser(flags.user, this.slakClient)           // Accepts 'U456' or 'alice@co.com'
```

### Pagination

```typescript
import {paginate} from '../../lib/paginate.js'

for await (const item of paginate(
  (params) => client.conversations.list(params),
  {types: flags.types},
  'channels',
  {limit: flags.limit, all: flags.all, cursor: flags.cursor}
)) {
  results.push(item)
}
```

## Project Structure

```
slak-cli/
├── src/
│   ├── commands/       (commands, organized by topic)
│   ├── hooks/          (lifecycle hooks)
│   ├── lib/            (library modules: errors, client, resolve, paginate, output)
│   ├── help/           (custom Help class)
│   └── types/          (TypeScript interfaces)
├── test/
│   ├── commands/       (mirrors src/commands)
│   ├── lib/            (unit tests for lib/)
│   └── fixtures/       (mock Slack API responses)
├── docs/
│   ├── schemas/        (JSON output schemas for each command)
│   └── SLAK-SLI-PLAN.md (project spec)
├── bin/
│   ├── run.js          (production entry point)
│   └── dev.js          (development entry point)
├── .claude/
│   └── skills/         (AI skills: slack, oclif, slak-design)
├── package.json        (oclif + dependencies)
├── tsconfig.json       (TypeScript strict mode)
├── vitest.config.ts    (test runner)
├── .eslintrc.json      (linting)
└── CLAUDE.md           (this file)
```

## Troubleshooting

**Type errors after editing?**
```bash
npm run type-check
```

**Test failing?**
```bash
npm test -- test/commands/channel/list.test.ts    # Single test file
npm test                                           # All tests
npm test -- --ui                                   # UI mode
```

**Lint errors?**
```bash
npm run lint:fix   # Auto-fix most issues
```

**Command not found at runtime?**
- Check the file path matches the intended command ID
- Ensure `npm run build` compiled to `dist/commands/`
- Verify `package.json` glob matches `**/*.js, !**/*.test.js`

---

*All development must follow these rules. Questions? Consult the skill files or project spec in docs/SLAK-SLI-PLAN.md.*
