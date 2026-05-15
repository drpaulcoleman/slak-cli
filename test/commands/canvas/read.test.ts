import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('canvas read', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('reads canvas with --json', async () => {
    nock('https://slack.com')
      .post('/api/canvases.info')
      .reply(200, {ok: true, canvas: {id: 'B123', name: 'My Canvas', created_at: 1234567890}})

    const {stdout, exit} = await runCommand(['canvas', 'read', 'B123', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.canvas.id).toBe('B123')
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/canvases.info')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['canvas', 'read', 'B123', '--json'])
    expect(exit).toBe(2)
  })
})
