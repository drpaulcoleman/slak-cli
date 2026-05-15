import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('reaction list', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('lists all reactions on message with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/reactions.get')
      .reply(200, {
        ok: true,
        message: {
          ts: '1234567890.123456',
          reactions: [{name: 'thumbsup', users: ['U123', 'U456'], count: 2}],
        },
      })

    const {stdout, exit} = await runCommand([
      'reaction',
      'list',
      '--channel',
      'C123',
      '--ts',
      '1234567890.123456',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.message.reactions).toBeDefined()
  })

  it('exits 3 on message not found', async () => {
    nock('https://slack.com')
      .post('/api/reactions.get')
      .reply(200, {ok: false, error: 'message_not_found'})

    const {exit} = await runCommand([
      'reaction',
      'list',
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
      .post('/api/reactions.get')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand([
      'reaction',
      'list',
      '--channel',
      'C123',
      '--ts',
      '1234567890.123456',
      '--json',
    ])
    expect(exit).toBe(2)
  })
})
