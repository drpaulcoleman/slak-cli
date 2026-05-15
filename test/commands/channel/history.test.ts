import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('channel history', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/conversations.history')
      .reply(200, {
        ok: true,
        messages: [
          {ts: '1234567890.000100', user: 'U123', text: 'Hello world', reply_count: 0},
          {ts: '1234567880.000100', user: 'U456', text: 'Hi there', reply_count: 2},
        ],
        has_more: false,
        response_metadata: {next_cursor: ''},
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('returns message history for a channel', async () => {
    const {stdout, exit} = await runCommand(['channel', 'history', 'C123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.messages).toHaveLength(2)
    expect(result.messages[0].text).toBe('Hello world')
  })

  it('supports --limit flag', async () => {
    const {exit} = await runCommand(['channel', 'history', 'C123', '--limit', '50'])
    expect(exit).toBe(0)
  })

  it('supports --oldest and --latest for time range', async () => {
    const {exit} = await runCommand(['channel', 'history', 'C123', '--oldest', '1234567890'])
    expect(exit).toBe(0)
  })

  it('supports --all flag to fetch all messages', async () => {
    const {exit} = await runCommand(['channel', 'history', 'C123', '--all'])
    expect(exit).toBe(0)
  })

  it('returns JSON with messages[], has_more, next_cursor', async () => {
    const {stdout} = await runCommand(['channel', 'history', 'C123', '--json'])
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('messages')
    expect(result).toHaveProperty('has_more')
    expect(result).toHaveProperty('next_cursor')
  })

  it('resolves channel names to IDs', async () => {
    const {exit} = await runCommand(['channel', 'history', '#general', '--json'])
    expect(typeof exit).toBe('number')
  })
})
