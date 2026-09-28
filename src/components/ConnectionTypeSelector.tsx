import { useState } from 'react'
import type { ConnectionType } from '@/types'

const CONNECTION_TYPES: { type: ConnectionType; label: string; icon: string; color: string }[] = [
  { type: 'citation', label: 'Citation', icon: '📎', color: '#6aa8d8' },
  { type: 'dependency', label: 'Dependency', icon: '🔗', color: '#e88098' },
  { type: 'contradiction', label: 'Contradiction', icon: '⚡', color: '#e89060' },
  { type: 'related', label: 'Related', icon: '↔️', color: '#78c8a0' },
  { type: 'mcp', label: 'MCP', icon: '🔌', color: '#a888d8' },
  { type: 'api', label: 'API', icon: '🌐', color: '#d87898' },
  { type: 'custom', label: 'Custom', icon: '✏️', color: '#8888aa' },
]

interface ConnectionTypeSelectorProps {
  onSelect: (type: ConnectionType, label?: string) => void
  onClose: () => void
  position: { x: number; y: number }
}

export function ConnectionTypeSelector({ onSelect, onClose, position }: ConnectionTypeSelectorProps) {
  const [customLabel, setCustomLabel] = useState('')
  const [selectedType, setSelectedType] = useState<ConnectionType>('related')

  const handleSelect = (type: ConnectionType) => {
    setSelectedType(type)
    if (type !== 'custom') {
      onSelect(type)
      onClose()
    }
  }

  const handleCustomLabel = () => {
    if (customLabel.trim()) {
      onSelect('custom', customLabel.trim())
      onClose()
    }
  }

  return (
    <div
      className="glass-card"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 100,
        padding: 4,
        minWidth: 180,
      }}
      onMouseLeave={onClose}
    >
      <div className="px-2 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider">
        Connection Type
      </div>
      {CONNECTION_TYPES.map(({ type, label, icon, color }) => (
        <button
          key={type}
          onClick={() => handleSelect(type)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-fast hover:bg-surface-2 text-text-primary"
        >
          <span>{icon}</span>
          <span className="flex-1">{label}</span>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        </button>
      ))}

      {selectedType === 'custom' && (
        <div className="px-2 py-1.5 border-t border-border mt-1">
          <div className="flex gap-1">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Custom label..."
              className="flex-1 px-2 py-1 text-xs rounded bg-surface-0 border border-border focus:border-accent focus:outline-none"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCustomLabel(); if (e.key === 'Escape') onClose() }}
            />
            <button onClick={handleCustomLabel} className="btn btn-accent text-2xs px-2 py-0.5">OK</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function getConnectionColor(type: ConnectionType): string {
  const conn = CONNECTION_TYPES.find(c => c.type === type)
  return conn?.color || '#8888aa'
}

export function getConnectionIcon(type: ConnectionType): string {
  const conn = CONNECTION_TYPES.find(c => c.type === type)
  return conn?.icon || '↔️'
}

export function getConnectionLabel(type: ConnectionType): string {
  const conn = CONNECTION_TYPES.find(c => c.type === type)
  return conn?.label || 'Custom'
}