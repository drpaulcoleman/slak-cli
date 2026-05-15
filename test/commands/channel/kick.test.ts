import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel kick', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('removes users from channel with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.kick')
      .reply(200, {ok: true})

    const {stdout, exit} = await runCommand([
      'channel',
      'kick',
      'C123',
      '--user',
      'U123',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.ok).toBe(true)
  })

  it('resolves user name', async () => {
    nock('https://slack.com')
      .post('/api/users.list')
      .reply(200, {
        ok: true,
        members: [{id: 'U123', name: 'alice'}],
        response_metadata: {next_cursor: ''},
      })
    nock('https://slack.com')
      .post('/api/conversations.kick')
      .reply(200, {ok: true})

    const {exit} = await runCommand(['channel', 'kick', 'C123', '--user', 'alice', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.kick')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['channel', 'kick', 'C999', '--user', 'U123', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.kick')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'kick', 'C123', '--user', 'U123', '--json'])
    expect(exit).toBe(2)
  })
})
