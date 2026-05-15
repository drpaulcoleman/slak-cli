import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel mark', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('marks channel as read with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.mark')
      .reply(200, {ok: true})

    const {stdout, exit} = await runCommand([
      'channel',
      'mark',
      'C123',
      '--ts',
      '1234567890.123456',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.ok).toBe(true)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.mark')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand([
      'channel',
      'mark',
      'C999',
      '--ts',
      '1234567890.123456',
      '--json',
    ])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.mark')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand([
      'channel',
      'mark',
      'C123',
      '--ts',
      '1234567890.123456',
      '--json',
    ])
    expect(exit).toBe(2)
  })
})
