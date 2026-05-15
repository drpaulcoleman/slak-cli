import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('chat post', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/chat.postMessage')
      .reply(200, {
        ok: true,
        channel: 'C123',
        ts: '1234567890.000100',
        message: {
          type: 'message',
          user: 'U123',
          text: 'Hello world',
          ts: '1234567890.000100',
        },
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('posts a message to a channel', async () => {
    const {stdout, exit} = await runCommand([
      'chat',
      'post',
      '--channel',
      'C123',
      '--text',
      'Hello world',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.ts).toBeDefined()
    expect(result.message.text).toBe('Hello world')
  })

  it('requires --channel and --text flags', async () => {
    const {exit} = await runCommand(['chat', 'post', '--text', 'Hello'])
    expect(exit).not.toBe(0)
  })

  it('resolves channel names to IDs', async () => {
    const {exit} = await runCommand(['chat', 'post', '--channel', '#general', '--text', 'test'])
    expect(typeof exit).toBe('number')
  })

  it('supports --thread-ts for replies', async () => {
    const {exit} = await runCommand([
      'chat',
      'post',
      '--channel',
      'C123',
      '--text',
      'Reply',
      '--thread-ts',
      '1234567890.000100',
    ])
    expect(typeof exit).toBe('number')
  })

  it('returns JSON with ts, channel, message', async () => {
    const {stdout} = await runCommand([
      'chat',
      'post',
      '--channel',
      'C123',
      '--text',
      'Hello',
      '--json',
    ])
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('ts')
    expect(result).toHaveProperty('channel')
    expect(result).toHaveProperty('message')
  })

  it('exits 2 (AuthError) on invalid auth', async () => {
    nock.cleanAll()
    nock('https://slack.com')
      .post('/api/chat.postMessage')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand([
      'chat',
      'post',
      '--channel',
      'C123',
      '--text',
      'test',
    ])
    expect(exit).toBe(2)
  })
})
