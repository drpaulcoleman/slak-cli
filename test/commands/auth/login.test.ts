import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('auth login', () => {
  beforeEach(() => {
    // Mock auth.test endpoint (used for token verification)
    nock('https://slack.com')
      .post('/api/auth.test')
      .reply(200, {
        ok: true,
        url: 'https://test-workspace.slack.com/',
        team: 'test-workspace',
        team_id: 'T12345',
        user: 'test-bot',
        user_id: 'U12345',
        bot_id: 'B12345',
      })

    // Mock OAuth token exchange endpoint (for --client-id/--client-secret)
    nock('https://slack.com')
      .post('/api/oauth.v2.access')
      .reply(200, {
        ok: true,
        access_token: 'xoxb-test-oauth-token',
        token_type: 'bot',
        scope: 'channels:read,users:read,chat:write',
        bot_user_id: 'U12345',
        app_id: 'A12345',
        authed_user: {id: 'U12345', name: 'test-bot'},
        team: {id: 'T12345', name: 'test-workspace'},
      })

    // Mock Device Flow endpoints (note: Device Flow requires interactive TTY, so it fails in tests)
    // No need to mock Device Flow since tests are non-interactive
  })

  afterEach(() => {
    nock.cleanAll()
    delete process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_CLIENT_ID
    delete process.env.SLACK_CLIENT_SECRET
  })

  describe('Token auth (--token or SLACK_BOT_TOKEN)', () => {
    it('accepts bot token via --token flag', async () => {
      const {stdout, exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
        '--json',
      ])
      expect(exit).toBe(0)
      const result = JSON.parse(stdout)
      expect(result.workspace.name).toBe('test')
      expect(result.workspace.teamId).toBe('T12345')
    })

    it('accepts user token (xoxp-*)', async () => {
      const {exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxp-test-user-token-xyz',
        '--workspace-name',
        'user-test',
      ])
      expect(exit).toBe(0)
    })

    it('reads token from SLACK_BOT_TOKEN env var', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token-abc123'
      const {exit} = await runCommand([
        'auth',
        'login',
        '--workspace-name',
        'test',
      ])
      expect(exit).toBe(0)
    })

    it('validates token format', async () => {
      const {exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'invalid-token',
        '--workspace-name',
        'test',
      ])
      expect(exit).toBe(6) // ExitCode.ValidationError
    })

    it('requires workspace name', async () => {
      const {exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token',
      ])
      expect(exit).not.toBe(0)
    })

    it('calls auth.test to verify token', async () => {
      nock.cleanAll()
      nock('https://slack.com')
        .post('/api/auth.test')
        .reply(200, {ok: true, team_id: 'T12345', team: 'test', user: 'test-user', user_id: 'U12345'})

      await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
      ])

      expect(nock.isDone()).toBe(true)
    })

    it('returns workspace config in JSON', async () => {
      const {stdout} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
        '--json',
      ])

      const result = JSON.parse(stdout)
      expect(result).toMatchObject({
        workspace: {
          id: expect.any(String),
          name: 'test',
          teamId: 'T12345',
          tokenLabel: expect.any(String),
          isDefault: true,
        },
        message: expect.stringContaining('authenticated'),
      })
    })
  })

  describe('OAuth auth (default, PKCE — only Client ID needed)', () => {
    it('requires client-id for OAuth', async () => {
      const {exit} = await runCommand([
        'auth',
        'login',
        '--workspace-name',
        'test',
      ])
      // Should fail because OAuth requires Client ID (PKCE, no secret)
      expect(exit).toBe(6) // ExitCode.ValidationError
    })

    it('requires interactive terminal for OAuth', async () => {
      const {exit} = await runCommand([
        'auth',
        'login',
        '--client-id',
        'C123ABC',
        '--workspace-name',
        'test',
      ])
      // Should fail because OAuth requires interactive terminal (stdin is not TTY in tests)
      expect(exit).not.toBe(0)
    })
  })

  describe('error handling', () => {
    it('exits 2 (AuthError) on invalid token', async () => {
      nock.cleanAll()
      nock('https://slack.com')
        .post('/api/auth.test')
        .reply(200, {ok: false, error: 'invalid_auth'})

      const {exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-invalid-token',
        '--workspace-name',
        'test',
      ])
      expect(exit).toBe(2) // ExitCode.AuthError
    })

    it('exits 5 (PermissionError) on missing scopes', async () => {
      nock.cleanAll()
      nock('https://slack.com')
        .post('/api/auth.test')
        .reply(200, {ok: false, error: 'missing_scope'})

      const {exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-limited-token',
        '--workspace-name',
        'test',
      ])
      expect(exit).toBe(5) // ExitCode.PermissionError
    })

    it('exits 6 (ValidationError) if workspace name already exists', async () => {
      nock.cleanAll()
      nock('https://slack.com')
        .post('/api/auth.test')
        .twice()
        .reply(200, {ok: true, team_id: 'T12345', team: 'test', user: 'test-user', user_id: 'U12345'})

      // First login succeeds
      const {exit: firstExit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
      ])
      expect(firstExit).toBe(0)

      // Second login with same workspace name should fail
      const {exit: secondExit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
      ])
      expect(secondExit).toBe(6) // ExitCode.ValidationError
    })
  })

  describe('workspace creation', () => {
    it('creates workspace with generated ID', async () => {
      const {stdout} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'my-workspace',
        '--json',
      ])

      const result = JSON.parse(stdout)
      expect(result.workspace.id).toMatch(/^ws-/)
    })

    it('sets as default workspace if first one', async () => {
      const {stdout} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'first',
        '--json',
      ])

      const result = JSON.parse(stdout)
      expect(result.workspace.isDefault).toBe(true)
    })

    it('stores token label for keytar lookup', async () => {
      const {stdout} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
        '--json',
      ])

      const result = JSON.parse(stdout)
      expect(result.workspace.tokenLabel).toBeDefined()
      expect(result.workspace.tokenLabel).toMatch(/^slak-/)
    })
  })

  describe('auth method priority', () => {
    it('prefers token auth when both token and OAuth creds are provided', async () => {
      const {exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--client-id',
        'C123ABC',
        '--workspace-name',
        'test',
      ])
      // Should succeed using token auth (priority over OAuth)
      expect(exit).toBe(0)
    })
  })
})
