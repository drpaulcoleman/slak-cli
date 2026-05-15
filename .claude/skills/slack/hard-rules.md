---
name: slak-hard-rules
description: Non-negotiable rules that govern all slak development. These are binding constraints, not suggestions. Violating any rule is cause for reverting a change.
---

# Hard Rules (Non-Negotiable)

These are binding constraints on all slak code. Violate one and the change doesn't ship.

## 1. Test-First (TDD)

Every command, every library module, every hook gets a test file written **before** its implementation. 

**The workflow:**
1. Write `test/commands/<topic>/<cmd>.test.ts` (red — test fails)
2. Write `src/commands/<topic>/<cmd>.ts` (green — test passes)
3. Refactor if needed (test stays green)

**No exceptions.** Not for "trivial" helpers. Not for "obvious" logic. Not "I'll write tests later." Tests first, always.

**Why:** Tests are the spec. If you're unsure what the code should do, the test clarifies it. Tests document behavior. Tests catch regressions. Tests are non-negotiable.

---

## 2. `--json` on Every Command

Every command must set:

```typescript
static enableJsonFlag = true
```

If a command can't return valid JSON, it doesn't ship. Period.

**Why:** AI agents depend on this. Humans appreciate it. Piping to `jq` is a power user pattern. No command is too simple to exclude JSON.

---

## 3. stdout is Data; stderr is Everything Else

Never `console.log()` directly. Use:

```typescript
this.log(message)              // → stdout (non-JSON mode)
this.logToStderr(message)      // → stderr (always)
progress(message)              // → stderr spinner (only if TTY + not --json)
```

**stdout contents:**
- The requested result (JSON or formatted human text)
- Only that. Nothing else.

**stderr contents:**
- Progress spinners
- Status messages
- Warnings
- Errors
- Logging

**Why:** AI agents parse stdout. They don't parse stderr. If you mix, agents break. This is a hard requirement for piping and composability.

---

## 4. No Interactive Prompts When `!process.stdin.isTTY`

When stdin isn't a TTY (AI agent, CI, pipe, redirect), never block on a prompt:

```typescript
const isInteractive = process.stdin.isTTY && !process.env.SLAK_NON_INTERACTIVE

if (!isInteractive) {
  // Fall back to sensible default OR exit with error
  // Never inquirer.prompt() here
}
```

**If you must prompt (rare):**
- Check `isInteractive()` from `src/lib/output.ts`
- If false, output JSON suggestions instead:
  ```json
  {
    "error": "ambiguous_input",
    "suggestions": ["option1", "option2"],
    "code": 6
  }
  ```
- Exit non-zero

**Why:** AI agents will hang forever on a prompt, killing the agent loop. This is a fatal design error.

---

## 5. Tokens Never Appear in Logs, Errors, or JSON

Tokens are secrets. They should **never**:
- Be printed to console
- Appear in error messages
- Appear in JSON output
- Appear in `--help` examples
- Be logged anywhere

**Storage:**
- Use `keytar` (OS native keychain) — primary
- Fall back to `~/.config/slak/workspaces.json` (mode `0o600`) — backup
- Warn on stderr if using file fallback

**Acceptance:**
- Accept via `SLACK_BOT_TOKEN`, `SLACK_USER_TOKEN`, `SLACK_APP_TOKEN` env vars
- Accept via `--token` flag (not in argv history; prefer env)
- Accept via `slak auth parse-curl` from stdin

**Redaction:**
- If a token accidentally appears in an error, use `redactToken(msg)` from `src/lib/output.ts` before returning it

**Checklist before committing:**
- [ ] No `console.log(token)` or equivalent
- [ ] No tokens in `examples` arrays (use `$SLACK_BOT_TOKEN` placeholder)
- [ ] No tokens in error messages
- [ ] Tests use fake tokens (`xoxb-test-fake-...`)
- [ ] No tokens in test fixtures

---

## 6. Typed Exit Codes Only

Use the `ExitCode` enum from `src/lib/errors.ts`. Never bare `process.exit(code)`:

```typescript
export enum ExitCode {
  Success         = 0,
  ApiError        = 1,
  AuthError       = 2,
  NotFound        = 3,
  RateLimited     = 4,
  PermissionError = 5,
  ValidationError = 6,
  NetworkError    = 7,
}

// Correct:
throw new SlakError(message, ExitCode.NotFound, 'channel_not_found', suggestions)

// Wrong:
process.exit(3)
this.error(message); this.exit(1)
```

**Why:** Agents parse exit codes. Semantic codes let agents decide what to do (retry, re-auth, ask user, etc.). Bare `process.exit()` prevents proper cleanup and error handling.

---

## 7. `npm run type-check && npm test` Before Declaring Done

Before marking a task complete:

```bash
npm run type-check    # MUST pass (zero TypeScript errors)
npm test              # MUST pass (all tests green)
npm run lint          # SHOULD pass (fix new lint warnings)
```

**A red build = incomplete task.** Don't say "done" until these pass.

**Why:** Type safety catches bugs. Tests document behavior. Lint ensures consistency. These aren't optional.

---

## Enforcement

Violating any of these rules is cause for:
1. Failing code review
2. Requiring a rewrite
3. Reverting the change

There's no "we'll fix it later." These are bedrock principles.

---

*These rules are binding for all slak development. If you're unsure whether a rule applies to your change, it does.*
