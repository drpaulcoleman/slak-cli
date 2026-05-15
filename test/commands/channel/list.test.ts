import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {runCommand} from '@oclif/test'
import nock from 'nock'

describe('channel list', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/conversations.list')
      .reply(200, {
        ok: true,
        channels: [
          {id: 'C123', name: 'general', is_archived: false, num_members: 42},
          {id: 'C456', name: 'random', is_archived: false, num_members: 38},
        ],
        response_metadata: {next_cursor: ''},
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('lists all channels', async () => {
    const {stdout, exit} = await runCommand(['channel', 'list', '--json'])
    expect(exit).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.channels).toHaveLength(2)
    expect(result.channels[0].name).toBe('general')
  })

  it('supports --limit flag for page size', async () => {
    const {exit} = await runCommand(['channel', 'list', '--limit', '10'])
    expect(exit).toBe(0)
  })

  it('supports --all flag to fetch all pages', async () => {
    const {exit} = await runCommand(['channel', 'list', '--all'])
    expect(exit).toBe(0)
  })

  it('supports --types filter (public, private, im, mpim)', async () => {
    const {exit} = await runCommand(['channel', 'list', '--types', 'public_channel,private_channel'])
    expect(exit).toBe(0)
  })

  it('supports --exclude-archived flag', async () => {
    const {exit} = await runCommand(['channel', 'list', '--exclude-archived'])
    expect(exit).toBe(0)
  })

  it('returns JSON schema with channels[], next_cursor', async () => {
    const {stdout} = await runCommand(['channel', 'list', '--json'])
    const result = JSON.parse(stdout)
    expect(result).toHaveProperty('channels')
    expect(result).toHaveProperty('next_cursor')
  })

  it('shows table format without --json', async () => {
    const {stdout} = await runCommand(['channel', 'list'])
    expect(stdout).toContain('general')
  })
})
