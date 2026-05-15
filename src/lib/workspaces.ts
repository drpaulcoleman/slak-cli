import Conf from 'conf'
import {SlakError, ExitCode} from './errors.js'

/**
 * Workspace configuration manager.
 * Uses conf package for XDG-compliant storage (cross-platform).
 * Tokens are stored in OS keychain (keytar) when available; fallback to 0o600 file.
 */

export interface WorkspaceConfig {
  id: string
  name: string
  teamId?: string
  tokenLabel: string // For keytar lookup
  createdAt: number
  isDefault: boolean
}

export interface ConfigStore {
  workspaces: WorkspaceConfig[]
  defaultWorkspaceId?: string
}

const DEFAULT_CONFIG: ConfigStore = {
  workspaces: [],
  defaultWorkspaceId: undefined,
}

/**
 * WorkspaceManager: Manage multiple Slack workspace configurations.
 * Workspaces are stored in ~/.config/slak/config.json (XDG).
 * Tokens are stored separately in OS keychain (via keytar).
 */
export class WorkspaceManager {
  private conf: Conf<ConfigStore>

  constructor() {
    this.conf = new Conf<ConfigStore>({
      projectName: 'slak',
      defaults: DEFAULT_CONFIG,
    })
  }

  /**
   * Get a workspace by ID or name.
   * Returns undefined if not found.
   */
  getWorkspace(idOrName?: string): WorkspaceConfig | undefined {
    const workspaces = this.conf.get('workspaces', [])

    if (!idOrName) {
      // Return default workspace
      const defaultId = this.conf.get('defaultWorkspaceId')
      return workspaces.find((w) => w.id === defaultId)
    }

    // Find by ID or name
    return workspaces.find((w) => w.id === idOrName || w.name === idOrName)
  }

  /**
   * List all configured workspaces.
   */
  listWorkspaces(): WorkspaceConfig[] {
    return this.conf.get('workspaces', [])
  }

  /**
   * Add a new workspace configuration.
   * Generates a unique ID automatically.
   */
  addWorkspace(config: Omit<WorkspaceConfig, 'id' | 'createdAt'>): WorkspaceConfig {
    const workspaces = this.conf.get('workspaces', [])

    // Check for duplicates
    if (workspaces.some((w) => w.name === config.name)) {
      throw new SlakError(
        `Workspace "${config.name}" already exists`,
        ExitCode.ValidationError,
        'name_taken',
        [`Use "slak auth list" to see all workspaces`, `Use "slak auth logout" to remove a workspace`],
      )
    }

    const newWorkspace: WorkspaceConfig = {
      ...config,
      id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    }

    workspaces.push(newWorkspace)
    this.conf.set('workspaces', workspaces)

    // Set as default if it's the first workspace
    if (workspaces.length === 1) {
      this.setDefault(newWorkspace.id)
    }

    return newWorkspace
  }

  /**
   * Remove a workspace configuration.
   */
  removeWorkspace(idOrName: string): void {
    const workspaces = this.conf.get('workspaces', [])
    const index = workspaces.findIndex((w) => w.id === idOrName || w.name === idOrName)

    if (index === -1) {
      throw new SlakError(
        `Workspace "${idOrName}" not found`,
        ExitCode.NotFound,
        'not_found',
        [`Use "slak auth list" to see all workspaces`],
      )
    }

    const removed = workspaces.splice(index, 1)[0]
    this.conf.set('workspaces', workspaces)

    // If removed was default, set next workspace as default
    if (removed.id === this.conf.get('defaultWorkspaceId')) {
      if (workspaces.length > 0) {
        this.setDefault(workspaces[0].id)
      } else {
        this.conf.set('defaultWorkspaceId', undefined)
      }
    }
  }

  /**
   * Set a workspace as the default.
   */
  setDefault(idOrName: string): void {
    const workspace = this.getWorkspace(idOrName)

    if (!workspace) {
      throw new SlakError(
        `Workspace "${idOrName}" not found`,
        ExitCode.NotFound,
        'not_found',
        [`Use "slak auth list" to see all workspaces`],
      )
    }

    this.conf.set('defaultWorkspaceId', workspace.id)
  }

  /**
   * Get the default workspace.
   * Throws if none configured.
   */
  getDefaultWorkspace(): WorkspaceConfig {
    const defaultId = this.conf.get('defaultWorkspaceId')
    if (!defaultId) {
      throw new SlakError(
        'No workspace configured',
        ExitCode.AuthError,
        'invalid_auth',
        ['Run "slak auth login" to authenticate with Slack'],
      )
    }

    const workspace = this.getWorkspace(defaultId)
    if (!workspace) {
      throw new SlakError(
        'Default workspace was deleted',
        ExitCode.AuthError,
        'invalid_auth',
        ['Run "slak auth login" to set up a new workspace'],
      )
    }

    return workspace
  }

  /**
   * Retrieve token from OS keychain for a workspace.
   * Returns token or undefined if not found.
   */
  async getToken(workspace: WorkspaceConfig): Promise<string | undefined> {
    try {
      const keytar = await import('keytar')
      const token = await keytar.getPassword('slak', workspace.tokenLabel)
      return token || undefined
    } catch {
      // Keytar unavailable or token not found
      return undefined
    }
  }

  /**
   * Delete token from OS keychain for a workspace.
   */
  async deleteToken(workspace: WorkspaceConfig): Promise<void> {
    try {
      const keytar = await import('keytar')
      await keytar.deletePassword('slak', workspace.tokenLabel)
    } catch {
      // Keytar unavailable or already deleted
    }
  }
}

/**
 * Global singleton instance for workspace management.
 */
let manager: WorkspaceManager | null = null

export function getWorkspaceManager(): WorkspaceManager {
  if (!manager) {
    manager = new WorkspaceManager()
  }
  return manager
}
