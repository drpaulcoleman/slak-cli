import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel unarchive', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('unarchives a channel with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.unarchive')
      .reply(200, {ok: true})

    const {stdout, exit} = await runCommand(['channel', 'unarchive', 'C123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.ok).toBe(true)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.unarchive')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['channel', 'unarchive', 'C999', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.unarchive')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'unarchive', 'C123', '--json'])
    expect(exit).toBe(2)
  })

  it('exits 5 on permission error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.unarchive')
      .reply(200, {ok: false, error: 'access_not_granted'})

    const {exit} = await runCommand(['channel', 'unarchive', 'C123', '--json'])
    expect(exit).toBe(5)
  })
})
