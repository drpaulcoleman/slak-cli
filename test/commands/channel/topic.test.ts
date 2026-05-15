import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel topic', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('sets channel topic with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setTopic')
      .reply(200, {
        ok: true,
        channel: {id: 'C123', topic: {value: 'New topic'}},
      })

    const {stdout, exit} = await runCommand([
      'channel',
      'topic',
      'C123',
      '--value',
      'New topic',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.channel.topic.value).toBe('New topic')
  })

  it('clears topic when --value is empty', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setTopic')
      .reply(200, {ok: true, channel: {id: 'C123', topic: {value: ''}}})

    const {exit} = await runCommand(['channel', 'topic', 'C123', '--value', '', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setTopic')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['channel', 'topic', 'C999', '--value', 'topic', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setTopic')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'topic', 'C123', '--value', 'topic', '--json'])
    expect(exit).toBe(2)
  })
})
