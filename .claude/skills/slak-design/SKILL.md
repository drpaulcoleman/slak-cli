---
name: slak-design
description: Architectural decision guide for slak CLI design — command structure, pagination, arguments vs flags, designing for humans and AI agents, workspace multi-tenancy, error recovery, schema versioning.
metadata:
  type: reference
---

# slak Design Decisions Guide

## Purpose

When designing a new slak command or feature, this guide helps you make consistent architectural choices aligned with both human UX and AI agent needs.

## Quick Decisions Table

| Decision | Guidance | See |
|---|---|---|
| **Command vs flag** | Separate if semantically distinct; flag if refining same operation | decisions.md |
| **Pagination** | Include for lists >100 items; support `--limit`, `--cursor`, `--all` | decisions.md |
| **Args vs flags** | Args for primary resource ID; flags for everything else | decisions.md |
| **Humans + agents** | Default to agents (non-interactive, JSON, exit codes, suggestions) | decisions.md |
| **Workspaces** | Support `--workspace` override; require default workspace | decisions.md |
| **Env-var config** | Override global flags: `--json`, `--workspace`, `--no-color`, `--quiet` | decisions.md |
| **Error recovery** | Retry transient errors; fail fast on auth/permission/not-found | decisions.md |
| **API escape hatch** | Use `slak api <method>` for niche/experimental endpoints | decisions.md |
| **Schema versioning** | Breaking JSON changes = minor version bump (0.X.0) | decisions.md |

## Core Principles

1. **Default to agents** — When humans and AI conflict, prioritize agents. Humans can read docs; agents depend on predictability.

2. **Non-interactive by default** — Detect `process.stdin.isTTY`. No prompts when stdin is closed (pipes, agents, CI).

3. **Stable JSON schemas** — Once released, breaking changes require version bump. Document schemas in `docs/schemas/`.

4. **Semantic exit codes** — Use `ExitCode` enum (0-7). Agents read exit codes to understand error type.

5. **Suggestions in errors** — Always include actionable next steps: "Run 'slak auth login' to re-authenticate."

6. **Name→ID resolution** — Agents shouldn't look up IDs manually. Commands accept both `#general` and `C123`.

7. **Consistent flag naming** — Use `--limit`, `--cursor`, `--all` across all list commands. Use `--workspace` globally.

8. **Pagination consistency** — All list commands support three modes: single page (`--limit`), resume (`--cursor`), all pages (`--all`).

---

## When to Read the Full Guide

Consult [decisions.md](./decisions.md) when you're unsure about:
- Should this be a separate command or a flag?
- Should I include pagination?
- How do I handle both human and agent UX?
- When should a command retry vs fail fast?
- How do I handle multi-workspace selection?
- What's the right schema versioning strategy?

---

**For detailed decision guidance, see [decisions.md](./decisions.md).**
