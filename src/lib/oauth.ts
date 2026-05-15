import {createServer, Server} from 'http'
import {URL} from 'url'
import {createHash, randomBytes} from 'crypto'
import {setTimeout as setTimeoutNode, clearTimeout as clearTimeoutNode} from 'node:timers'
import open from 'open'
import {WebClient} from '@slack/web-api'

export interface OAuthConfig {
  clientId: string
  scopes: string[]
  redirectUri?: string
  redirectPort?: number
}

export interface OAuthFlowResult {
  authUrl: string
  redirectServer: Server
  codeVerifier: string
  redirectUri: string
  shutdown: () => Promise<void>
}

export interface OAuthToken {
  accessToken: string
  teamId: string
  teamName: string
  userId: string
  userName: string
  scope: string
}

/**
 * Generate PKCE code verifier and challenge.
 * RFC 7636: code_verifier is 43-128 chars, code_challenge = BASE64URL(SHA256(verifier))
 */
function generatePKCE(): {verifier: string; challenge: string} {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return {verifier, challenge}
}

/**
 * Initiates OAuth flow with PKCE: starts redirect server, builds auth URL, opens browser.
 * Returns auth URL, code verifier, actual redirect URI, and server handle.
 * Supports configurable port with auto-detection if port is busy.
 * Uses PKCE (RFC 7636) — no Client Secret required (like official Slack MCP server).
 */
export async function initiateOAuthFlow(config: OAuthConfig): Promise<OAuthFlowResult> {
  if (!config.clientId) {
    throw new Error('Client ID required for OAuth flow')
  }

  if (!config.scopes || config.scopes.length === 0) {
    throw new Error('At least one scope required for OAuth flow')
  }

  // Determine redirect port (with auto-detection if needed)
  let redirectPort: number
  if (config.redirectUri) {
    const redirectUrl = new URL(config.redirectUri)
    redirectPort = parseInt(redirectUrl.port || '3000', 10)
  } else {
    // Auto-detect available port starting from preferred port
    const {findAvailablePort} = await import('./port.js')
    redirectPort = await findAvailablePort(config.redirectPort || 3000)
  }

  const redirectUri = `http://localhost:${redirectPort}/callback`

  // Generate PKCE challenge
  const {verifier, challenge} = generatePKCE()

  // Build auth URL with PKCE
  const url = new URL('https://slack.com/oauth')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('scope', config.scopes.join(','))
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')

  // Start redirect server
  const redirectServer = await startRedirectServer(redirectPort)

  return {
    authUrl: url.toString(),
    redirectServer,
    codeVerifier: verifier,
    redirectUri,
    shutdown: () => closeServer(redirectServer),
  }
}

/**
 * Waits for user to authorize and capture auth code from redirect.
 * Returns code, or throws if user denies/times out.
 */
export async function waitForAuthCode(
  server: Server,
  timeoutMs: number = 300000, // 5 minutes default
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeoutNode(() => {
      reject(new Error('OAuth authorization timed out (5 minutes)'))
    }, timeoutMs)

    // Attach handler to server's request event
    const handler = (req: any) => {
      clearTimeoutNode(timeout)
      const url = new URL(req.url!, 'http://localhost')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        reject(new Error(`OAuth denied: ${error} - ${url.searchParams.get('error_description')}`))
      } else if (code) {
        resolve(code)
      } else {
        reject(new Error('No authorization code in redirect'))
      }
    }

    server.once('request', handler)
  })
}

/**
 * Exchange authorization code for access token via Slack OAuth API.
 * Uses PKCE (code_verifier) instead of client_secret for authentication.
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string,
): Promise<OAuthToken> {
  const client = new WebClient()

  try {
    const response = (await client.oauth.v2.access({
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    } as any)) as any

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.error}`)
    }

    return {
      accessToken: response.access_token,
      teamId: response.team.id,
      teamName: response.team.name,
      userId: response.authed_user.id,
      userName: response.authed_user.name,
      scope: response.scope || '',
    }
  } catch (error) {
    throw new Error(`Failed to exchange code for token: ${String(error)}`)
  }
}

/**
 * Start HTTP server listening for OAuth redirect callback.
 */
function startRedirectServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`)

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (code) {
          // Success: send HTML confirmation page
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end(`
            <html>
            <head><title>Slack Authentication - Success</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5;">
              <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h1 style="color: #36c5f0; margin-top: 0;">✓ Authentication Successful</h1>
                <p style="color: #666; font-size: 16px;">You have successfully authenticated with Slack.</p>
                <p style="color: #999; font-size: 14px;">You can close this window and return to your terminal.</p>
              </div>
            </body>
            </html>
          `)
        } else if (error) {
          // Error: send error page
          res.writeHead(400, {'Content-Type': 'text/html'})
          const errorDesc = url.searchParams.get('error_description') || 'Unknown error'
          res.end(`
            <html>
            <head><title>Slack Authentication - Error</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5;">
              <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h1 style="color: #e01e5a; margin-top: 0;">✗ Authentication Failed</h1>
                <p style="color: #666; font-size: 16px;">${error}: ${errorDesc}</p>
                <p style="color: #999; font-size: 14px;">Please try again or check your client ID and scopes.</p>
              </div>
            </body>
            </html>
          `)
        } else {
          // No code or error
          res.writeHead(400, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Error</h1><p>No authorization code or error in request</p></body></html>')
        }
      } else {
        res.writeHead(404, {'Content-Type': 'text/plain'})
        res.end('Not Found')
      }
    })

    server.listen(port, 'localhost', () => {
      resolve(server)
    })

    server.on('error', (error) => {
      reject(new Error(`Failed to start redirect server on port ${port}: ${String(error)}`))
    })
  })
}

/**
 * Close redirect server gracefully.
 */
function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

/**
 * Full OAuth flow with PKCE: opens browser, waits for user approval, exchanges code for token.
 * Returns access token ready to use. Uses PKCE — no Client Secret required.
 * Supports configurable redirect port with auto-detection.
 */
export async function performOAuthFlow(config: OAuthConfig): Promise<OAuthToken & {redirectUri: string}> {
  const {authUrl, redirectServer, codeVerifier, redirectUri, shutdown} = await initiateOAuthFlow(config)

  try {
    // Open browser for user to authorize
    await open(authUrl)

    // Wait for redirect with auth code
    const code = await waitForAuthCode(redirectServer)

    // Exchange code for token (using PKCE, no secret needed)
    const token = await exchangeCodeForToken(code, codeVerifier, config.clientId, redirectUri)

    return {
      ...token,
      redirectUri,
    }
  } finally {
    await shutdown()
  }
}
