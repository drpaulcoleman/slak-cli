---
name: slak-token-lifecycle
description: Slack token types, handling authentication errors, scope mismatch, and refresh patterns for slak.
metadata:
  type: reference
---

# Token Lifecycle & Authentication

## Token Types

Slack has **4 token types** slak should support:

### 1. Bot Token (`xoxb-*`)

**What it is:** App token for the bot installed in a workspace.

**Scopes:** Defined when app is created in Slack API dashboard.

**Grant flow:** User installs app from App Directory → Slack grants token to bot → slak stores token.

**Use case:** Primary auth method for most users. One token per workspace.

**Example format:** `xoxb-<numbers>-<numbers>-<letters>`

### 2. User Token (`xoxp-*`)

**What it is:** Token representing a user (not bot) making API calls.

**Scopes:** Subset of bot scopes; limited to user's permissions.

**Grant flow:** More restrictive; requires explicit user OAuth.

**Use case:** When you need user identity (e.g., marking messages as read, setting presence).

**Example:**
```
xoxp-1234567890-1234567890-1234567890-ABCDEFGHIJKLMNOP
```

### 3. App Token (`xapp-*`)

**What it is:** Token for Socket Mode connections (real-time events).

**Scopes:** Used by apps that subscribe to events via Socket Mode.

**Grant flow:** Created manually in Slack API dashboard.

**Use case:** `slak event listen` command (real-time event streaming).

**Example:**
```
xapp-1-A1234ABCD-1234567890123-ABCDEFGH1234567890IJKLMNOP
```

### 4. Browser Tokens (no standard prefix)

**What it is:** Undocumented tokens extracted from browser DevTools when logged into Slack web client.

**Scopes:** Full user permissions (dangerous, use with care).

**Grant flow:** DevTools cURL from Network tab, parse `d` and `d-s` cookies.

**Use case:** Users who want slak access without creating an app (simpler onboarding).

**Examples:**
```
xoxd-1234567890-1234567890-ABCDEFGHIJKLMNOP     (cookie d)
xoxc-ABCDEFGHIJKLMNOP                            (cookie d-s)
```

**⚠️ Security note:** Browser tokens are user-specific and full-permission. They can be revoked instantly by Slack if detected as misused. Only suggest this to trusted users.

---

## OAuth Authorization Code Flow (Primary Auth Path)

Most slak users won't have a pre-existing token. `slak auth login` initiates OAuth — the **frictionless, industry-standard path** for new users.

### Primary: Built-In Slack App (Zero Setup, PKCE-Secured)

**UX (frictionless, matches Claude CLI pattern):**
```bash
$ slak auth login
→ Opening browser... https://slack.com/oauth/v2/authorize?client_id=...
✓ Authorized! Workspace: my-workspace (T0123ABC)
```

