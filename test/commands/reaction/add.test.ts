import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('reaction add', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('adds reaction to message with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/reactions.add')
      .reply(200, {ok: true})

    const {stdout, exit} = await runCommand([
      'reaction',
      'add',
      '--emoji',
      'thumbsup',
      '--channel',
      'C123',
      '--ts',
      '1234567890.123456',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.ok).toBe(true)
  })

  it('exits 3 on message not found', async () => {
    nock('https://slack.com')
      .post('/api/reactions.add')
      .reply(200, {ok: false, error: 'message_not_found'})

    const {exit} = await runCommand([
      'reaction',
      'add',
      '--emoji',
      'thumbsup',
      '--channel',
      'C999',
      '--ts',
      '9999.999',
      '--json',
    ])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/reactions.add')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand([
      'reaction',
      'add',
      '--emoji',
      'thumbsup',
      '--channel',
      'C123',
      '--ts',
      '1234567890.123456',
      '--json',
    ])
    expect(exit).toBe(2)
  })
})
