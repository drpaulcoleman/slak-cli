import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('file list', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('lists files with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/files.list')
      .reply(200, {
        ok: true,
        files: [{id: 'F123', name: 'test.txt', created: 1234567890}],
        response_metadata: {next_cursor: ''},
      })

    const {stdout, exit} = await runCommand(['file', 'list', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.files).toBeDefined()
  })

  it('filters by channel', async () => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {ok: true, channels: [{id: 'C123', name: 'general'}], response_metadata: {next_cursor: ''}})
    nock('https://slack.com')
      .post('/api/files.list')
      .reply(200, {ok: true, files: [], response_metadata: {next_cursor: ''}})

    const {exit} = await runCommand(['file', 'list', '--channel', '#general', '--json'])
    expect(exit).toBe(0)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/files.list')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['file', 'list', '--json'])
    expect(exit).toBe(2)
  })
})
