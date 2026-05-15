import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('channel replies', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/conversations.replies')
      .reply(200, {
        ok: true,
        messages: [
          {ts: '1234567890.000100', user: 'U123', text: 'Original message'},
          {ts: '1234567891.000100', user: 'U456', text: 'Reply 1', thread_ts: '1234567890.000100'},
        ],
        has_more: false,
        response_metadata: {next_cursor: ''},
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('returns thread replies for a message', async () => {
    const {stdout, exit} = await runCommand(['channel', 'replies', 'C123', '1234567890.000100', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.messages).toHaveLength(2)
  })

  it('supports --limit flag', async () => {
    const {exit} = await runCommand(['channel', 'replies', 'C123', '1234567890.000100', '--limit', '10'])
    expect(exit).toBe(0)
  })

  it('requires channel and thread timestamp arguments', async () => {
    const {exit} = await runCommand(['channel', 'replies', 'C123'])
    expect(exit).not.toBe(0)
  })

  it('returns JSON with messages[], has_more, next_cursor', async () => {
    const {stdout} = await runCommand(['channel', 'replies', 'C123', '1234567890.000100', '--json'])
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('messages')
    expect(result).toHaveProperty('has_more')
  })
})
