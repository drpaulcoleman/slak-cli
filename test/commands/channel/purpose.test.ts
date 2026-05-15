import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel purpose', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('sets channel purpose with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setPurpose')
      .reply(200, {
        ok: true,
        channel: {id: 'C123', purpose: {value: 'Channel purpose'}},
      })

    const {stdout, exit} = await runCommand([
      'channel',
      'purpose',
      'C123',
      '--value',
      'Channel purpose',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.channel.purpose.value).toBe('Channel purpose')
  })

  it('clears purpose when --value is empty', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setPurpose')
      .reply(200, {ok: true, channel: {id: 'C123', purpose: {value: ''}}})

    const {exit} = await runCommand(['channel', 'purpose', 'C123', '--value', '', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setPurpose')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand([
      'channel',
      'purpose',
      'C999',
      '--value',
      'purpose',
      '--json',
    ])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.setPurpose')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand([
      'channel',
      'purpose',
      'C123',
      '--value',
      'purpose',
      '--json',
    ])
    expect(exit).toBe(2)
  })
})
