import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel invite', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('invites users to channel with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.invite')
      .reply(200, {ok: true, channel: {id: 'C123'}})

    const {stdout, exit} = await runCommand([
      'channel',
      'invite',
      'C123',
      '--users',
      'U123,U456',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.ok).toBe(true)
  })

  it('resolves user names', async () => {
    nock('https://slack.com')
      .post('/api/users.list')
      .reply(200, {
        ok: true,
        members: [{id: 'U123', name: 'alice'}],
        response_metadata: {next_cursor: ''},
      })
    nock('https://slack.com')
      .post('/api/conversations.invite')
      .reply(200, {ok: true, channel: {id: 'C123'}})

    const {exit} = await runCommand(['channel', 'invite', 'C123', '--users', 'alice', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.invite')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand([
      'channel',
      'invite',
      'C999',
      '--users',
      'U123',
      '--json',
    ])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.invite')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand([
      'channel',
      'invite',
      'C123',
      '--users',
      'U123',
      '--json',
    ])
    expect(exit).toBe(2)
  })
})
