import {createServer} from 'net'

/**
 * Find an available port starting from preferredPort.
 * Tries preferredPort, then increments until finding an open port.
 * Default: 3118 (matches official Slack MCP pattern).
 */
export async function findAvailablePort(preferredPort: number = 3118, maxAttempts: number = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferredPort + i
    if (await isPortAvailable(port)) {
      return port
    }
  }

  throw new Error(`Could not find an available port between ${preferredPort} and ${preferredPort + maxAttempts - 1}`)
}

/**
 * Check if a port is available.
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close()
      resolve(true)
    })

    server.listen(port, 'localhost')
  })
}
