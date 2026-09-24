import { useState, useEffect, useRef, useCallback } from 'react'
import { Users } from 'lucide-react'
import { getSessionInfo, type PresenceUser } from '@/lib/collaboration'

interface Props {
  users: PresenceUser[]
  isConnected: boolean
}

export function PresenceBar({ users, isConnected }: Props) {
  const self = getSessionInfo()
  const allUsers = [
      { id: self.id, name: self.name, color: self.color, cursor: null, selectedItemId: null, joinedAt: Date.now() },
      ...users,
    ]

  if (!isConnected) return null

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-2/80 backdrop-blur-sm">
      <Users size={12} className="text-text-muted" />
      <div className="flex -space-x-1.5">
        {allUsers.slice(0, 5).map((user) => (
          <div
            key={user.id}
            className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold text-white border-2 border-surface-0"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0)}
          </div>
        ))}
        {allUsers.length > 5 && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold text-text-muted bg-surface-3 border-2 border-surface-0">
            +{allUsers.length - 5}
          </div>
        )}
      </div>
      <span className="text-2xs text-text-muted ml-1">{allUsers.length} online</span>
    </div>
  )
}

// ─── Remote Cursor Overlay ──────────────────────────────────────────
// Renders other users' cursors on top of the canvas as HTML elements.

interface RemoteCursorProps {
  users: PresenceUser[]
  canvasPanX: number
  canvasPanY: number
  canvasZoom: number
}

export function RemoteCursors({ users, canvasPanX, canvasPanY, canvasZoom }: RemoteCursorProps) {
  return (
    <>
      {users.filter(u => u.cursor).map((user) => {
        const screenX = user.cursor!.x * canvasZoom + canvasPanX
        const screenY = user.cursor!.y * canvasZoom + canvasPanY
        return (
          <div
            key={user.id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              pointerEvents: 'none',
              zIndex: 50,
              transition: 'left 50ms linear, top 50ms linear',
            }}
          >
            {/* Cursor arrow */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
              <path d="M0 0L16 12L8 12L4 20L0 0Z" fill={user.color} />
            </svg>
            {/* Name tag */}
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: 14,
                background: user.color,
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
            >
              {user.name}
            </div>
          </div>
        )
      })}
    </>
  )
}