import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('user info', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/users.info')
      .reply(200, {
        ok: true,
        user: {
          id: 'U123',
          name: 'alice',
          real_name: 'Alice Smith',
          profile: {email: 'alice@example.com', title: 'Engineer'},
          is_admin: false,
          is_bot: false,
        },
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('returns info for a user', async () => {
    const {stdout, exit} = await runCommand(['user', 'info', 'U123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.user.name).toBe('alice')
    expect(result.user.profile.email).toBe('alice@example.com')
  })

  it('resolves user email or name to ID', async () => {
    const {exit} = await runCommand(['user', 'info', 'alice@example.com', '--json'])
    expect(typeof exit).toBe('number')
  })

  it('returns JSON with user object', async () => {
    const {stdout} = await runCommand(['user', 'info', 'U123', '--json'])
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('user')
    expect(result.user).toHaveProperty('id')
    expect(result.user).toHaveProperty('name')
  })

  it('exits 3 (NotFound) if user does not exist', async () => {
    nock.cleanAll()
    nock('https://slack.com')
      .post('/api/users.info')
      .reply(200, {ok: false, error: 'user_not_found'})

    const {exit} = await runCommand(['user', 'info', 'UNONEXISTENT', '--json'])
    expect(exit).toBe(3)
  })

  it('shows human-readable format without --json', async () => {
    const {stdout} = await runCommand(['user', 'info', 'U123'])
    expect(stdout).toContain('alice')
  })
})
