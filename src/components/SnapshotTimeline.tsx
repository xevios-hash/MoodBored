import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import type { SnapshotMeta } from '@/types'
import { formatSnapshotTime } from '@/lib/snapshot'

interface SnapshotTimelineProps {
  onClose: () => void
}

export function SnapshotTimeline({ onClose }: SnapshotTimelineProps) {
  const snapshots = useStore((s) => s.snapshots)
  const loadSnapshots = useStore((s) => s.loadSnapshots)
  const createSnapshot = useStore((s) => s.createSnapshot)
  const restoreSnapshot = useStore((s) => s.restoreSnapshot)
  const deleteSnapshot = useStore((s) => s.deleteSnapshot)
  const forkSnapshot = useStore((s) => s.forkSnapshot)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadSnapshots()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createSnapshot(newName.trim())
    setNewName('')
    setShowCreate(false)
  }

  return (
    <div className="glass-card" style={{ position: 'absolute', top: 40, right: 12, width: 320, maxHeight: 500, overflow: 'hidden', zIndex: 100 }}>
      <div className="flex justify-between items-center px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Snapshots</span>
        <div className="flex gap-1">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="status-bar-btn text-xs"
            title="Create snapshot"
          >
            +
          </button>
          <button onClick={onClose} className="status-bar-btn text-xs">×</button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Snapshot name..."
              className="flex-1 px-2 py-1 text-xs rounded bg-surface-0 border border-border focus:border-accent focus:outline-none"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false) }}
            />
            <button onClick={handleCreate} className="btn btn-accent text-xs px-2 py-1">Save</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
        {snapshots.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            No snapshots yet. Create one to save the current board state.
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            {snapshots.map((snap, idx) => (
              <SnapshotItem
                key={snap.id}
                snapshot={snap}
                isFirst={idx === 0}
                onRestore={() => restoreSnapshot(snap.id)}
                onDelete={() => deleteSnapshot(snap.id)}
                onFork={() => forkSnapshot(snap.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SnapshotItem({ snapshot, isFirst, onRestore, onDelete, onFork }: {
  snapshot: SnapshotMeta
  isFirst: boolean
  onRestore: () => void
  onDelete: () => void
  onFork: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="relative pl-8 pr-3 py-2 hover:bg-surface-2/50 transition-fast cursor-pointer"
      onClick={() => setShowActions(!showActions)}
    >
      {/* Timeline dot */}
      <div
        className={`absolute left-3 top-3 w-2.5 h-2.5 rounded-full border-2 ${
          isFirst ? 'bg-accent border-accent' : 'bg-surface-0 border-border'
        }`}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{snapshot.name}</div>
          {snapshot.description && (
            <div className="text-xs text-text-muted truncate mt-0.5">{snapshot.description}</div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs text-text-muted">{formatSnapshotTime(snapshot.created)}</span>
            <span className="text-2xs text-text-muted">·</span>
            <span className="text-2xs text-text-muted">{snapshot.itemCount} items</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-1 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            className="btn btn-ghost text-2xs px-2 py-0.5"
          >
            Restore
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFork(); }}
            className="btn btn-ghost text-2xs px-2 py-0.5"
          >
            Fork
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