**How it works (PKCE - Proof Key for Code Exchange):**
1. User runs `slak auth login`
2. slak generates random `code_verifier` (no secrets stored anywhere)
3. slak opens browser to Slack OAuth consent screen (pre-configured with Anthropic's verified app, client_id only)
4. User clicks "Authorize"
5. Browser redirects to `http://localhost:3417/oauth/callback?code=XXXX&state=YYYY`
6. slak exchanges `code` + `code_verifier` for token (no client_secret involved)
7. Token stored in keychain
8. User can now run any command

**Why this is the right default:**
- **Frictionless UX:** Single command, automatic browser open, one click to authorize (matches Claude CLI / Slack MCP setup pattern)
- **Zero secrets:** No client_secret stored, baked in, or managed — just public client_id
- **Secure by design:** PKCE prevents authorization code interception, even on localhost
- **Industry-standard:** How modern native apps (mobile, CLI, desktop) handle OAuth
- **No user friction:** Zero app creation, zero credential management

**Implementation details:**
- slak ships with Anthropic's official Slack app `client_id` (public, safe to commit)
- No `client_secret` needed or stored (PKCE replaces it)
- Uses RFC 7636 PKCE flow (code_challenge + code_verifier)
- Scopes are conservative: `chat:write, channels:read, users:read, files:write, reactions:write, pins:write, etc.`
- Token never exposed — stored only in system keychain

**Security model:**
- Slack trusts Anthropic's app (verified publisher)
- slak's binary is the trusted client (runs locally, user controls it)
- Token exchanged over HTTPS with PKCE protection, stored encrypted in OS keychain
- No token ever logged or leaked to slak's output/errors
- No secrets to compromise or rotate

---

### Alternative 1: User's Own Slack App (Full Control, PKCE)

For enterprise admins or users who want to control app scopes + ownership:

```bash
$ slak auth login --client-id xxxxxxxxxxx.xxxxxxxxxxxx
→ Opening browser... https://slack.com/oauth/v2/authorize?client_id=YOUR_ID&...
✓ Authorized! Workspace: my-workspace (T0123ABC)
```

Or store in `~/.config/slak/oauth-credentials.json` (0o600):
```json
{
  "client_id": "xxx.yyy"
}
```

**When to use:**
- Enterprise: company policy requires app ownership
- Advanced: custom scopes needed beyond slak's defaults
- Security: user doesn't trust shared apps

**Note:** User's own app also uses PKCE, so no client_secret is ever needed or stored. Just the public client_id.

---

### Alternative 2: Browser Tokens (Quick Prototyping, Full Permissions)

For quick prototyping or when OAuth isn't available, extract tokens from browser DevTools:

```bash
$ slak auth parse-curl
? Paste cURL from DevTools (Cmd+V):
curl 'https://slack.com/api/conversations.list' \
  -H 'cookie: d=xoxd-...; d-s=xoxc-...' \
  -H 'authorization: Bearer xoxd-...'
  
✓ Extracted tokens! Workspace: my-workspace
```

**Benefits:**
- No OAuth flow, no app creation
- Works immediately
- User is fully in control

**Drawbacks:**
- Browser tokens are full-permission (user-level, very permissive)
- Can be revoked instantly by Slack if misused
- Only works if user is logged into Slack web

**Use case:** Prototyping, one-off usage, users without app creation ability.

---

### Alternative 3: Direct Token (Advanced Users)

For users who already have a token (from creating an app, or from another source):

```bash
$ slak auth login --token $SLACK_BOT_TOKEN --workspace-name my-workspace
✓ Authenticated! Workspace: my-workspace (T0123ABC)

# Or via environment variable (no shell history)
export SLACK_BOT_TOKEN='xoxb-<your-token-here>'
slak channel list
```

**When to use:**
- Token already exists (user created app elsewhere)
- CI/CD automation (env var approach)
- Token rotation/refresh (user has new token)

---

## OAuth Implementation Details

#### Flow: Authorization Code with PKCE (RFC 7636 + RFC 6749)

PKCE (Proof Key for Code Exchange) is used because slak is a native app (no backend server to store secrets).

**Step 1: Generate PKCE Challenge**
```typescript
const codeVerifier = generateRandomString(128)  // random 128-char string
const codeChallenge = base64url(sha256(codeVerifier))
```

**Step 2: Initiate OAuth (open browser)**
```
GET https://slack.com/oauth/v2/authorize
  ?client_id=YOUR_CLIENT_ID
  &code_challenge=<base64url(sha256(codeVerifier))>
  &code_challenge_method=S256
  &scope=chat:write,channels:read,users:read  (comma-separated)
  &redirect_uri=http://localhost:3417/oauth/callback
  &state=<random-32-char-string>  (CSRF protection)
```

**Step 3: User Authorizes**
- Browser opens Slack OAuth consent screen
- User clicks "Authorize my-workspace"
- Slack redirects: `http://localhost:3417/oauth/callback?code=XXXX&state=YYYY`

**Step 4: Exchange Code for Token (PKCE)**
```bash
POST https://slack.com/api/oauth.v2.access
  client_id=YOUR_CLIENT_ID
  code=XXXX
  code_verifier=<the original 128-char string>
  redirect_uri=http://localhost:3417/oauth/callback
  # Note: NO client_secret — PKCE replaces it
```

**Response:**
```json
{
  "ok": true,
  "access_token": "xoxb-...",
  "token_type": "bot",
  "scope": "chat:write,channels:read,users:read",
  "bot_user_id": "U123",
  "app_id": "A123",
  "team": {
    "id": "T0123ABC",
    "name": "my-workspace"
  }
}
```

**Step 5: Store Token**
- Token → keytar (or fallback file)
- Workspace ID/name → config file
- User is authenticated
- code_verifier discarded (no longer needed)

#### Redirect URI: `http://localhost:3417/oauth/callback`

slak must run a **temporary HTTP server** listening on localhost during OAuth:

```typescript
// src/lib/oauth.ts
async function initiateOAuth(clientId: string) {
  // Step 1: Generate PKCE challenge
  const codeVerifier = generateRandomString(128)
  const codeChallenge = base64url(sha256(codeVerifier))
  const state = generateRandomString(32)
  
  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:3417`)
    
    if (url.pathname === '/oauth/callback') {
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      
      if (returnedState !== state) {
        res.writeHead(400)
        res.end('State mismatch - possible CSRF attack')
        server.close()
        return
      }
      
      // Exchange code for token using PKCE (no client_secret)
      const token = await exchangeCodeForToken(
        code,
        clientId,
        codeVerifier  // PKCE: send verifier, not secret
      )
      
      // Store token, close server, return success
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end('<html><body><h1>✅ Authorized!</h1><p>You can close this window.</p></body></html>')
      server.close()
      
      return token
    }
  })
  
  server.listen(3417)
  
  // Open browser
  open(`https://slack.com/oauth/v2/authorize?client_id=${clientId}&...`)
  
  // Wait for callback
  return new Promise(resolve => server.once('close', resolve))
}
```

**Key details:**
- Port `3417` chosen to be unlikely to conflict
- `state` param prevents CSRF attacks (random 32-char string)
- Temporary server closed after token exchange
- Success page shows user confirmation, server auto-closes

#### Scope Selection

Should slak have a **fixed scope set** or let users choose?

**Recommendation: Fixed scopes, with option to customize**

```bash
# Default (recommended scopes for slak)
slak auth login

