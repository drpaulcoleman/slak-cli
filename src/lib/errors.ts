/**
 * Typed exit codes and error classes for slak CLI.
 * All errors must use semantic exit codes for AI agent reliability.
 */

export enum ExitCode {
  Success = 0,
  ApiError = 1,
  AuthError = 2,
  NotFound = 3,
  RateLimited = 4,
  PermissionError = 5,
  ValidationError = 6,
  NetworkError = 7,
}

/**
 * Structured error for slak commands.
 * Includes semantic exit code, Slack error identifier, and actionable suggestions.
 */
export class SlakError extends Error {
  constructor(
    message: string,
    public exitCode: ExitCode,
    public slackError?: string,
    public suggestions?: string[],
  ) {
    super(message)
    this.name = 'SlakError'
  }
}

/**
 * Convert HTTP status code to semantic exit code.
 */
export function httpStatusToExitCode(status: number): ExitCode {
  switch (status) {
    case 401:
    case 403:
      return ExitCode.AuthError
    case 404:
      return ExitCode.NotFound
    case 429:
      return ExitCode.RateLimited
    case 400:
    case 422:
      return ExitCode.ValidationError
    case 500:
    case 502:
    case 503:
      return ExitCode.ApiError
    default:
      return ExitCode.NetworkError
  }
}

/**
 * Map Slack API error codes to semantic exit codes.
 */
export function slackErrorToExitCode(error: string): ExitCode {
  switch (error) {
    case 'invalid_auth':
    case 'token_revoked':
    case 'expired_token':
    case 'account_inactive':
      return ExitCode.AuthError

    case 'missing_scope':
    case 'restricted_action':
    case 'no_permission':
    case 'org_login_required':
    case 'user_disabled':
      return ExitCode.PermissionError

    case 'not_found':
    case 'channel_not_found':
    case 'user_not_found':
    case 'file_not_found':
    case 'message_not_found':
    case 'no_such_team':
      return ExitCode.NotFound

    case 'rate_limited':
    case 'ratelimited':
      return ExitCode.RateLimited

    case 'invalid_arg':
    case 'invalid_arg_name':
    case 'invalid_arg_type':
    case 'invalid_cursor':
    case 'invalid_name':
    case 'name_taken':
      return ExitCode.ValidationError

    case 'request_timeout':
    case 'connection_error':
    case 'internal_error':
    case 'fatal_error':
    case 'service_unavailable':
      return ExitCode.ApiError

    default:
      return ExitCode.ApiError
  }
}

/**
 * Redact tokens from error messages for safe logging.
 */
export function redactToken(message: string): string {
  return message.replace(/xox[a-z]-[A-Z0-9_\-]+/gi, 'xox*-REDACTED')
}
