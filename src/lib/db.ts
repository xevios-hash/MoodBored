import { openDB, type IDBPDatabase } from 'idb'
import type { BoardItem, PortConnection, TypedConnection, Snapshot, SnapshotMeta, Workspace, WorkspaceMeta, Project } from '@/types'

const DB_NAME = 'moodbored-graph'
const DB_VERSION = 1

interface GraphDB {
  nodes: { key: string; value: NodeRow }
  edges: { key: string; value: EdgeRow }
  snapshots: { key: string; value: SnapshotRow }
  workspaces: { key: string; value: WorkspaceRow }
  history: { key: string; value: HistoryRow }
}

interface NodeRow {
  id: string
  viewportId: string
  kind: string
  data: BoardItem
  x: number
  y: number
  created: string
  updated: string
}

interface EdgeRow {
  id: string
  viewportId: string
  fromId: string
  fromPortId: string
  toId: string
  toPortId: string
  connectionType: string
  label: string
  owner: string
  created: string
}

interface SnapshotRow {
  id: string
  name: string
  description: string
  project: Project
  created: string
  tags: string[]
}

interface WorkspaceRow {
  id: string
  name: string
  description: string
  project: Project
  snapshots: SnapshotMeta[]
  created: string
  updated: string
  pinned: boolean
}

interface HistoryRow {
  id: string
  projectId: string
  action: string
  data: any
  timestamp: string
}

let dbInstance: IDBPDatabase<GraphDB> | null = null

async function getDB(): Promise<IDBPDatabase<GraphDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<GraphDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('nodes')) {
        const nodes = db.createObjectStore('nodes', { keyPath: 'id' })
        nodes.createIndex('viewportId', 'viewportId')
        nodes.createIndex('kind', 'kind')
      }
      if (!db.objectStoreNames.contains('edges')) {
        const edges = db.createObjectStore('edges', { keyPath: 'id' })
        edges.createIndex('viewportId', 'viewportId')
        edges.createIndex('fromId', 'fromId')
        edges.createIndex('toId', 'toId')
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('workspaces')) {
        db.createObjectStore('workspaces', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('history')) {
        const history = db.createObjectStore('history', { keyPath: 'id' })
        history.createIndex('projectId', 'projectId')
      }
    },
  })

  return dbInstance
}

// ─── Nodes ───────────────────────────────────────────────────────────

export async function saveNode(viewportId: string, item: BoardItem): Promise<void> {
  const db = await getDB()
  const pos = 'pos' in item ? item.pos : { x: 0, y: 0 }
  await db.put('nodes', {
    id: item.id,
    viewportId,
    kind: item.kind,
    data: item,
    x: pos.x,
    y: pos.y,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  })
}

export async function deleteNode(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('nodes', id)
}

export async function getNodes(viewportId: string): Promise<BoardItem[]> {
  const db = await getDB()
  const index = db.transaction('nodes').store.index('viewportId')
  const rows = await index.getAll(viewportId)
  return rows.map(r => r.data)
}

export async function getNode(id: string): Promise<BoardItem | null> {
  const db = await getDB()
  const row = await db.get('nodes', id)
  return row?.data ?? null
}

// ─── Edges ───────────────────────────────────────────────────────────

export async function saveEdge(viewportId: string, conn: TypedConnection): Promise<void> {
  const db = await getDB()
  await db.put('edges', {
    id: `${conn.fromItemId}:${conn.fromPortId}-${conn.toItemId}:${conn.toPortId}`,
    viewportId,
    fromId: conn.fromItemId,
    fromPortId: conn.fromPortId,
    toId: conn.toItemId,
    toPortId: conn.toPortId,
    connectionType: conn.connectionType,
    label: conn.label || '',
    owner: conn.owner,
    created: conn.created,
  })
}

export async function deleteEdge(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('edges', id)
}

export async function getEdges(viewportId: string): Promise<TypedConnection[]> {
  const db = await getDB()
  const index = db.transaction('edges').store.index('viewportId')
  const rows = await index.getAll(viewportId)
  return rows.map(r => ({
    fromItemId: r.fromId,
    fromPortId: r.fromPortId,
    toItemId: r.toId,
    toPortId: r.toPortId,
    connectionType: r.connectionType as any,
    label: r.label,
    owner: r.owner as any,
    created: r.created,
  }))
}

