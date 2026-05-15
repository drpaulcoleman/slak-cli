---
name: typescript
description: TypeScript best practices and patterns for slak — strict mode, type safety, async/generics, testing with Vitest
metadata:
  type: reference
---

# TypeScript Skill for slak

## Purpose & Design

`slak` is written in strict-mode TypeScript with zero tolerance for `any` types. This skill documents patterns, pitfalls, and best practices learned during slak development.

## When This Skill Applies

Active for **any** TypeScript code in `slak/src/` and `slak/test/`. Reference this skill whenever:
- Working with generics (especially async generators, paginate, client API calls)
- Handling union types or discriminated unions
- Writing type-safe hook implementations
- Testing with Vitest + type assertions
- Configuring tsconfig for oclif projects

## Quick Reference

| Topic | Pattern | File |
|---|---|---|
| **tsconfig.json** | Strict mode, no unused vars, emit declarations | tsconfig.json |
| **Async Generics** | `AsyncGenerator<T>`, parameterized API responses | src/lib/paginate.ts |
| **Type Narrowing** | Discriminated unions for Slack API responses | src/lib/client.ts |
| **Hook Types** | `Hook.CommandNotFound`, context limitations | src/hooks/command-not-found.ts |
| **Vitest + Types** | Generic test fixtures, type assertions in tests | test/**/*.test.ts |

---

## tsconfig.json Essentials

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Key settings for slak:**
- `strict: true` — All strict flags enabled; no `any` escape hatches
- `noUnusedLocals` + `noUnusedParameters` — Forces clean code; caught unused cache variable in output.ts
- `declaration: true` — Generate `.d.ts` for published npm package
- `sourceMap: true` — Dev debugging in dist/

---

## Common Patterns

### 1. Async Generators with Generics

**Pattern:** `AsyncGenerator<T>` for paginating Slack API results.

```typescript
export async function* paginate<T>(
  client: SlakClient,
  method: string,
  params: Record<string, unknown>,
  itemKey: string,
  options: PaginationOptions = {},
): AsyncGenerator<T> {
  // Yields items one at a time
  // Type-safe: T is bound at call site
}

// Call site:
for await (const channel of paginate<ConversationInfo>(client, 'conversations.list', ...)) {
  // TypeScript knows `channel: ConversationInfo`
}
```

**Why this works:**
- Generic `T` is inferred at call site, not at definition
- `AsyncGenerator<T>` is TypeScript's native async iterator type
- `for await` works seamlessly with proper typing

**Pitfall avoided:**
- Early attempt used `response[itemKey] as T[]` with unsafe casting — changed to `(response[itemKey] as T[]) || []`
- This ensures type safety: TypeScript verifies the cast is plausible, but runtime uses safe default

### 2. Discriminated Unions for API Responses

**Pattern:** Handle Slack API responses (success vs error) with union types.

```typescript
type SlackResponse<T> = 
  | {ok: true; data: T}
  | {ok: false; error: string}

function handleResponse<T>(response: SlackResponse<T>): T {
  if (response.ok) {
    return response.data  // TypeScript narrows: response.data is T
  } else {
    throw new SlakError(response.error, ...)
    // TypeScript narrows: response.error is string
  }
}
```

**Why this works:**
- TypeScript's control flow analysis narrows the union based on the `ok` discriminant
- No need for unsafe casts; no `any` types

### 3. Generic Record Types

**Pattern:** Flexible object keys with typed values.

```typescript
function printTable(
  rows: Array<Record<string, unknown>>,
  columns: string[],
): void {
  for (const row of rows) {
    const values = columns.map((col) => {
      const val = row[col]
      return val === null || val === undefined ? '' : String(val)
    })
  }
}
```

**Why this works:**
- `Record<string, unknown>` is safe: keys are strings, values are unknown
- Null checks required before use: `val === null || val === undefined`
- Conversion to string is explicit: `String(val)`

