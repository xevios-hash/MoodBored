import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { Canvas } from '@/components/Canvas'
import { ChatPanel } from '@/components/ChatPanel'
import { Inspector } from '@/components/Inspector'
import { SearchOverlay } from '@/components/SearchOverlay'
import { SettingsModal } from '@/components/SettingsModal'
import { TopBar } from '@/components/TopBar'
import {
  MessageSquare, Layers, Settings, Search, Grid3X3,
} from 'lucide-react'

type Tab = 'canvas' | 'chat' | 'inspector' | 'settings'

export function MobileLayout({ showSplash }: { showSplash: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('canvas')
  const [chatHeight, setChatHeight] = useState(40) // percentage
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const searchOpen = useStore((s) => s.searchOpen)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const toggleSearch = useStore((s) => s.toggleSearch)

  const handleChatDragStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    dragStartY.current = e.touches[0].clientY
    dragStartHeight.current = chatHeight
  }

  const handleChatDragMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaY = dragStartY.current - e.touches[0].clientY
    const viewportHeight = window.innerHeight
    const deltaPercent = (deltaY / viewportHeight) * 100
    const newHeight = Math.max(10, Math.min(90, dragStartHeight.current + deltaPercent))
    setChatHeight(newHeight)
  }

  const handleChatDragEnd = () => {
    setIsDragging(false)
    if (chatHeight < 25) setChatHeight(10)
    else if (chatHeight > 75) setChatHeight(90)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      background: 'var(--bg-canvas)',
      opacity: showSplash ? 0 : 1,
      transition: 'opacity 300ms ease',
    }}>
      {/* Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        paddingTop: 'calc(8px + var(--safe-top))',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 10,
      }}>
        <button
          onClick={toggleSearch}
          style={{
            background: 'none', border: 'none', color: 'var(--accent)',
            padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex',
          }}
        >
          <Search size={22} />
        </button>

        <input
          value={useStore.getState().project.name}
          onChange={(e) => useStore.getState().updateProjectName(e.target.value)}
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--text-primary)',
            textAlign: 'center',
            flex: 1,
            margin: '0 12px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        <button
          onClick={toggleSettings}
          style={{
            background: 'none', border: 'none', color: 'var(--accent)',
            padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex',
          }}
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Canvas (always visible) */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: activeTab === 'canvas' ? 'block' : 'none',
        }}>
          <Canvas />
        </div>

        {/* Chat Panel (slides up from bottom) */}
        {activeTab === 'chat' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface-0)',
            animation: 'slideUp 200ms ease-out',
          }}>
            {/* Drag handle */}
            <div
              onTouchStart={handleChatDragStart}
              onTouchMove={handleChatDragMove}
              onTouchEnd={handleChatDragEnd}
              style={{
                padding: '12px 0',
                display: 'flex',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: 'none',
              }}
            >
              <div style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                background: 'var(--bg-surface-4)',
              }} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ChatPanel />
            </div>
          </div>
        )}

        {/* Inspector Panel */}
        {activeTab === 'inspector' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bg-surface-0)',
            animation: 'slideUp 200ms ease-out',
            overflow: 'hidden',
          }}>
            <Inspector />
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 0',
        paddingBottom: 'calc(8px + var(--safe-bottom))',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-subtle)',
        zIndex: 10,
      }}>
        <TabButton
          icon={<Grid3X3 size={22} />}
          label="Board"
          active={activeTab === 'canvas'}
          onClick={() => setActiveTab('canvas')}
        />
        <TabButton
          icon={<MessageSquare size={22} />}
          label="Chat"
          active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
          badge={useStore.getState().messages.filter(m => m.role !== 'system').length}
        />
        <TabButton
          icon={<Layers size={22} />}
          label="Inspect"
          active={activeTab === 'inspector'}
          onClick={() => setActiveTab('inspector')}
        />
      </div>

      {/* Modals */}
      {settingsOpen && <SettingsModal />}
      {searchOpen && <SearchOverlay />}
    </div>
  )
}

function TabButton({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '4px 16px',
        cursor: 'pointer',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'color 150ms ease',
        position: 'relative',
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          position: 'absolute',
          top: 0,
          right: 8,
          background: 'var(--danger)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          minWidth: 16,
          height: 16,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
