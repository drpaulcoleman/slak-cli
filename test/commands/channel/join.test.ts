import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel join', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('joins a channel with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.join')
      .reply(200, {
        ok: true,
        channel: {id: 'C123', name: 'general', is_member: true},
      })

    const {stdout, exit} = await runCommand(['channel', 'join', 'C123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.channel.is_member).toBe(true)
  })

  it('resolves channel name', async () => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {
        ok: true,
        channels: [{id: 'C123', name: 'general'}],
        response_metadata: {next_cursor: ''},
      })
    nock('https://slack.com')
      .post('/api/conversations.join')
      .reply(200, {ok: true, channel: {id: 'C123', is_member: true}})

    const {exit} = await runCommand(['channel', 'join', '#general', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.join')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['channel', 'join', 'C999', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.join')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'join', 'C123', '--json'])
    expect(exit).toBe(2)
  })
})