### 4. Function Overloads for Flexible APIs

**Pattern:** Multiple signatures for the same function (if needed).

```typescript
// Not recommended in slak; keep functions simple.
// If needed:
export function resolveChannel(nameOrId: string): Promise<string>
export function resolveChannel(nameOrId: string, client: SlakClient): Promise<string>
export async function resolveChannel(
  nameOrId: string,
  client?: SlakClient,
): Promise<string> {
  // Implementation handles both cases
}
```

**Use sparingly:** Slak prefers explicit parameters over overloads.

---

## Hooks & Context Types

### Hook Signature Issues

**Problem:** oclif hook context is limited; can't call arbitrary methods.

```typescript
// ❌ This fails: context has no logToStderr
export const commandNotFound: Hook.CommandNotFound = async function ({id, config}) {
  this.logToStderr('...')  // Error: logToStderr doesn't exist on context
}

// ✅ Use output module instead
import {logToStderr} from '../lib/output.js'

export const commandNotFound: Hook.CommandNotFound = async function ({id, config}) {
  logToStderr('...')  // Works; direct function call
}
```

**Why:** Hook context is a minimal object; use library functions instead of methods.

---

## Testing Patterns with Vitest

### Type-Safe Test Fixtures

```typescript
import {describe, it, expect, beforeEach} from 'vitest'

describe('myFunction', () => {
  let fixture: MyType

  beforeEach(() => {
    fixture = {key: 'value'} as MyType  // Explicit type
  })

  it('handles the fixture', () => {
    expect(fixture.key).toBe('value')  // TypeScript knows type
  })
})
```

### Type Assertions in Tests

```typescript
// ❌ Avoid `as any`
const result = someCall() as any
expect(result.field).toBe('...')

// ✅ Use proper types or type guards
const result = await someCall() as ExpectedType
expect(result.field).toBe('...')

// ✅ Or test the type itself
expect(typeof result).toBe('object')
expect('field' in result && result.field === '...').toBe(true)
```

---

## Common Mistakes & Fixes

| Mistake | Fix | File |
|---|---|---|
| `import ...from '...'` without `.js` | Use `.js` extension in ESM | All src/ files |
| Unused variable `hasColor` | Remove or use it | output.ts:35 (fixed) |
| Unused parameter `message` | Remove or use it; use `_message` if intentional | output.ts:52 (fixed) |
| `as any` escape hatch | Use proper types or narrow unions | client.ts (avoided) |
| Type errors in callback functions | Check callback signature matches interface | hooks/command-not-found.ts |

---

## Performance Considerations

### Type Checking Speed

- `tsc --noEmit` is fast (~500ms) for slak's current size
- Use `npm run type-check` before committing
- Watch mode: `npm run dev` (tsc --watch) for fast iteration

### Runtime Overhead

- Zero: TypeScript compiles to plain JavaScript
- No `instanceof` checks for types; use discriminants instead
- Generics are erased at runtime; check discriminants or types.

---

## Recommended Reading

1. **TypeScript Handbook** — Union types, generics, narrowing (official)
2. **Advanced TypeScript** — Conditional types, mapped types (if slak grows complex)
3. **oclif TypeScript Guide** — Hook signatures, command typing (framework-specific)

---

## When to Reach for Different Tools

| Need | Tool | Why |
|---|---|---|
| Type checking only, no emit | `tsc --noEmit` | Fast, catches errors |
| Watch mode development | `npm run dev` (tsc --watch) | Live feedback |
| Strict eslint rules | `.eslintrc.json` with typescript-eslint | Enforces conventions |
| Runtime validation | Zod or io-ts (if added) | TypeScript can't validate at runtime |
| API response schemas | TypeScript interfaces + snapshot tests | Stable contracts |

---

*For slak-specific patterns, see [slack skill](../slack/SKILL.md). For framework patterns, see [oclif skill](../oclif/SKILL.md).*
