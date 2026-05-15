---
name: slak-dev
description: Governs all development of the `slak` Slack CLI — an oclif-based TypeScript global npm package that gives AI agents and humans full Slack Web API access without the context-accumulation costs of the official Slack MCP server. Enforces test-driven development, stable JSON schemas, stdout/stderr discipline, non-interactive-by-default behavior, typed exit codes, name→ID resolution, and oclif conventions matching the sf/heroku/gcloud/claude CLI tier.
---

# slak — Slack CLI Development Skill

## Purpose & Design North Star

`slak` is a global npm CLI built on **oclif** that exposes the full Slack Web API surface. Its primary user is an **AI agent** running in a coding-agent loop (Claude Code, Cursor, etc.), with humans as the secondary user.

The defining architectural goal: **provide Slack MCP-server parity from a stateless shell tool**. An MCP server injects every tool result directly into the LLM context window; a CLI invocation returns output as a tool result the agent can summarize, slice, pipe, or discard before adding to context. `slak` therefore optimizes for:

- Stable, machine-parseable JSON output (every command supports `--json`)
- Predictable exit codes (numeric, semantic — not just 0/1)
- Zero interactive prompts when stdin is not a TTY
- Strict stdout (data) vs. stderr (progress/errors) separation
- Auto name→ID resolution (`#general` → `C123`, `alice@co.com` → `U789`)
- An `api` escape hatch for any Slack method not yet wrapped
- Stable schemas — breaking output changes require a minor version bump

## When This Skill Applies

Active for **any** edit, run, test, or planning action inside `D:\git-repos\slak-cli\`. This includes editing source under `src/`, tests under `test/`, configuration (`package.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.json`), documentation under `docs/`, or build scripts under `bin/` and `scripts/`. Skip only for purely conversational questions that don't touch code.

## Quick Navigation

| Topic | File | What it covers |
|---|---|---|
| **Mandatory Rules** | [hard-rules.md](./hard-rules.md) | 7 binding rules: TDD, `--json`, stdout/stderr, non-interactive, token safety, typed exit codes, type-check + test before done |
| **TDD Workflow** | [tdd.md](./tdd.md) | RED → GREEN → REFACTOR cycle, required test cases, Vitest + @oclif/test + nock, fixtures, coverage targets (90%+ lib, all flag combos), canonical test patterns |
| **Code Conventions** | [code-conventions.md](./code-conventions.md) | BaseCommand extension, output discipline (this.log/logJson/logToStderr), error handling with SlakError, name→ID resolution, pagination helper usage, flag patterns, token safety |
| **Help System** | [help.md](./help.md) | Custom Help class, root/topic/command help levels, banner + grouped topics, spell correction (interactive + non-interactive), examples, related commands, global flags |
| **Slack API Quirks** | [api-quirks.md](./api-quirks.md) | Rate limits + SDK backoff, cursor pagination semantics, Enterprise Grid restrictions, user-level constraints, message timestamps, threads, channel types, file limits, presence vs DND, search lag, blocks vs text, token revocation |
| **Token Lifecycle & OAuth** | [token-lifecycle.md](./token-lifecycle.md) | **OAuth with slak's built-in app** (primary: frictionless, one-click auth), alternatives (user's own app for control, browser tokens for prototyping, direct tokens for advanced users), keytar + 0o600 storage, auth error handling (401/missing_scope), multi-workspace, redaction helpers |
| **Pagination** | [pagination.md](./pagination.md) | Default limits (100), cursor mechanics (opaque, empty = done), `--limit` for page size, `--cursor` for resume, `--all` for auto-iterate, timestamp filtering (`--oldest`/`--latest`), performance tips, edge cases |

## Related Skills

- **[oclif.md](../oclif/index.md)** — Framework-specific guidance (commands, flags, hooks, plugins)
- **[slak-design-decisions.md](../slak-design/index.md)** — Architectural choices (commands vs flags, when to add features, multi-workspace)

## Key Principles (TL;DR)

1. **Test-First (TDD)** — Write test before code. No exceptions.
2. **`--json` on everything** — Every command returns structured JSON.
3. **stdout = data; stderr = progress/errors** — Never mix.
4. **Non-interactive by default** — AI agents should never get stuck on prompts.
5. **Tokens never leak** — Store in keytar, accept via env, never log.
6. **Typed exit codes** — Use `ExitCode` enum, never bare `process.exit()`.
7. **Run `npm run type-check && npm test` before declaring done** — Red build = incomplete task.

## Core Files to Know

| File | Purpose |
|---|---|
| `src/lib/errors.ts` | `ExitCode` enum + `SlakError` class (write first) |
| `src/lib/base-command.ts` | All commands extend this (global flags, `slakClient` getter) |
| `src/lib/output.ts` | `printJson()`, `progress()`, `isInteractive()` helpers |
| `src/lib/client.ts` | WebClient wrapper (rate-limit handling, workspace scoping) |
| `src/lib/resolve.ts` | Name→ID resolution (channels, users, cached) |
| `src/lib/paginate.ts` | Cursor pagination async iterator |
| `src/hooks/command-not-found.ts` | Spell correction hook |
| `src/help/index.ts` | Custom Help class |
| `test/**/*.test.ts` | Vitest + @oclif/test + nock (no real API calls) |

## Next Steps

- Start with [hard-rules.md](./hard-rules.md) for the non-negotiable constraints
- Read [tdd.md](./tdd.md) before writing any code
- Refer to [code-conventions.md](./code-conventions.md) while implementing commands
- Consult [api-quirks.md](./api-quirks.md) when handling Slack API edge cases
- Use [token-lifecycle.md](./token-lifecycle.md) for auth error handling
- Review [pagination.md](./pagination.md) for list commands

---

*This skill directory contains the complete development guidance for slak. Consult these files instead of asking general questions about the project.*
