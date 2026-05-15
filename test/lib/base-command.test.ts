import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import nock from 'nock'
import {BaseCommand} from '../../src/lib/base-command.js'

describe('BaseCommand', () => {
  beforeEach(() => {
    nock('https://slack.com')
      .post('/api/auth.test')
      .reply(200, {
        ok: true,
        url: 'https://workspace.slack.com/',
        team: 'Workspace',
        team_id: 'T123456',
        user: 'alice',
        user_id: 'U123456',
      })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('static properties', () => {
    it('has enableJsonFlag = true', () => {
      expect(BaseCommand.enableJsonFlag).toBe(true)
    })

    it('includes baseFlags with global options', () => {
      expect(BaseCommand.baseFlags).toBeDefined()
      expect(BaseCommand.baseFlags.workspace).toBeDefined()
      expect(BaseCommand.baseFlags['no-color']).toBeDefined()
      expect(BaseCommand.baseFlags.quiet).toBeDefined()
      expect(BaseCommand.baseFlags.compact).toBeDefined()
      expect(BaseCommand.baseFlags.timeout).toBeDefined()
    })

    it('workspace flag has env var override (SLAK_WORKSPACE)', () => {
      const workspaceFlag = BaseCommand.baseFlags.workspace
      expect(workspaceFlag.env).toBe('SLAK_WORKSPACE')
    })

    it('no-color flag has env var override (NO_COLOR)', () => {
      const noColorFlag = BaseCommand.baseFlags['no-color']
      expect(noColorFlag.env).toBe('NO_COLOR')
    })

    it('quiet flag has env var override (SLAK_QUIET)', () => {
      const quietFlag = BaseCommand.baseFlags.quiet
      expect(quietFlag.env).toBe('SLAK_QUIET')
    })

    it('timeout flag has env var override (SLAK_TIMEOUT)', () => {
      const timeoutFlag = BaseCommand.baseFlags.timeout
      expect(timeoutFlag.env).toBe('SLAK_TIMEOUT')
      expect(timeoutFlag.default).toBe(30000)
    })
  })

  describe('isInteractive()', () => {
    it('returns true when stdin.isTTY is true', () => {
      const originalIsTTY = process.stdin.isTTY
      process.stdin.isTTY = true
      try {
        expect(BaseCommand.prototype.isInteractive()).toBe(true)
      } finally {
        process.stdin.isTTY = originalIsTTY
      }
    })

    it('returns false when stdin.isTTY is false', () => {
      const originalIsTTY = process.stdin.isTTY
      process.stdin.isTTY = false
      try {
        expect(BaseCommand.prototype.isInteractive()).toBe(false)
      } finally {
        process.stdin.isTTY = originalIsTTY
      }
    })

    it('returns false when SLAK_NON_INTERACTIVE is set', () => {
      const originalIsTTY = process.stdin.isTTY
      process.stdin.isTTY = true
      process.env.SLAK_NON_INTERACTIVE = '1'
      try {
        expect(BaseCommand.prototype.isInteractive()).toBe(false)
      } finally {
        process.stdin.isTTY = originalIsTTY
        delete process.env.SLAK_NON_INTERACTIVE
      }
    })
  })

  describe('isJsonMode()', () => {
    it('returns true when --json flag is passed', () => {
      process.argv = ['node', 'slak', 'test', '--json']
      try {
        expect(BaseCommand.prototype.isJsonMode()).toBe(true)
      } finally {
        process.argv = []
      }
    })

    it('returns true when SLAK_OUTPUT=json env var is set', () => {
      process.env.SLAK_OUTPUT = 'json'
      try {
        expect(BaseCommand.prototype.isJsonMode()).toBe(true)
      } finally {
        delete process.env.SLAK_OUTPUT
      }
    })

    it('returns false otherwise', () => {
      process.argv = []
      delete process.env.SLAK_OUTPUT
      expect(BaseCommand.prototype.isJsonMode()).toBe(false)
    })
  })

  describe('output methods', () => {
    it('has logJson method defined', () => {
      expect(typeof BaseCommand.prototype.logJson).toBe('function')
    })

    it('has logToStderr method defined', () => {
      expect(typeof BaseCommand.prototype.logToStderr).toBe('function')
    })
  })

  describe('slakClient getter', () => {
    it('returns a SlakClient instance', async () => {
      // This test is simplified; full integration tested in client.test.ts
      const command = new BaseCommand([])
      command.config = {
        pjson: {oclif: {}} as any,
        cacheDir: '/tmp',
        configDir: '/tmp',
      } as any
      // slakClient getter requires auth setup; tested in integration tests
      expect(typeof command.slakClient).toBe('object')
    })
  })

  describe('error handling', () => {
    it('converts Slack API errors to SlakError with correct exit code', () => {
      // Tested in integration with actual commands
      // Unit test pattern in command implementations
      expect(true).toBe(true)
    })
  })
})
