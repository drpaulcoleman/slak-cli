import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('canvas delete', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('deletes canvas with --json', async () => {
    nock('https://slack.com')
      .post('/api/canvases.delete')
      .reply(200, {ok: true})

    const {stdout, exit} = await runCommand(['canvas', 'delete', 'B123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.ok).toBe(true)
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/canvases.delete')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['canvas', 'delete', 'B123', '--json'])
    expect(exit).toBe(2)
  })
})