# Or customize scopes
slak auth login --scopes chat:write,channels:read,users:read,files:write
```

**Default scopes for slak** (bot app):
```
chat:write          (send messages)
chat:read           (read messages / history)
channels:read       (list channels)
channels:manage     (create/archive channels)
users:read          (list users / get user info)
users:write         (set user presence, profiles)
files:write         (upload files)
files:read          (list/read files)
reactions:read      (list reactions)
reactions:write     (add/remove reactions)
pins:read           (list pins)
pins:write          (pin/unpin)
bookmarks:read      (read channel bookmarks)
bookmarks:write     (add/edit bookmarks)
reminders:read      (list reminders)
reminders:write     (add/complete reminders)
dnd:read            (check DND status)
dnd:write           (set DND)
team:read           (read workspace info)
usergroups:read     (list user groups)
admin                (admin operations - only if user is admin)
```

**For user tokens** (xoxp-*), scopes are restricted to user's workspace permissions.

---

### Error Handling During OAuth

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_client_id` | Client ID doesn't exist or is invalid | Check app settings in Slack dashboard |
| `invalid_grant` | Code expired, already used, or PKCE mismatch | Restart OAuth flow |
| `invalid_scope` | Requested scope not granted to app | Check app scopes in Slack dashboard |
| `redirect_uri_mismatch` | Redirect URI doesn't match app settings | Set OAuth Redirect URL to `http://localhost:3417/oauth/callback` in Slack app settings |
| User denies authorization | User clicks "Cancel" during consent | Fail gracefully: "Authorization cancelled. Run `slak auth login` to try again." |
| Network error during token exchange | Transient network failure | Retry up to 2x with exponential backoff |
| Localhost port already in use | Another process listening on 3417 | Fail with suggestion to stop blocking process or use `--oauth-port 3418` |

---

### User Token vs Bot Token Scopes

**Bot tokens** (`xoxb-*`): Can use full scope set defined by app creator.

**User tokens** (`xoxp-*`): Limited to what the user can do in the workspace.

For user tokens, OAuth flow is the same (PKCE-based, no secrets):

```
POST https://slack.com/api/oauth.v2.access
  client_id=...
  code=...
  code_verifier=...
  redirect_uri=...
```

