import {createServer, Server} from 'http'
import {URL} from 'url'
import open from 'open'
import {WebClient} from '@slack/web-api'

export interface OAuthConfig {
  clientId: string
  clientSecret?: string
  scopes: string[]
  redirectUri: string
}

export interface OAuthFlowResult {
  authUrl: string
  redirectServer: Server
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
 * Initiates OAuth flow: starts redirect server, builds auth URL, opens browser.
 * Returns auth URL and server handle; caller awaits code capture.
 */
export async function initiateOAuthFlow(config: OAuthConfig): Promise<OAuthFlowResult> {
  if (!config.clientId) {
    throw new Error('Client ID required for OAuth flow')
  }

  if (!config.scopes || config.scopes.length === 0) {
    throw new Error('At least one scope required for OAuth flow')
  }

  // Build auth URL
  const url = new URL('https://slack.com/oauth')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('scope', config.scopes.join(','))
  url.searchParams.set('redirect_uri', config.redirectUri)

  // Parse redirect port from URI
  const redirectUrl = new URL(config.redirectUri)
  const redirectPort = parseInt(redirectUrl.port || '3000', 10)

  // Start redirect server
  const redirectServer = await startRedirectServer(redirectPort)

  return {
    authUrl: url.toString(),
    redirectServer,
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
    const timeout = setTimeout(() => {
      reject(new Error('OAuth authorization timed out (5 minutes)'))
    }, timeoutMs)

    // Attach handler to server's request event
    const handler = (req: any) => {
      clearTimeout(timeout)
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
 * Requires clientSecret for web app flow.
 */
export async function exchangeCodeForToken(
  code: string,
  config: OAuthConfig,
): Promise<OAuthToken> {
  if (!config.clientSecret) {
    throw new Error('Client secret required for OAuth token exchange')
  }

  const client = new WebClient()

  try {
    const response = (await client.oauth.v2.access({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    })) as any

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
 * Full OAuth flow: opens browser, waits for user approval, exchanges code for token.
 * Returns access token ready to use.
 */
export async function performOAuthFlow(config: OAuthConfig): Promise<OAuthToken> {
  const {authUrl, redirectServer, shutdown} = await initiateOAuthFlow(config)

  try {
    // Open browser for user to authorize
    await open(authUrl)

    // Wait for redirect with auth code
    const code = await waitForAuthCode(redirectServer)

    // Exchange code for token
    const token = await exchangeCodeForToken(code, config)

    return token
  } finally {
    await shutdown()
  }
}
