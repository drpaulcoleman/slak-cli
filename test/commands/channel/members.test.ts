import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('channel members', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('returns channel members with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.members')
      .reply(200, {
        ok: true,
        members: ['U123', 'U456'],
        response_metadata: {next_cursor: ''},
      })

    const {stdout} = await runCommand(['channel', 'members', 'C123', '--json'])
    const result = JSON.parse(stdout)
    expect(result.members).toEqual(['U123', 'U456'])
  })

  it('supports pagination with --limit', async () => {
    nock('https://slack.com')
      .post('/api/conversations.members')
      .reply(200, {
        ok: true,
        members: ['U123'],
        response_metadata: {next_cursor: 'cursor1'},
      })

    const {stdout} = await runCommand(['channel', 'members', 'C123', '--limit', '1', '--json'])
    const result = JSON.parse(stdout)
    expect(result.members).toHaveLength(1)
  })

  it('paginates with --all flag', async () => {
    nock('https://slack.com')
      .post('/api/conversations.members')
      .reply(200, {
        ok: true,
        members: ['U123'],
        response_metadata: {next_cursor: 'cursor1'},
      })
    nock('https://slack.com')
      .post('/api/conversations.members')
      .reply(200, {
        ok: true,
        members: ['U456'],
        response_metadata: {next_cursor: ''},
      })

    const {stdout} = await runCommand(['channel', 'members', 'C123', '--all', '--json'])
    const result = JSON.parse(stdout)
    expect(result.members.length).toBeGreaterThan(1)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/conversations.members')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['channel', 'members', 'C999', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/conversations.members')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['channel', 'members', 'C123', '--json'])
    expect(exit).toBe(2)
  })
})