**Response includes user context:**
```json
{
  "access_token": "xoxp-...",
  "token_type": "user",
  "scope": "chat:write,users:read",  // User's actual permissions (subset of app scopes)
  "user_id": "U123"
}
```

---

## Accepting Tokens

### 1. Environment Variables (Preferred for AI agents)

Support all three standard Slack env vars:

```bash
export SLACK_BOT_TOKEN='xoxb-...'
slak channel list

# OR
export SLACK_USER_TOKEN='xoxp-...'
slak channel list

# OR
export SLACK_APP_TOKEN='xapp-...'
slak event listen
```

**In code:**
```typescript
// src/lib/base-command.ts
const token = 
  process.env.SLACK_BOT_TOKEN ||
  process.env.SLACK_USER_TOKEN ||
  process.env.SLACK_APP_TOKEN ||
  (stored token from config)
```

### 2. Command-line Flag (Secondary)

```bash
slak channel list --token 'xoxb-...'
```

**Why not primary?** Tokens appear in shell history. Environment variables are cleaner.

### 3. Interactive `slak auth login`

```bash
$ slak auth login
? Enter your bot token (paste from Slack API dashboard): 
? Workspace name (for multi-workspace): personal
Authenticated! Token saved in keytar.

$ slak channel list  # Uses saved token
```

### 4. `slak auth parse-curl` (Browser Token Extraction)

User copies cURL from DevTools, slak extracts tokens:

```bash
$ slak auth parse-curl
? Paste your cURL command from browser DevTools (Ctrl+V):
curl 'https://slack.com/api/conversations.list' \
  -H 'authorization: Bearer xoxd-1234-...' \
  -H 'cookie: d=xoxd-1234-...; d-s=xoxc-...'
  
Parsed tokens! 
  Browser token: xoxd-1234...
  Session token: xoxc-...
Saved to workspace 'browser'.

$ slak channel list
```

---

## Storing Tokens Safely

### Primary: OS Keychain (keytar)

Use `keytar` for secure OS-native storage:

```typescript
import keytar from 'keytar'

// Store
await keytar.setPassword('slak', 'workspace-id', token)

// Retrieve
const token = await keytar.getPassword('slak', 'workspace-id')

// Remove
await keytar.deletePassword('slak', 'workspace-id')
```

