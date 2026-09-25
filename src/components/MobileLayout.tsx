import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { Canvas } from '@/components/Canvas'
import { ChatPanel } from '@/components/ChatPanel'
import { Inspector } from '@/components/Inspector'
import { SearchOverlay } from '@/components/SearchOverlay'
import { SettingsModal } from '@/components/SettingsModal'
import {
  MessageSquare, Layers, Settings, Search, Grid3X3, Plus,
} from 'lucide-react'

type Tab = 'canvas' | 'chat' | 'inspector'

const ITEM_TYPES = [
  { kind: 'note', icon: '📝', label: 'Note' },
  { kind: 'text', icon: '📄', label: 'Text' },
  { kind: 'image', icon: '🖼️', label: 'Image' },
  { kind: 'link', icon: '🔗', label: 'Link' },
  { kind: 'palette', icon: '🎨', label: 'Palette' },
  { kind: 'gradient', icon: '🌈', label: 'Gradient' },
  { kind: 'font', icon: '🔤', label: 'Font' },
  { kind: 'swatch', icon: '🟧', label: 'Color' },
  { kind: 'container', icon: '📦', label: 'Group' },
  { kind: 'video', icon: '🎬', label: 'Video' },
]

export function MobileLayout({ showSplash }: { showSplash: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('canvas')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const searchOpen = useStore((s) => s.searchOpen)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const toggleSearch = useStore((s) => s.toggleSearch)
  const addItem = useStore((s) => s.addItem)
  const canvas = useStore((s) => s.canvas)

  // Trigger canvas redraw when switching back to canvas tab
  useEffect(() => {
    if (activeTab === 'canvas') {
      window.dispatchEvent(new Event('resize'))
    }
  }, [activeTab])

  const handleAddItem = (kind: string) => {
    const cx = -canvas.panX / canvas.zoom + 200
    const cy = -canvas.panY / canvas.zoom + 200
    const defaults: Record<string, any> = {
      note: { kind: 'note', id: crypto.randomUUID(), text: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy } },
      text: { kind: 'text', id: crypto.randomUUID(), raw: '', pos: { x: cx, y: cy }, size: { w: 300, h: 200 } },
      image: { kind: 'image', id: crypto.randomUUID(), thumbnail: '', fullSource: '', description: '', source: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 300, h: 200 } },
      link: { kind: 'link', id: crypto.randomUUID(), url: '', title: '', summary: '', description: '', purpose: '', importance: '', source: '', tags: [], pos: { x: cx, y: cy } },
      palette: { kind: 'palette', id: crypto.randomUUID(), label: 'New Palette', colors: [{ hex: '#ff7eb3', label: '' }, { hex: '#8b7dc8', label: '' }, { hex: '#f0e080', label: '' }], purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 120 } },
      gradient: { kind: 'gradient', id: crypto.randomUUID(), label: 'New Gradient', stops: [{ position: 0, color: '#ff7eb3' }, { position: 1, color: '#8b7dc8' }], direction: 90, purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 300, h: 80 } },
      font: { kind: 'font', id: crypto.randomUUID(), fontFamily: 'Inter', weights: [400, 700], sampleText: 'The quick brown fox', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 160 } },
      swatch: { kind: 'swatch', id: crypto.randomUUID(), hex: '#8b7dc8', name: '', usage: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 160, h: 180 } },
      container: { kind: 'container', id: crypto.randomUUID(), label: 'New Group', children: [], layout: 'free', gap: 8, collapsed: false, purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 400, h: 300 } },
      video: { kind: 'video', id: crypto.randomUUID(), source: '', sourceUrl: '', startTs: 0, duration: 0, subjectDesc: '', motionDesc: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 240 } },
    }
    addItem(defaults[kind] || defaults.note)
    setShowAddMenu(false)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      background: 'var(--bg-canvas, #0c0814)',
      opacity: showSplash ? 0 : 1,
      transition: 'opacity 300ms ease',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        background: 'rgba(12,8,20,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(139,125,200,0.1)',
        zIndex: 20,
        gap: 8,
      }}>
        <button
          onClick={toggleSearch}
          style={{ background: 'none', border: 'none', color: '#8b7dc8', padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex' }}
        >
          <Search size={20} />
        </button>
        <input
          value={useStore.getState().project.name}
          onChange={(e) => useStore.getState().updateProjectName(e.target.value)}
          style={{
            flex: 1, minWidth: 0, background: 'rgba(139,125,200,0.08)', border: '1px solid rgba(139,125,200,0.15)',
            borderRadius: 8, padding: '6px 12px', fontSize: 15, fontWeight: 600,
            color: '#ede5f8', textAlign: 'center', outline: 'none', fontFamily: 'inherit',
          }}
          spellCheck={false}
        />
        <button
          onClick={toggleSettings}
          style={{ background: 'none', border: 'none', color: '#8b7dc8', padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex' }}
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Content — all tabs mounted, only active one visible */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Canvas — always mounted so draw loop keeps running */}
        <div style={{
          position: 'absolute', inset: 0,
          visibility: activeTab === 'canvas' ? 'visible' : 'hidden',
          pointerEvents: activeTab === 'canvas' ? 'auto' : 'none',
          zIndex: activeTab === 'canvas' ? 1 : 0,
        }}>
          <Canvas />
        </div>

        {/* Chat — mounted when visible */}
        {activeTab === 'chat' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            background: 'rgba(12,8,20,0.95)',
            zIndex: 2,
          }}>
            <ChatPanel />
          </div>
        )}

        {/* Inspector — mounted when visible */}
        {activeTab === 'inspector' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <Inspector />
          </div>
        )}
      </div>

      {/* Add item floating button + menu */}
      {activeTab === 'canvas' && (
        <div style={{ position: 'absolute', bottom: 72, right: 16, zIndex: 30 }}>
          {showAddMenu && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center',
              maxWidth: 200, padding: 8, marginBottom: 8, borderRadius: 12,
              background: 'rgba(12,8,20,0.92)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(139,125,200,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {ITEM_TYPES.map(({ kind, icon, label }) => (
                <button
                  key={kind}
                  onClick={() => handleAddItem(kind)}
                  title={label}
                  style={{
                    width: 40, height: 40, borderRadius: 8,
                    border: '1px solid rgba(139,125,200,0.1)',
                    background: 'rgba(139,125,200,0.05)',
                    color: '#b8a8d8', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            style={{
              width: 52, height: 52, borderRadius: '50%', border: 'none',
              background: showAddMenu
                ? 'linear-gradient(135deg, #ff7eb3, #e86a9e)'
                : 'linear-gradient(135deg, #8b7dc8, #9b8ce0)',
              color: '#fff', fontSize: 24, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(139,125,200,0.4)',
              transform: showAddMenu ? 'rotate(45deg)' : 'none',
              transition: 'all 200ms ease',
            }}
          >
            <Plus size={24} />
          </button>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '6px 0',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        background: 'rgba(12,8,20,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(139,125,200,0.1)',
        zIndex: 20,
      }}>
        <TabButton
          icon={<Grid3X3 size={20} />}
          label="Board"
          active={activeTab === 'canvas'}
          onClick={() => setActiveTab('canvas')}
        />
        <TabButton
          icon={<MessageSquare size={20} />}
          label="Chat"
          active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        />
        <TabButton
          icon={<Layers size={20} />}
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

function TabButton({ icon, label, active, onClick }: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '4px 20px', cursor: 'pointer',
        color: active ? '#8b7dc8' : '#7a6a9a',
        transition: 'color 150ms ease',
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  )
}