import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import { Sidebar } from '@/components/Sidebar'
import { Canvas } from '@/components/Canvas'
import { ChatPanel } from '@/components/ChatPanel'
import { Inspector } from '@/components/Inspector'
import { SearchOverlay } from '@/components/SearchOverlay'
import { SettingsModal } from '@/components/SettingsModal'
import { TopBar } from '@/components/TopBar'
import { SplashScreen } from '@/components/SplashScreen'
import { StartScreen } from '@/components/StartScreen'
import { MobileLayout } from '@/components/MobileLayout'
import { Lightbox } from '@/components/Lightbox'
import { ExportModal } from '@/components/ExportModal'
import { UnsplashSearch } from '@/components/UnsplashSearch'
import { ShareModal } from '@/components/ShareModal'
import { PresenceBar, RemoteCursors } from '@/components/Presence'
import { joinBoard, getShareByToken, broadcastCursor, broadcastSelection, type PresenceUser, type ShareRole, type CollaborationState } from '@/lib/collaboration'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function App() {
  const [phase, setPhase] = useState<'splash' | 'start' | 'workspace'>('splash')
  const chatOpen = useStore((s) => s.chatOpen)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const searchOpen = useStore((s) => s.searchOpen)
  const inspectorOpen = useStore((s) => s.inspectorOpen)
  const theme = useStore((s) => s.project.settings.theme)
  const canvas = useStore((s) => s.canvas)
  const selectedIds = useStore((s) => s.selectedIds)
  const [lightboxItem, setLightboxItem] = useState<any>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [unsplashOpen, setUnsplashOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  // Collaboration state
  const [collab, setCollab] = useState<CollaborationState>({
    shareToken: null, role: 'viewer', users: [], channel: null, isConnected: false,
  })
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [remoteUsers, setRemoteUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    document.body.classList.remove('light', 'dark')
    document.body.classList.add(theme)
  }, [theme])

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || ''
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      setIsMobile(isIOS || window.innerWidth < 768)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Listen for lightbox events from Canvas
  useEffect(() => {
    const handler = (e: CustomEvent) => setLightboxItem(e.detail)
    window.addEventListener('moodbored:lightbox' as any, handler)
    return () => window.removeEventListener('moodbored:lightbox' as any, handler)
  }, [])

  const handleSplashComplete = useCallback(() => {
    setPhase('start')
  }, [])

  const handleProjectLoaded = useCallback(() => {
    setPhase('workspace')
  }, [])

  const handleExportForCreation = useCallback(() => {
    setExportModalOpen(true)
  }, [])

  const handleUnsplashSearch = useCallback(() => {
    setUnsplashOpen(true)
  }, [])

  const handleShareOpen = useCallback(() => {
    setShareOpen(true)
  }, [])

  // Role enforcement
  const canEdit = collab.role === 'editor' || !collab.shareToken

  // Check URL for share token on load (board joining)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token && phase === 'workspace') {
      getShareByToken(token).then((share) => {
        if (share) {
          setCollab((prev) => ({ ...prev, shareToken: token, role: share.role }))
        }
      })
    }
  }, [phase])

  // Join Realtime channel when in workspace
  useEffect(() => {
    if (phase !== 'workspace') return
    const project = useStore.getState().project
    const { channel, leave } = joinBoard(project.id, collab.shareToken, {
      onUserJoin: (user) => {
        setRemoteUsers((prev) => prev.some(u => u.id === user.id) ? prev : [...prev, user])
      },
      onUserLeave: (userId) => {
        setRemoteUsers((prev) => prev.filter(u => u.id !== userId))
      },
      onCursorMove: (userId, cursor) => {
        setRemoteUsers((prev) => prev.map(u => u.id === userId ? { ...u, cursor } : u))
      },
      onSelectionChange: (userId, itemId) => {
        setRemoteUsers((prev) => prev.map(u => u.id === userId ? { ...u, selectedItemId: itemId } : u))
      },
      onBoardChange: () => {
        // Board changed by remote user — the store will sync via Supabase
      },
    })
    channelRef.current = channel
    setCollab((prev) => ({ ...prev, channel, isConnected: true }))
    return leave
  }, [phase, collab.shareToken])

  // Broadcast cursor position on mouse move
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const state = useStore.getState()
      const worldX = (e.clientX - state.canvas.panX) / state.canvas.zoom
      const worldY = (e.clientY - state.canvas.panY) / state.canvas.zoom
      broadcastCursor(channelRef.current, { x: worldX, y: worldY })
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  // Broadcast selection changes
  useEffect(() => {
    broadcastSelection(channelRef.current, [...selectedIds][0] ?? null)
  }, [selectedIds])

  // Mobile layout
  if (isMobile && phase === 'workspace') {
    return (
      <>
        {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
        <MobileLayout showSplash={false} />
      </>
    )
  }

  // Splash
  if (phase === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  // Start screen
  if (phase === 'start') {
    return <StartScreen onProjectLoaded={handleProjectLoaded} />
  }

  // Workspace
  return (
    <>
      {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}

      <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-surface-0)' }}>
        <div className={`transition-all duration-200 ease-in-out ${sidebarOpen ? 'w-56 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
          <Sidebar />
        </div>
        <main className="flex flex-col flex-1 min-w-0">
          <TopBar onExportForCreation={handleExportForCreation} onUnsplashSearch={handleUnsplashSearch} onShare={handleShareOpen} presenceBar={<PresenceBar users={remoteUsers} isConnected={collab.isConnected} />} />
          <div className="flex flex-1 min-h-0 relative">
            <Canvas />
            <RemoteCursors users={remoteUsers} canvasPanX={canvas.panX} canvasPanY={canvas.panY} canvasZoom={canvas.zoom} />
            {!canEdit && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-lg bg-amber-500/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm">
                View-only mode — ask the board owner for edit access
              </div>
            )}
            <div className={`transition-all duration-200 ease-in-out ${chatOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
              <ChatPanel />
            </div>
            <div className={`transition-all duration-200 ease-in-out ${inspectorOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
              <Inspector />
            </div>
          </div>
        </main>
        {settingsOpen && <SettingsModal />}
        {searchOpen && <SearchOverlay />}
        {exportModalOpen && <ExportModalWrapper onClose={() => setExportModalOpen(false)} />}
        {unsplashOpen && <UnsplashSearch onClose={() => setUnsplashOpen(false)} />}
        {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      </div>
    </>
  )
}

function ExportModalWrapper({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)
  const activeViewportId = useStore((s) => s.activeViewportId)
  const selectedIds = useStore((s) => s.selectedIds)
  const viewport = project.viewports.find(v => v.id === activeViewportId) ?? project.viewports[0]
  const allItems = viewport?.items ?? []
  const selectedItems = allItems.filter(i => selectedIds.has(i.id))
  const items = selectedItems.length > 0 ? selectedItems : allItems
  const label = selectedItems.length > 0
    ? `${selectedItems.length} selected items`
    : `All ${allItems.length} items on "${viewport?.name}"`

  return <ExportModal items={items} boardName={project.name} onClose={onClose} />
}
