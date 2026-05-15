import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('file upload', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('uploads file with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/files.upload')
      .reply(200, {
        ok: true,
        file: {id: 'F123', name: 'test.txt', title: 'test.txt'},
      })

    const {stdout, exit} = await runCommand([
      'file',
      'upload',
      '--channel',
      'C123',
      '--title',
      'My File',
      '--json',
    ])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.file).toBeDefined()
  })

  it('exits 3 on channel not found', async () => {
    nock('https://slack.com')
      .post('/api/files.upload')
      .reply(200, {ok: false, error: 'channel_not_found'})

    const {exit} = await runCommand(['file', 'upload', '--channel', 'C999', '--title', 'test'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/files.upload')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['file', 'upload', '--channel', 'C123', '--title', 'test'])
    expect(exit).toBe(2)
  })
})
