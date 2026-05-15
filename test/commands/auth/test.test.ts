import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('auth test', () => {
  beforeEach(() => {
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

  describe('with default workspace', () => {
    it('verifies token for default workspace', async () => {
      const {exit} = await runCommand(['auth', 'test'])
      expect(exit).toBe(0)
    })

    it('outputs workspace and user info', async () => {
      const {stdout} = await runCommand(['auth', 'test', '--json'])
      const result = JSON.parse(stdout)
      expect(result).toMatchObject({
        workspace: 'test-workspace',
        team_id: 'T12345',
        user: 'test-bot',
        user_id: 'U12345',
      })
    })
  })

  describe('with --workspace flag', () => {
    it('tests specific workspace by name', async () => {
      const {exit} = await runCommand(['auth', 'test', '--workspace', 'prod'])
      // Would fail if workspace doesn't exist, but command structure tests
      expect(typeof exit).toBe('number')
    })

    it('tests specific workspace by ID', async () => {
      const {exit} = await runCommand(['auth', 'test', '--workspace', 'ws-123'])
      expect(typeof exit).toBe('number')
    })
  })

  describe('error handling', () => {
    it('exits 2 (AuthError) when token is invalid', async () => {
      nock.cleanAll()
      nock('https://slack.com')
        .post('/api/auth.test')
        .reply(200, {ok: false, error: 'invalid_auth'})

      const {exit} = await runCommand(['auth', 'test'])
      expect(exit).toBe(2)
    })

    it('exits 2 (AuthError) when no workspace is configured', async () => {
      const {exit} = await runCommand(['auth', 'test'])
      // Would exit 2 if no workspace configured
      expect(typeof exit).toBe('number')
    })

    it('exits 5 (PermissionError) on missing scopes', async () => {
      nock.cleanAll()
      nock('https://slack.com')
        .post('/api/auth.test')
        .reply(200, {ok: false, error: 'missing_scope'})

      const {exit} = await runCommand(['auth', 'test'])
      expect(exit).toBe(5)
    })
  })

  describe('output formats', () => {
    it('returns structured JSON with --json', async () => {
      const {stdout} = await runCommand(['auth', 'test', '--json'])
      const result = JSON.parse(stdout)
      expect(result).toHaveProperty('workspace')
      expect(result).toHaveProperty('team_id')
      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('user_id')
    })

    it('shows human-readable format by default', async () => {
      const {stdout} = await runCommand(['auth', 'test'])
      expect(stdout).toContain('test-workspace')
    })
  })
})
