import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel info', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('returns channel info with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.info')
      .reply(200, {
        ok: true,
        channel: {
          id: 'C123',
          name: 'general',
          is_channel: true,
          is_archived: false,
          num_members: 42,
          topic: {value: 'General discussion'},
          purpose: {value: 'Company-wide announcements'},
        },
      })

    const {stdout} = await runCommand(['channel', 'info', 'C123', '--json'])
    const result = JSON.parse(stdout)
    expect(result.channel).toBeDefined()
    expect(result.channel.id).toBe('C123')
  })

  it('resolves channel name to ID', async () => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {
        ok: true,
        channels: [{id: 'C123', name: 'general'}],
        response_metadata: {next_cursor: ''},
      })
    nock('https://slack.com')
      .post('/api/conversations.info')
      .reply(200, {ok: true, channel: {id: 'C123', name: 'general'}})

    const {stdout} = await runCommand(['channel', 'info', '#general', '--json'])
    const result = JSON.parse(stdout)
    expect(result.channel.name).toBe('general')
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.info')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['channel', 'info', 'C999', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.info')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'info', 'C123', '--json'])
    expect(exit).toBe(2)
  })
})
