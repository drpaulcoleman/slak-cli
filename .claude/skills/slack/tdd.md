---
name: slak-tdd
description: Test-driven development workflow for slak. The complete TDD cycle, required test cases, test stack (Vitest, @oclif/test, nock), fixture patterns, and coverage targets.
---

# Test-Driven Development Workflow

## The TDD Cycle

For every command `slak <topic> <cmd>`:

### Step 1: Write Tests (RED)

Create `test/commands/<topic>/<cmd>.test.ts`:

```typescript
import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'

describe('channel list', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, require('../../fixtures/conversations.list.json'))
  })
  afterEach(() => nock.cleanAll())

  it('returns stable JSON with --json', async () => {
    const {stdout, error} = await runCommand(['channel', 'list', '--json'])
    expect(error).toBeUndefined()
    const result = JSON.parse(stdout)
    expect(result).toMatchSnapshot()
  })

  it('paginates with --all flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {channels: [...], response_metadata: {next_cursor: 'xyz'}})
      .post('/api/conversations.list')
      .reply(200, {channels: [...], response_metadata: {next_cursor: ''}})
    
    const {stdout} = await runCommand(['channel', 'list', '--all', '--json'])
    const result = JSON.parse(stdout)
    expect(result.channels.length).toBeGreaterThan(0)
    expect(result.next_cursor).toBe('')
  })

  it('filters by --types', async () => {
    const {stdout} = await runCommand(['channel', 'list', '--types', 'public_channel', '--json'])
    const result = JSON.parse(stdout)
    result.channels.forEach(c => {
      expect(c.type).toBe('public_channel')
    })
  })

  it('exits 0 on success', async () => {
    const {error, exit} = await runCommand(['channel', 'list', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {ok: false, error: 'invalid_auth'})
    
    const {error, exit} = await runCommand(['channel', 'list', '--json'])
    expect(exit).toBe(2)
    expect(error?.message).toContain('invalid_auth')
  })

  it('exits 3 when channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.info')
      .reply(200, {ok: false, error: 'channel_not_found'})
    
    const {exit} = await runCommand(['channel', 'info', 'C999', '--json'])
    expect(exit).toBe(3)
  })

  it('both space and colon syntax work', async () => {
    const space = await runCommand(['channel', 'list', '--json'])
    const colon = await runCommand(['channel:list', '--json'])
    expect(space.stdout).toBe(colon.stdout)
  })
})
```

**Run test — expect RED (failing):**
```bash
npm test -- channel.list.test.ts
```

### Step 2: Implement Command

Create `src/commands/channel/list.ts` based on test requirements. Implement until tests pass.

### Step 3: Run Tests (GREEN)

```bash
npm test -- channel.list.test.ts
```

Expect all tests to pass. If any fail, fix the implementation, not the test.

### Step 4: Type-Check

```bash
npm run type-check
```

Expect zero TypeScript errors.

### Step 5: Create/Update Schema

If the command's JSON output is new:

1. Create `docs/schemas/<topic>-<cmd>.json` with the output schema
2. Add a snapshot test to prevent schema drift:
   ```typescript
   it('output matches schema', async () => {
     const {stdout} = await runCommand(['channel', 'list', '--json'])
     const result = JSON.parse(stdout)
     expect(result).toMatchSnapshot('channel-list-schema')
   })
   ```

### Step 6: Verify

```bash
npm run type-check && npm test && npm run lint
```

All green. Task complete.

---

## Required Test Cases per Command

Minimum test coverage:

| Test Case | What it verifies | Exit code |
|---|---|---|
| Happy path | Successful operation returns correct shape | 0 |
| `--json` output | JSON matches schema snapshot | 0 |
| Auth error | Invalid/revoked token → error JSON | 2 |
| API error | Slack API returns error → propagated | 1 (generic) or semantic |
| Not found | Resource doesn't exist → helpful error | 3 |
| Pagination | `--limit`, `--cursor`, `--all` all work | 0 |
| Name resolution | `#general` → channel ID, `alice@co.com` → user ID | 0 |
| Both syntaxes | `slak channel list` and `slak channel:list` both work | 0 |
| Non-TTY mode | When stdin not a TTY, no prompts appear | 0 or error code |
| Global flags | `--workspace`, `--no-color`, `--quiet` respected | varies |

---

## Test Stack

### Vitest

Fast, ESM-first test runner. Run a single file:

```bash
npm test -- src/lib/errors.test.ts
npm test -- test/commands/channel/list.test.ts
```

Run all tests:

```bash
npm test
```

Run with coverage:

```bash
npm test -- --coverage
```

### @oclif/test

Provides `runCommand()` helper to invoke commands in-process:

```typescript
import {runCommand} from '@oclif/test'

const {stdout, stderr, error, exit} = await runCommand(['channel', 'list', '--json'])
```

