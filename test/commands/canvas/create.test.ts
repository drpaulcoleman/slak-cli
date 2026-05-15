import {runCommand} from '@oclif/test'
import nock from 'nock'
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

describe('canvas create', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test-token')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
  })

  it('creates canvas with --json', async () => {
    nock('https://slack.com')
      .post('/api/canvases.create')
      .reply(200, {ok: true, canvas: {id: 'B123'}})

    const {stdout, exit} = await runCommand(['canvas', 'create', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.canvas.id).toBe('B123')
  })

  it('exits 2 on auth error', async () => {
    nock('https://slack.com')
      .post('/api/canvases.create')
      .reply(200, {ok: false, error: 'invalid_auth'})

    const {exit} = await runCommand(['canvas', 'create', '--json'])
    expect(exit).toBe(2)
  })
})