export async function getEdgesForNode(nodeId: string): Promise<TypedConnection[]> {
  const db = await getDB()
  const tx = db.transaction('edges')
  const fromIdx = tx.store.index('fromId')
  const toIdx = tx.store.index('toId')
  const fromEdges = await fromIdx.getAll(nodeId)
  const toEdges = await toIdx.getAll(nodeId)
  const all = [...fromEdges, ...toEdges]
  return all.map(r => ({
    fromItemId: r.fromId,
    fromPortId: r.fromPortId,
    toItemId: r.toId,
    toPortId: r.toPortId,
    connectionType: r.connectionType as any,
    label: r.label,
    owner: r.owner as any,
    created: r.created,
  }))
}

// ─── Snapshots ───────────────────────────────────────────────────────

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const db = await getDB()
  await db.put('snapshots', {
    id: snapshot.id,
    name: snapshot.name,
    description: snapshot.description,
    project: snapshot.project,
    created: snapshot.created,
    tags: snapshot.tags,
  })
}

export async function getSnapshot(id: string): Promise<Snapshot | null> {
  const db = await getDB()
  const row = await db.get('snapshots', id)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    project: row.project,
    created: row.created,
    tags: row.tags,
  }
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const db = await getDB()
  const rows = await db.getAll('snapshots')
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    created: r.created,
    tags: r.tags,
    itemCount: r.project.viewports?.[0]?.items?.length ?? 0,
  })).sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('snapshots', id)
}

// ─── Workspaces ──────────────────────────────────────────────────────

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const db = await getDB()
  await db.put('workspaces', {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    project: workspace.project,
    snapshots: workspace.snapshots,
    created: workspace.created,
    updated: workspace.updated,
    pinned: workspace.pinned,
  })
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const db = await getDB()
  const row = await db.get('workspaces', id)
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    project: row.project,
    snapshots: row.snapshots,
    created: row.created,
    updated: row.updated,
    pinned: row.pinned,
  }
}

export async function listWorkspaces(): Promise<WorkspaceMeta[]> {
  const db = await getDB()
  const rows = await db.getAll('workspaces')
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    created: r.created,
    updated: r.updated,
    pinned: r.pinned,
    boardCount: r.project?.viewports?.length ?? 0,
    itemCount: r.project?.viewports?.reduce((sum: number, v: any) => sum + (v.items?.length ?? 0), 0) ?? 0,
  })).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updated).getTime() - new Date(a.updated).getTime()
  })
}

export async function deleteWorkspace(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('workspaces', id)
}

// ─── History (action log) ────────────────────────────────────────────

export async function logAction(projectId: string, action: string, data: any): Promise<void> {
  const db = await getDB()
  await db.put('history', {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    projectId,
    action,
    data,
    timestamp: new Date().toISOString(),
  })
}

export async function getActionHistory(projectId: string, limit = 100): Promise<HistoryRow[]> {
  const db = await getDB()
  const index = db.transaction('history').store.index('projectId')
  const rows = await index.getAll(projectId)
  return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit)
}

// ─── Sync from project ───────────────────────────────────────────────

export async function syncProjectToGraph(project: Project): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['nodes', 'edges'], 'readwrite')
  const nodeStore = tx.objectStore('nodes')
  const edgeStore = tx.objectStore('edges')

  for (const viewport of project.viewports) {
    for (const item of viewport.items) {
      const pos = 'pos' in item ? item.pos : { x: 0, y: 0 }
      await nodeStore.put({
        id: item.id,
        viewportId: viewport.id,
        kind: item.kind,
        data: item,
        x: pos.x,
        y: pos.y,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      })
    }

    for (const conn of (viewport.typedConnections || [])) {
      await edgeStore.put({
        id: `${conn.fromItemId}:${conn.fromPortId}-${conn.toItemId}:${conn.toPortId}`,
        viewportId: viewport.id,
        fromId: conn.fromItemId,
        fromPortId: conn.fromPortId,
        toId: conn.toItemId,
        toPortId: conn.toPortId,
        connectionType: conn.connectionType,
        label: conn.label || '',
        owner: conn.owner,
        created: conn.created,
      })
    }
  }

  await tx.done
}