**Properties:**
- `stdout` — captured stdout
- `stderr` — captured stderr (usually progress/spinner text, omitted in tests)
- `error` — thrown error (if any)
- `exit` — exit code

### nock

HTTP mocking at the network level. Intercept Slack API calls:

```typescript
nock('https://slack.com')
  .post('/api/conversations.list', {types: 'public_channel'})  // Match request body
  .reply(200, {ok: true, channels: [...]})                     // Return mock response
```

**Key patterns:**

```typescript
// Intercept any POST to /api/conversations.list
nock('https://slack.com').post('/api/conversations.list').reply(200, {...})

// Intercept multiple times (for pagination)
nock('https://slack.com')
  .post('/api/conversations.list')
  .reply(200, {channels: [...], response_metadata: {next_cursor: 'x'}})
  .post('/api/conversations.list')
  .reply(200, {channels: [...], response_metadata: {next_cursor: ''}})

// Intercept and inspect request
nock('https://slack.com')
  .post('/api/conversations.info', body => body.channel === 'C123')
  .reply(200, {...})

// Return error response
nock('https://slack.com')
  .post('/api/conversations.list')
  .reply(200, {ok: false, error: 'invalid_auth'})
```

**Important:** Always call `nock.cleanAll()` in `afterEach()` to prevent test pollution.

---

## Fixtures

Store mock Slack API responses in `test/fixtures/`:

```json
// test/fixtures/conversations.list.json
{
  "ok": true,
  "channels": [
    {
      "id": "C123456",
      "name": "general",
      "is_channel": true,
      "is_private": false,
      "is_archived": false,
      "is_member": true,
      "num_members": 42,
      "topic": {"value": "General discussion", "creator": "U123", "last_set": 1234567890},
      "purpose": {"value": "Company-wide announcements and work-based discussion", "creator": "U123", "last_set": 1234567890}
    }
  ],
  "response_metadata": {
    "result_count": 1,
    "next_cursor": ""
  }
}
```

Reference in tests:

```typescript
nock('https://slack.com')
  .post('/api/conversations.list')
  .reply(200, require('../../fixtures/conversations.list.json'))
```

**Pattern:** One fixture file per Slack API method. Name matches the method (conversations.list → conversations.list.json).

---

## Coverage Targets

| Layer | Target |
|---|---|
| `src/lib/` unit tests | 90%+ branch coverage |
| `src/commands/` integration tests | Every flag combination tested |
| `src/hooks/` | All branches (0, 1, 2+ suggestions; TTY vs non-TTY) |
| JSON output schema | Snapshot tests for every command |
| Exit codes | Explicit assertion on every error path |
| Pagination | Single page, multi-page, `--all`, `--cursor` |

Check coverage after running tests:

```bash
npm test -- --coverage
```

---

## Canonical Test Pattern

Use this template for all command tests:

```typescript
import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'

describe('topic command', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/method')
      .reply(200, require('../../fixtures/method.json'))
  })
  
  afterEach(() => nock.cleanAll())

  it('happy path: returns valid JSON', async () => {
    const {stdout, error, exit} = await runCommand(['topic', 'command', '--json'])
    expect(error).toBeUndefined()
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result).toMatchSnapshot()
  })

  it('auth error: exits 2', async () => {
    nock('https://slack.com')
      .post('/api/method')
      .reply(200, {ok: false, error: 'invalid_auth'})
    
    const {exit, stdout} = await runCommand(['topic', 'command', '--json'])
    expect(exit).toBe(2)
    const result = JSON.parse(stdout)
    expect(result.code).toBe(2)
  })

  it('not found: exits 3', async () => {
    nock('https://slack.com')
      .post('/api/method')
      .reply(200, {ok: false, error: 'channel_not_found'})
    
    const {exit} = await runCommand(['topic', 'command', '--json'])
    expect(exit).toBe(3)
  })

  it('both syntaxes work', async () => {
    const space = await runCommand(['topic', 'command', '--json'])
    const colon = await runCommand(['topic:command', '--json'])
    expect(space.exit).toBe(colon.exit)
  })

  it('respects --limit flag', async () => {
    const {stdout} = await runCommand(['topic', 'command', '--limit', '5', '--json'])
    const result = JSON.parse(stdout)
    expect(result.items.length).toBeLessThanOrEqual(5)
  })

  it('non-TTY: no interactive prompts', async () => {
    // This is implicit: if test passes without hanging, prompts aren't firing
    const {exit} = await runCommand(['topic', 'command', '--json'])
    expect(exit).toBe(0)
  })
})
```

---

## Before You Write a Command

1. Skim this file
2. Look at an existing test (`test/commands/chat/post.test.ts` or similar)
3. Copy the canonical pattern above
4. Modify for your command
5. Write the test
6. Run it (RED)
7. Implement the command
8. Run tests (GREEN)
9. Done

---

*TDD is non-negotiable. Follow this workflow for every command, every hook, every library module.*
