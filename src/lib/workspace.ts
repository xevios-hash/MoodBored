import { v4 as uuid } from 'uuid'
import type { Workspace, WorkspaceMeta, Project, SnapshotMeta } from '@/types'
import * as db from '@/lib/db'

export async function saveWorkspace(
  project: Project,
  name: string,
  description: string = '',
): Promise<Workspace> {
  const existing = project.workspaceId ? await db.getWorkspace(project.workspaceId) : null
  const now = new Date().toISOString()

  const workspace: Workspace = {
    id: existing?.id || uuid(),
    name,
    description,
    project: JSON.parse(JSON.stringify(project)),
    snapshots: existing?.snapshots || [],
    created: existing?.created || now,
    updated: now,
    pinned: existing?.pinned || false,
  }

  await db.saveWorkspace(workspace)
  return workspace
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  return db.getWorkspace(id)
}

export async function listWorkspaces(): Promise<WorkspaceMeta[]> {
  return db.listWorkspaces()
}

export async function deleteWorkspace(id: string): Promise<void> {
  return db.deleteWorkspace(id)
}

export async function togglePin(id: string): Promise<boolean> {
  const workspace = await db.getWorkspace(id)
  if (!workspace) return false
  workspace.pinned = !workspace.pinned
  workspace.updated = new Date().toISOString()
  await db.saveWorkspace(workspace)
  return workspace.pinned
}

export async function restoreWorkspace(id: string): Promise<Project | null> {
  const workspace = await db.getWorkspace(id)
  if (!workspace) return null
  return JSON.parse(JSON.stringify(workspace.project))
}

export async function addSnapshotToWorkspace(workspaceId: string, snapshot: SnapshotMeta): Promise<void> {
  const workspace = await db.getWorkspace(workspaceId)
  if (!workspace) return
  workspace.snapshots.push(snapshot)
  workspace.updated = new Date().toISOString()
  await db.saveWorkspace(workspace)
}

export function formatWorkspaceTime(created: string): string {
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