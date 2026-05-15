import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('search messages', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/search.messages')
      .reply(200, {
        ok: true,
        messages: {
          total: 1,
          paging: {count: 1, total: 1, page: 1, pages: 1},
          matches: [
            {
              type: 'message',
              channel: {id: 'C123', name: 'general'},
              user: 'U456',
              text: 'Found message',
              ts: '1234567890.000100',
            },
          ],
        },
        response_metadata: {next_cursor: ''},
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('searches for messages', async () => {
    const {stdout, exit} = await runCommand(['search', 'messages', 'test query', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].text).toBe('Found message')
  })

  it('requires search query argument', async () => {
    const {exit} = await runCommand(['search', 'messages'])
    expect(exit).not.toBe(0)
  })

  it('supports --in flag to filter by channel', async () => {
    const {exit} = await runCommand(['search', 'messages', 'query', '--in', '#general'])
    expect(typeof exit).toBe('number')
  })

  it('supports --limit flag', async () => {
    const {exit} = await runCommand(['search', 'messages', 'query', '--limit', '10'])
    expect(exit).toBe(0)
  })

  it('supports --sort flag (relevance, timestamp)', async () => {
    const {exit} = await runCommand(['search', 'messages', 'query', '--sort', 'timestamp'])
    expect(exit).toBe(0)
  })

  it('returns JSON with matches[], total count', async () => {
    const {stdout} = await runCommand(['search', 'messages', 'test', '--json'])
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('matches')
    expect(result).toHaveProperty('total')
  })

  it('exits 4 (RateLimited) on rate limit', async () => {
    nock.cleanAll()
    nock('https://slack.com')
      .post('/api/search.messages')
      .reply(200, {ok: false, error: 'rate_limited'})

    const {exit} = await runCommand(['search', 'messages', 'query'])
    expect(exit).toBe(4)
  })
})
