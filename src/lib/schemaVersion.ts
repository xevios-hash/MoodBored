// Schema Versioning and Migration System
// Ensures old boards load cleanly with no data loss

export const CURRENT_SCHEMA_VERSION = 2

export interface SchemaVersionInfo {
  version: number
  migratedAt: string
  migrations: string[] // list of migration IDs applied
}

export interface Migration {
  id: string
  fromVersion: number
  toVersion: number
  description: string
  migrate: (board: any) => any
}

// Migration registry
const migrations: Migration[] = [
  {
    id: 'v1-to-v2-add-regions',
    fromVersion: 1,
    toVersion: 2,
    description: 'Add region support and schema version field',
    migrate: (board) => {
      // Add schema version if missing
      if (!board.schemaVersion) {
        board.schemaVersion = 2
      }

      // Add regions array to viewports if missing
      if (board.project?.viewports) {
        for (const viewport of board.project.viewports) {
          if (!viewport.regions) {
            viewport.regions = []
          }
        }
      }

      // Add provider field to settings if missing
      if (board.project?.settings && !board.project.settings.provider) {
        board.project.settings.provider = 'openrouter'
      }

      // Add empty lesson field if missing
      if (!board.lesson) {
        board.lesson = null
      }

      return board
    },
  },
  {
    id: 'v2-to-v3-add-connections-type',
    fromVersion: 2,
    toVersion: 3,
    description: 'Add typed connections support',
    migrate: (board) => {
      board.schemaVersion = 3

      // Add typedConnections array to viewports if missing
      if (board.project?.viewports) {
        for (const viewport of board.project.viewports) {
          if (!viewport.typedConnections) {
            viewport.typedConnections = []
          }
        }
      }

      return board
    },
  },
  {
    id: 'v3-to-v4-add-annotations',
    fromVersion: 3,
    toVersion: 4,
    description: 'Add annotations support',
    migrate: (board) => {
      board.schemaVersion = 4

      // Add annotations array if missing
      if (board.project && !board.project.annotations) {
        board.project.annotations = []
      }

      return board
    },
  },
]

export function getSchemaVersion(board: any): number {
  return board?.schemaVersion || 1
}

export function setSchemaVersion(board: any, version: number): any {
  board.schemaVersion = version
  return board
}

export function needsMigration(board: any): boolean {
  const version = getSchemaVersion(board)
  return version < CURRENT_SCHEMA_VERSION
}

export function getMigrationsToApply(board: any): Migration[] {
  const currentVersion = getSchemaVersion(board)
  return migrations.filter(m => m.fromVersion >= currentVersion && m.toVersion <= CURRENT_SCHEMA_VERSION)
}

export function migrateBoard(board: any): { board: any; migrationsApplied: string[] } {
  const migrationsToApply = getMigrationsToApply(board)
  let migratedBoard = { ...board }
  const applied: string[] = []

  for (const migration of migrationsToApply) {
    try {
      migratedBoard = migration.migrate(migratedBoard)
      applied.push(migration.id)
    } catch (err) {
      console.error(`Migration ${migration.id} failed:`, err)
      // Continue with other migrations
    }
  }

  // Ensure current version
  migratedBoard.schemaVersion = CURRENT_SCHEMA_VERSION

  return {
    board: migratedBoard,
    migrationsApplied: applied,
  }
}

export function validateBoard(board: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check required fields
  if (!board.project) {
    errors.push('Missing project field')
  }

  if (board.project) {
    if (!board.project.id) {
      errors.push('Missing project.id')
    }
    if (!board.project.name) {
      errors.push('Missing project.name')
    }
    if (!Array.isArray(board.project.viewports)) {
      errors.push('Missing or invalid project.viewports')
    }
  }

  // Check schema version
  if (board.schemaVersion && board.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(`Schema version ${board.schemaVersion} is newer than supported ${CURRENT_SCHEMA_VERSION}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function getDefaultBoard(): any {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: {
      id: crypto.randomUUID(),
      name: 'Untitled Board',
      viewports: [{
        id: crypto.randomUUID(),
        name: 'Main',
        items: [],
        connections: [],
        typedConnections: [],
        messages: [],
        regions: [],
        camX: 0,
        camY: 0,
        zoom: 1,
      }],
      components: [],
      settings: {
        apiKey: '',
        defaultModel: 'anthropic/claude-sonnet-4',
        provider: 'openrouter',
        jevThreshold: 0.2,
        multiAgent: false,
        theme: 'dark',
        canvasBg: '#0c0814',
        canvasBgType: 'color',
        canvasBgVideo: '',
        customBgUrls: [],
        customBgLabels: {},
      },
      annotations: [],
      snapshots: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },
    lesson: null,
    lastModified: new Date().toISOString(),
  }
}