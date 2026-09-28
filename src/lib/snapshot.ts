import { v4 as uuid } from 'uuid'
import type { Snapshot, SnapshotMeta, Project } from '@/types'
import * as db from '@/lib/db'

export async function createSnapshot(
  project: Project,
  name: string,
  description: string = '',
  tags: string[] = [],
): Promise<Snapshot> {
  const snapshot: Snapshot = {
    id: uuid(),
    name,
    description,
    project: JSON.parse(JSON.stringify(project)),
    created: new Date().toISOString(),
    tags,
  }
  await db.saveSnapshot(snapshot)
  return snapshot
}

export async function getSnapshot(id: string): Promise<Snapshot | null> {
  return db.getSnapshot(id)
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  return db.listSnapshots()
}

export async function deleteSnapshot(id: string): Promise<void> {
  return db.deleteSnapshot(id)
}

export async function forkFromSnapshot(snapshotId: string, newName?: string): Promise<Project | null> {
  const snapshot = await db.getSnapshot(snapshotId)
  if (!snapshot) return null

  const forked: Project = {
    ...JSON.parse(JSON.stringify(snapshot.project)),
    id: uuid(),
    name: newName || `${snapshot.project.name} (fork)`,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    snapshots: [],
  }
  return forked
}

export async function restoreSnapshot(snapshotId: string): Promise<Project | null> {
  const snapshot = await db.getSnapshot(snapshotId)
  if (!snapshot) return null
  return JSON.parse(JSON.stringify(snapshot.project))
}

export function formatSnapshotTime(created: string): string {
  const date = new Date(created)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}