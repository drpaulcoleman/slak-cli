import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('user list', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/users.list')
      .reply(200, {
        ok: true,
        members: [
          {id: 'U123', name: 'alice', real_name: 'Alice Smith', profile: {email: 'alice@example.com'}},
          {id: 'U456', name: 'bob', real_name: 'Bob Jones', profile: {email: 'bob@example.com'}},
        ],
        response_metadata: {next_cursor: ''},
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('lists all users', async () => {
    const {stdout, exit} = await runCommand(['user', 'list', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.users).toHaveLength(2)
    expect(result.users[0].name).toBe('alice')
  })

  it('supports --limit flag', async () => {
    const {exit} = await runCommand(['user', 'list', '--limit', '50'])
    expect(exit).toBe(0)
  })

  it('supports --all flag', async () => {
    const {exit} = await runCommand(['user', 'list', '--all'])
    expect(exit).toBe(0)
  })

  it('returns JSON with users[], next_cursor', async () => {
    const {stdout} = await runCommand(['user', 'list', '--json'])
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('users')
    expect(result).toHaveProperty('next_cursor')
  })

  it('shows table format without --json', async () => {
    const {stdout} = await runCommand(['user', 'list'])
    expect(stdout).toContain('alice')
  })
})
