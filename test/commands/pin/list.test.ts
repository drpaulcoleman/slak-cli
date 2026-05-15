import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('pin list', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('lists pinned messages with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/pins.list')
      .reply(200, {
        ok: true,
        items: [
          {message: {text: 'pinned message', ts: '1234567890.123456'}},
        ],
        response_metadata: {next_cursor: ''},
      })

    const {stdout, exit} = await runCommand(['pin', 'list', '--channel', 'C123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.items).toBeDefined()
    expect(result.items).toHaveLength(1)
  })

  it('supports pagination', async () => {
    nock('https://slack.com')
      .post('/api/pins.list')
      .reply(200, {
        ok: true,
        items: [{message: {text: 'item1'}}],
        response_metadata: {next_cursor: 'cursor1'},
      })

    const {exit} = await runCommand(['pin', 'list', '--channel', 'C123', '--limit', '1', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/pins.list')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['pin', 'list', '--channel', 'C999', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/pins.list')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['pin', 'list', '--channel', 'C123', '--json'])
    expect(exit).toBe(2)
  })
})
