import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel rename', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('renames a channel with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.rename')
      .reply(200, {
        ok: true,
        channel: {id: 'C123', name: 'new-name'},
      })

    const {stdout, exit} = await runCommand([
      'channel',
      'rename',
      'C123',
      '--name',
      'new-name',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.channel.name).toBe('new-name')
  })

  it('exits 6 if name already exists', async () => {
    nock('https://slack.com')
      .post('/api/conversations.rename')
      .reply(200, {ok: false, error: 'name_taken'})

    const {exit} = await runCommand(['channel', 'rename', 'C123', '--name', 'general', '--json'])
    expect(exit).toBe(6)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.rename')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['channel', 'rename', 'C999', '--name', 'test', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.rename')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'rename', 'C123', '--name', 'test', '--json'])
    expect(exit).toBe(2)
  })
})
