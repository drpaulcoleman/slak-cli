import {describe, it, expect} from 'vitest'
import {
  ExitCode,
  SlakError,
  httpStatusToExitCode,
  slackErrorToExitCode,
  redactToken,
} from '../../src/lib/errors.js'

describe('ExitCode enum', () => {
  it('defines semantic exit codes', () => {
    expect(ExitCode.Success).toBe(0)
    expect(ExitCode.ApiError).toBe(1)
    expect(ExitCode.AuthError).toBe(2)
    expect(ExitCode.NotFound).toBe(3)
    expect(ExitCode.RateLimited).toBe(4)
    expect(ExitCode.PermissionError).toBe(5)
    expect(ExitCode.ValidationError).toBe(6)
    expect(ExitCode.NetworkError).toBe(7)
  })
})

describe('SlakError', () => {
  it('stores message and exit code', () => {
    const error = new SlakError('Channel not found', ExitCode.NotFound)
    expect(error.message).toBe('Channel not found')
    expect(error.exitCode).toBe(ExitCode.NotFound)
  })

  it('stores slack error code', () => {
    const error = new SlakError(
      'Invalid token',
      ExitCode.AuthError,
      'invalid_auth',
    )
    expect(error.slackError).toBe('invalid_auth')
  })

  it('stores suggestions', () => {
    const suggestions = ['Suggestion 1', 'Suggestion 2']
    const error = new SlakError(
      'Error occurred',
      ExitCode.NotFound,
      'not_found',
      suggestions,
    )
    expect(error.suggestions).toEqual(suggestions)
  })

  it('sets error name to SlakError', () => {
    const error = new SlakError('Test', ExitCode.ApiError)
    expect(error.name).toBe('SlakError')
  })
})

describe('httpStatusToExitCode', () => {
  it('maps 401/403 to AuthError', () => {
    expect(httpStatusToExitCode(401)).toBe(ExitCode.AuthError)
    expect(httpStatusToExitCode(403)).toBe(ExitCode.AuthError)
  })

  it('maps 404 to NotFound', () => {
    expect(httpStatusToExitCode(404)).toBe(ExitCode.NotFound)
  })

  it('maps 429 to RateLimited', () => {
    expect(httpStatusToExitCode(429)).toBe(ExitCode.RateLimited)
  })

  it('maps 400/422 to ValidationError', () => {
    expect(httpStatusToExitCode(400)).toBe(ExitCode.ValidationError)
    expect(httpStatusToExitCode(422)).toBe(ExitCode.ValidationError)
  })

  it('maps 5xx to ApiError', () => {
    expect(httpStatusToExitCode(500)).toBe(ExitCode.ApiError)
    expect(httpStatusToExitCode(502)).toBe(ExitCode.ApiError)
    expect(httpStatusToExitCode(503)).toBe(ExitCode.ApiError)
  })

  it('defaults to NetworkError for unknown codes', () => {
    expect(httpStatusToExitCode(418)).toBe(ExitCode.NetworkError)
  })
})

describe('slackErrorToExitCode', () => {
  it('maps auth errors', () => {
    expect(slackErrorToExitCode('invalid_auth')).toBe(ExitCode.AuthError)
    expect(slackErrorToExitCode('token_revoked')).toBe(ExitCode.AuthError)
    expect(slackErrorToExitCode('account_inactive')).toBe(ExitCode.AuthError)
  })

  it('maps permission errors', () => {
    expect(slackErrorToExitCode('missing_scope')).toBe(ExitCode.PermissionError)
    expect(slackErrorToExitCode('user_disabled')).toBe(ExitCode.PermissionError)
  })

  it('maps not found errors', () => {
    expect(slackErrorToExitCode('channel_not_found')).toBe(ExitCode.NotFound)
    expect(slackErrorToExitCode('user_not_found')).toBe(ExitCode.NotFound)
  })

  it('maps rate limit errors', () => {
    expect(slackErrorToExitCode('rate_limited')).toBe(ExitCode.RateLimited)
    expect(slackErrorToExitCode('ratelimited')).toBe(ExitCode.RateLimited)
  })

  it('maps validation errors', () => {
    expect(slackErrorToExitCode('invalid_arg')).toBe(ExitCode.ValidationError)
    expect(slackErrorToExitCode('invalid_cursor')).toBe(ExitCode.ValidationError)
  })

  it('defaults to ApiError for unknown errors', () => {
    expect(slackErrorToExitCode('unknown_error')).toBe(ExitCode.ApiError)
  })
})

describe('redactToken', () => {
  it('redacts xoxb tokens', () => {
    const message = 'Token is xoxb-1234567890-1234567890-ABCDEFGH'
    const redacted = redactToken(message)
    expect(redacted).toBe('Token is xox*-REDACTED')
  })

  it('redacts xoxp tokens', () => {
    const message = 'User token: xoxp-1234567890-1234567890-1234567890-ABCD'
    const redacted = redactToken(message)
    expect(redacted).toBe('User token: xox*-REDACTED')
  })

  it('redacts xoxd and xoxc tokens', () => {
    const message = 'Browser tokens: xoxd-1234 and xoxc-ABCD'
    const redacted = redactToken(message)
    expect(redacted).toBe('Browser tokens: xox*-REDACTED and xox*-REDACTED')
  })

  it('leaves non-token text unchanged', () => {
    const message = 'This is a normal message with no tokens'
    const redacted = redactToken(message)
    expect(redacted).toBe(message)
  })
})
