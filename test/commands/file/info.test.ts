import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('file info', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('gets file info with --json flag', async () => {
    nock('https://slack.com')
      .post('/api/files.info')
      .reply(200, {ok: true, file: {id: 'F123', name: 'test.txt', size: 1024}})

    const {stdout, exit} = await runCommand(['file', 'info', 'F123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.file.id).toBe('F123')
  })

  it('exits 3 on file not found', async () => {
    nock('https://slack.com')
      .post('/api/files.info')
      .reply(200, {ok: false, error: 'file_not_found'})

    const {exit} = await runCommand(['file', 'info', 'F999', '--json'])
    expect(exit).toBe(3)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/files.info')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['file', 'info', 'F123', '--json'])
    expect(exit).toBe(2)
  })
})
