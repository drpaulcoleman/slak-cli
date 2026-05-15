import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('canvas list', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('lists canvases with --json', async () => {
    nock('https://slack.com')
      .post('/api/canvases.list')
      .reply(200, {
        ok: true,
        canvases: [{id: 'B123', is_empty: false, created_at: 1234567890}],
      })

    const {stdout, exit} = await runCommand(['canvas', 'list', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.canvases).toBeDefined()
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/canvases.list')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['canvas', 'list', '--json'])
    expect(exit).toBe(2)
  })
})
