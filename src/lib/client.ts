import {WebClient, LogLevel} from '@slack/web-api'
import {SlakError, ExitCode, slackErrorToExitCode} from './errors.js'

/**
 * SlakClient: WebClient wrapper with rate-limit handling, retry logic, and workspace scoping.
 * Handles SDK rate-limit backoff, maps Slack API errors to semantic exit codes,
 * and provides workspace-scoped client instances.
 */
export class SlakClient {
  private client: WebClient
  private workspaceId?: string

  constructor(token: string, workspaceId?: string) {
    this.workspaceId = workspaceId

    // Initialize WebClient with standard Slack SDK config
    // SDK handles rate-limit 429 with exponential backoff automatically
    this.client = new WebClient(token, {
      logLevel: process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO,
      rejectRateLimitedCalls: false, // Let SDK handle with backoff
      maxRequestConcurrency: 2,
    })
  }

  /**
   * Get the underlying WebClient (for direct API calls).
   */
  web(): WebClient {
    return this.client
  }

  /**
   * Get current workspace ID.
   */
  getWorkspaceId(): string | undefined {
    return this.workspaceId
  }

  /**
   * Make a call to any Slack API method.
   * Handles error mapping to semantic exit codes.
   */
  async apiCall<T = Record<string, unknown>>(
    method: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await this.client.apiCall(method, args)

      if (!response.ok) {
        const error = String(response.error || 'unknown_error')
        const exitCode = slackErrorToExitCode(error)
        throw new SlakError(
          `Slack API error: ${error}`,
          exitCode,
          error,
          this.getSuggestions(error),
        )
      }

      return response as T
    } catch (err) {
      // Re-throw SlakError as-is
      if (err instanceof SlakError) {
        throw err
      }

      // Convert network/timeout errors
      if (err instanceof Error) {
        const message = err.message
        if (message.includes('timeout') || message.includes('ECONNRESET')) {
          throw new SlakError(
            `Network error: ${message}`,
            ExitCode.NetworkError,
            'connection_error',
            ['Check network connectivity', 'Increase timeout with --timeout flag'],
          )
        }
      }

      throw err
    }
  }

  /**
   * Get actionable suggestions for common Slack API errors.
   */
  private getSuggestions(error: string): string[] {
    switch (error) {
      case 'invalid_auth':
      case 'token_revoked':
        return ['Run "slak auth login" to re-authenticate']
      case 'missing_scope':
        return ['Grant missing scopes to your app on api.slack.com']
      case 'channel_not_found':
        return ['Run "slak channel list" to see available channels']
      case 'user_not_found':
        return ['Run "slak user list" to see available users']
      case 'not_in_channel':
        return ['Use "slak channel join <channel>" first']
      case 'rate_limited':
        return ['Slack rate limit reached', 'Increase delay between requests']
      default:
        return []
    }
  }
}