**Benefits:**
- OS-level encryption (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Not readable by other users on the machine
- Can't be leaked by accident in config files

### Fallback: XDG-Compliant Config File

If keytar fails (e.g., headless server):

```json
// ~/.config/slak/workspaces.json (mode 0o600)
{
  "workspaces": {
    "personal": {
      "id": "T0123ABC",
      "name": "personal",
      "token_label": "xoxb-stored-in-keytar",
      "stored_in": "keytar"  // Flag: actual token is in keytar, not here
    },
    "work": {
      "id": "T456XYZ",
      "name": "work", 
      "token_label": "xoxb-fallback-token",
      "stored_in": "file"    // Fallback: token actually stored here
    }
  },
  "default": "personal"
}
```

**Warn on fallback:**
```typescript
if (storedIn === 'file') {
  this.logToStderr(
    chalk.yellow('⚠️  Warning: Token stored in plain file. Consider using a system keychain.')
  )
}
```

**Never store plaintext tokens in VCS or shell configs.**

---

## Error: `401 Unauthorized` / `invalid_auth`

When a token is invalid, revoked, or expired:

```json
{
  "ok": false,
  "error": "invalid_auth"
}
```

**Response code:** Usually `200 OK` (Slack doesn't use HTTP 401 for API responses).

**Handling:**

```typescript
if (error.error === 'invalid_auth' || error.error === 'account_inactive') {
  throw new SlakError(
    'Your token is no longer valid (revoked, expired, or incorrect)',
    ExitCode.AuthError,
    'invalid_auth',
    [
      'Run: slak auth test to verify your current token',
      'Run: slak auth login to re-authenticate with a new token',
    ]
  )
}
```

**Exit code:** `2` (AuthError)

---

## Error: `missing_scope`

Token exists but lacks required scopes:

```json
{
  "ok": false,
  "error": "missing_scope",
  "needed": "chat:write",
  "provided": ["chat:read"]
}
```

**Causes:**
- App was created with limited scopes
- Workspace admin restricted token scopes
- Org policy (Enterprise Grid) revoked scope

**Handling:**

```typescript
if (error.error === 'missing_scope') {
  throw new SlakError(
    `Your token lacks required scope: "${error.needed}" (has: ${error.provided.join(', ')})`,
    ExitCode.PermissionError,
    'missing_scope',
    [
      `Request scope "${error.needed}" in your Slack app settings`,
      'Or contact your workspace admin to grant this scope',
    ]
  )
}
```

**Exit code:** `5` (PermissionError)

---

## `auth.test` Command

Every token type should pass `auth.test` to verify validity:

```bash
$ slak auth test
✓ Valid token for workspace 'personal' (T0123ABC)
  User: alice@co.com
  Team: My Company
  Scopes: chat:write, chat:read, users:read
```

**Implementation:**

```typescript
async run() {
  const client = await this.slakClient
  const resp = await client.auth.test()
  
  if (!resp.ok) {
    throw new SlakError('Token is invalid', ExitCode.AuthError, resp.error)
  }
  
  this.log(`✓ Valid token for workspace '${resp.team_id}'`)
  this.log(`  User: ${resp.user_id}`)
  this.log(`  Team: ${resp.team}`)
  
  if (flags.json) {
    this.logJson({ok: true, user_id: resp.user_id, team_id: resp.team_id})
  }
}
```

---

## Multi-Workspace Token Switching

Users may authenticate to multiple workspaces:

```bash
$ slak auth login --workspace-name personal --token xoxb-...
Authenticated workspace 'personal'

$ slak auth login --workspace-name work --token xoxb-...
Authenticated workspace 'work'

$ slak auth list
personal (default)
work

$ slak channel list  # Uses 'personal' (default)

$ slak channel list --workspace work  # Uses 'work'
```

**Token storage:**
```json
{
  "workspaces": {
    "personal": { "id": "T1", "token_label": "xoxb-1" },
    "work": { "id": "T2", "token_label": "xoxb-2" }
  },
  "default": "personal"
}
```

Each workspace's token is stored separately in keytar under a unique label.

---

## Refresh Patterns

Slack tokens **do not expire** (unlike OAuth access tokens). They're revoked, not refreshed.

### No Refresh Token Needed

If a user wants to rotate their token:

```bash
$ slak auth token rotate
Generated new bot token: xoxb-...
Old token revoked. Workspace updated.
```

This calls Slack's `oauth.v2.access` endpoint to explicitly rotate.

### Handling Token Loss During Session

If a token is revoked while slak is running:

```bash
$ slak channel list  # Works
... (workspace admin revokes app)
$ slak user list  # Fails
✗ Error: invalid_auth
  Run: slak auth test to verify
  Run: slak auth login to re-authenticate
```

No auto-retry on auth errors. Fail fast and suggest re-auth.

---

## Security Best Practices

### For slak developers:

- **Never log tokens:** Use `redactToken()` helper if token appears in error
- **Never pass tokens as arguments:** Use env vars or stored config
- **Never include in test fixtures:** Use fake `xoxb-test-fake-` tokens
- **Never show in help examples:** Use `$SLACK_BOT_TOKEN` placeholder

### For slak users:

- **Use keytar (system keychain):** Safer than config files
- **Rotate tokens periodically:** Reduces risk of token compromise
- **Limit scopes:** Create apps with minimum required scopes
- **Avoid browser tokens:** Use bot/user tokens when possible
- **Don't share tokens:** Each person/bot should have their own

---

## Redacting Tokens from Errors

Helper function to strip tokens from error messages:

```typescript
export function redactToken(message: string): string {
  // Match xoxb-, xoxp-, xapp-, xoxd-, xoxc- patterns
  return message.replace(
    /xox[a-z]-[A-Z0-9_\-]+/gi,
    'xox*-REDACTED'
  )
}
```

Use before outputting errors:

```typescript
const errorMsg = error.message  // might contain token
this.logToStderr(redactToken(errorMsg))
```

---

*Token security is non-negotiable. Slak must never leak tokens in logs, errors, or output.*
