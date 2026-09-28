import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import type { WorkspaceMeta } from '@/types'
import { formatWorkspaceTime } from '@/lib/workspace'

interface WorkspaceManagerProps {
  onClose: () => void
}

export function WorkspaceManager({ onClose }: WorkspaceManagerProps) {
  const workspaces = useStore((s) => s.workspaces)
  const loadWorkspaces = useStore((s) => s.loadWorkspaces)
  const saveWorkspace = useStore((s) => s.saveWorkspace)
  const restoreWorkspace = useStore((s) => s.restoreWorkspace)
  const deleteWorkspace = useStore((s) => s.deleteWorkspace)
  const togglePinWorkspace = useStore((s) => s.togglePinWorkspace)
  const [showSave, setShowSave] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const handleSave = async () => {
    if (!name.trim()) return
    await saveWorkspace(name.trim(), description.trim())
    setName('')
    setDescription('')
    setShowSave(false)
  }

  const pinned = workspaces.filter(w => w.pinned)
  const unpinned = workspaces.filter(w => !w.pinned)

  return (
    <div className="glass-card" style={{ position: 'absolute', top: 40, right: 12, width: 340, maxHeight: 500, overflow: 'hidden', zIndex: 100 }}>
      <div className="flex justify-between items-center px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Workspaces</span>
        <div className="flex gap-1">
          <button
            onClick={() => setShowSave(!showSave)}
            className="status-bar-btn text-xs"
            title="Save current workspace"
          >
            Save
          </button>
          <button onClick={onClose} className="status-bar-btn text-xs">×</button>
        </div>
      </div>

      {/* Save form */}
      {showSave && (
        <div className="px-3 py-2 border-b border-border space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name..."
            className="w-full px-2 py-1 text-xs rounded bg-surface-0 border border-border focus:border-accent focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full px-2 py-1 text-xs rounded bg-surface-0 border border-border focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSave(false)} className="btn btn-ghost text-xs px-2 py-1">Cancel</button>
            <button onClick={handleSave} className="btn btn-accent text-xs px-2 py-1">Save</button>
          </div>
        </div>
      )}

      {/* Workspace list */}
      <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
        {workspaces.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            No saved workspaces. Save the current board as a workspace.
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-2xs font-semibold text-text-muted uppercase tracking-wider bg-surface-1">
                  Pinned
                </div>
                {pinned.map(ws => (
                  <WorkspaceItem
                    key={ws.id}
                    workspace={ws}
                    onRestore={() => restoreWorkspace(ws.id)}
                    onDelete={() => deleteWorkspace(ws.id)}
                    onTogglePin={() => togglePinWorkspace(ws.id)}
                  />
                ))}
              </div>
            )}
            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <div className="px-3 py-1.5 text-2xs font-semibold text-text-muted uppercase tracking-wider bg-surface-1">
                    Recent
                  </div>
                )}
                {unpinned.map(ws => (
                  <WorkspaceItem
                    key={ws.id}
                    workspace={ws}
                    onRestore={() => restoreWorkspace(ws.id)}
                    onDelete={() => deleteWorkspace(ws.id)}
                    onTogglePin={() => togglePinWorkspace(ws.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function WorkspaceItem({ workspace, onRestore, onDelete, onTogglePin }: {
  workspace: WorkspaceMeta
  onRestore: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="px-3 py-2 hover:bg-surface-2/50 transition-fast cursor-pointer border-b border-border/50"
      onClick={() => setShowActions(!showActions)}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`text-xs ${workspace.pinned ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
          title={workspace.pinned ? 'Unpin' : 'Pin'}
        >
          {workspace.pinned ? '📌' : '📎'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{workspace.name}</div>
          {workspace.description && (
            <div className="text-xs text-text-muted truncate">{workspace.description}</div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xs text-text-muted">{formatWorkspaceTime(workspace.updated)}</span>
            <span className="text-2xs text-text-muted">·</span>
            <span className="text-2xs text-text-muted">{workspace.boardCount} boards</span>
            <span className="text-2xs text-text-muted">·</span>
            <span className="text-2xs text-text-muted">{workspace.itemCount} items</span>
          </div>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-1 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            className="btn btn-accent text-2xs px-2 py-0.5"
          >
            Open
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="btn btn-ghost text-2xs px-2 py-0.5 text-danger"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}