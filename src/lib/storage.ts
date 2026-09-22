import { openDB, type IDBPDatabase } from 'idb'
import type { Project, ComponentDef } from '@/types'

const DB_NAME = 'moodbored'
const DB_VERSION = 1

interface MoodBoredDB {
  projects: { key: string; value: ProjectMeta }
  components: { key: string; value: ComponentDef }
  settings: { key: string; value: string }
}

export interface ProjectMeta {
  id: string
  name: string
  description: string
  template: string
  thumbnail?: string
  created: string
  updated: string
  data?: Project // full project data, stored separately for large projects
}

let dbInstance: IDBPDatabase<MoodBoredDB> | null = null

async function getDB(): Promise<IDBPDatabase<MoodBoredDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<MoodBoredDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('components')) {
        db.createObjectStore('components', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

// ─── Projects ───────────────────────────────────────────────────────

export async function createProject(name: string, description: string, template: string, data: Project): Promise<ProjectMeta> {
  const db = await getDB()
  const meta: ProjectMeta = {
    id: data.id,
    name,
    description,
    template,
    created: data.created,
    updated: data.updated,
    data,
  }
  await db.put('projects', meta)
  return meta
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDB()
  const meta = await db.get('projects', id)
  return meta?.data ?? null
}

export async function getProjectMeta(id: string): Promise<ProjectMeta | null> {
  const db = await getDB()
  return (await db.get('projects', id)) ?? null
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await getDB()
  const all = await db.getAll('projects')
  return all.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
}

export async function updateProject(id: string, data: Project): Promise<void> {
  const db = await getDB()
  const existing = await db.get('projects', id)
  if (!existing) {
    // Upsert: also covers store-hydrated changes to a project saved elsewhere
    await db.put('projects', {
      id: data.id,
      name: data.name,
      description: '',
      template: 'blank',
      created: data.created,
      updated: data.updated,
      data,
    })
    return
  }
  const updated: ProjectMeta = {
    ...existing,
    name: data.name,
    updated: data.updated,
    data,
  }
  await db.put('projects', updated)
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', id)
}

// ─── Components (saved templates) ───────────────────────────────────

export async function saveComponent(comp: ComponentDef): Promise<void> {
  const db = await getDB()
  await db.put('components', comp)
}

export async function listComponents(): Promise<ComponentDef[]> {
  const db = await getDB()
  return db.getAll('components')
}

export async function deleteComponent(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('components', id)
}

// ─── Settings ───────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDB()
  const row = await db.get('settings', key)
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value })
}

// ─── Migration from localStorage ────────────────────────────────────

export async function migrateFromLocalStorage(): Promise<void> {
  const existing = localStorage.getItem('moodbored-storage')
  if (!existing) return

  try {
    const parsed = JSON.parse(existing)
    if (parsed?.state?.project) {
      const project = parsed.state.project
      await createProject(
        project.name || 'Migrated Project',
        'Migrated from localStorage',
        'blank',
        project
      )
      // Clear localStorage after migration
      localStorage.removeItem('moodbored-storage')
      console.log('[MoodBored] Migrated project from localStorage to IndexedDB')
    }
  } catch (e) {
    console.warn('[MoodBored] Failed to migrate from localStorage:', e)
  }
}
