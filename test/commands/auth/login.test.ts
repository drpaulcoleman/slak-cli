import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('auth login', () => {
  beforeEach(() => {
    // Mock Slack OAuth endpoint
    nock('https://slack.com')
      .post('/api/oauth.v2.access')
      .reply(200, {
        ok: true,
        access_token: 'xoxb-test-token-abc123',
        token_type: 'bot',
        scope: 'channels:read,users:read,chat:write',
        bot_user_id: 'U12345',
        app_id: 'A12345',
        team: {id: 'T12345', name: 'test-workspace'},
      })

    // Mock auth.test endpoint
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
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('with --token flag (non-interactive)', () => {
    it('accepts bot token directly', async () => {
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
        'xoxp-test-user-token',
        '--workspace-name',
        'user-test',
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
      expect(exit).not.toBe(0)
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
      await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
      ])

      // nock will track if auth.test was called
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

  describe('with SLACK_BOT_TOKEN env var', () => {
    it('reads token from environment variable', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token-abc123'
      try {
        const {exit} = await runCommand([
          'auth',
          'login',
          '--workspace-name',
          'test',
        ])
        expect(exit).toBe(0)
      } finally {
        delete process.env.SLACK_BOT_TOKEN
      }
    })
  })

  describe('default (OAuth flow)', () => {
    it('requires client-id and client-secret for OAuth (default)', async () => {
      // Default behavior is OAuth, which requires client credentials
      const {exit} = await runCommand([
        'auth',
        'login',
        '--workspace-name',
        'test',
      ])
      // Should fail because OAuth (default) requires client-id and client-secret
      expect(exit).not.toBe(0)
    })

    it('requires interactive terminal (TTY) for OAuth (default)', async () => {
      // Default OAuth mode requires interactive terminal
      const {exit} = await runCommand([
        'auth',
        'login',
        '--client-id',
        'C123ABC',
        '--client-secret',
        's3cr3t',
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
      // First login succeeds
      await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
      ])

      // Second login with same workspace name should fail
      const {exit} = await runCommand([
        'auth',
        'login',
        '--token',
        'xoxb-test-token-abc123',
        '--workspace-name',
        'test',
      ])
      expect(exit).toBe(6) // ExitCode.ValidationError
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
})
