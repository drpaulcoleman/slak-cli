import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel create', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('creates a public channel with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.create')
      .reply(200, {
        ok: true,
        channel: {id: 'C123', name: 'new-channel', is_private: false},
      })

    const {stdout} = await runCommand(['channel', 'create', '--name', 'new-channel', '--json'])
    const result = JSON.parse(stdout)
    expect(result.channel.id).toBe('C123')
    expect(result.channel.is_private).toBe(false)
  })

  it('creates a private channel with --is-private', async () => {
    nock('https://slack.com')
      .post('/api/conversations.create')
      .reply(200, {
        ok: true,
        channel: {id: 'C456', name: 'secret', is_private: true},
      })

    const {stdout} = await runCommand([
      'channel',
      'create',
      '--name',
      'secret',
      '--is-private',
      '--json',
    ])
    const result = JSON.parse(stdout)
    expect(result.channel.is_private).toBe(true)
  })

  it('sets description with --description flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.create')
      .reply(200, {
        ok: true,
        channel: {
          id: 'C789',
          name: 'team',
          is_private: false,
          topic: {value: 'Team coordination'},
        },
      })

    const {stdout} = await runCommand([
      'channel',
      'create',
      '--name',
      'team',
      '--description',
      'Team coordination',
      '--json',
    ])
    const result = JSON.parse(stdout)
    expect(result.channel.id).toBe('C789')
  })

  it('exits 6 if name already exists', async () => {
    nock('https://slack.com')
      .post('/api/conversations.create')
      .reply(200, {ok: false, error: 'name_taken'})

    const {exit} = await runCommand(['channel', 'create', '--name', 'general', '--json'])
    expect(exit).toBe(6)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.create')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'create', '--name', 'test', '--json'])
    expect(exit).toBe(2)
  })
})
