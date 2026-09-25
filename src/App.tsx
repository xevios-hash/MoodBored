import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { Settings } from 'lucide-react'
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
import { ColorPicker } from '@/components/ColorPicker'
import { PresenceBar, RemoteCursors } from '@/components/Presence'
import { joinBoard, getShareByToken, broadcastCursor, broadcastSelection, type PresenceUser, type ShareRole, type CollaborationState } from '@/lib/collaboration'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── URL Params (read once, before React renders) ───────────────────

const URL_PARAMS = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
const PATH_BOARD_ID = typeof window !== 'undefined' ? window.location.pathname.match(/\/board\/([^/?]+)/)?.[1] ?? null : null
const EMBED_BOARD_ID = URL_PARAMS.get('board') || PATH_BOARD_ID
const IS_EMBED = URL_PARAMS.has('embed') || !!PATH_BOARD_ID
const EMBED_READONLY = URL_PARAMS.has('readonly')
const EMBED_THEME = URL_PARAMS.get('theme') as 'dark' | 'light' | null
const EMBED_PROJECT_ID = URL_PARAMS.get('project')

// Detect if running inside an iframe (auto-enable embed if no explicit param)
const IS_IFRAME = typeof window !== 'undefined' && window.self !== window.top

// ─── Auto-load project for embed/board modes ────────────────────────

async function loadEmbedProject(): Promise<boolean> {
  const store = useStore.getState()
  // ?board=<id> — load from server
  if (EMBED_BOARD_ID) {
    try {
      const base = window.location.origin
      const url = `${base}/api/board/${EMBED_BOARD_ID}`
      console.info('[MoodBored] Loading board from:', url)
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (data.project) {
          store.setProject(data.project)
          console.info('[MoodBored] Board loaded:', data.project.name, '—', data.project.viewports?.[0]?.items?.length, 'items')
          return true
        }
      } else {
        console.warn('[MoodBored] Board fetch failed:', res.status)
      }
    } catch (err) {
      console.error('[MoodBored] Board load error:', err)
    }
  }
  // ?project=<id> — load from IndexedDB
  if (EMBED_PROJECT_ID) {
    try {
      const { getProject } = await import('@/lib/storage')
      const project = await getProject(EMBED_PROJECT_ID)
      if (project) {
        store.setProject(project)
        console.info('[MoodBored] Project loaded from IndexedDB:', project.name)
        return true
      }
    } catch {}
  }
  console.warn('[MoodBored] No board found — using default project')
  return false
}

// ─── Bidirectional sync bridge ──────────────────────────────────────
// When running in embed mode with a board ID, subscribe to server-side
// changes via SSE so the canvas updates when MCP tools write to the board.

function initBoardSync(boardId: string | null) {
  if (!boardId) return () => {}
  const base = window.location.origin
  let es: EventSource | null = null
  let disposed = false

  const connect = () => {
    if (disposed) return
    es = new EventSource(`${base}/api/board/${boardId}/events`)
    es.onmessage = (event) => {
      if (disposed) return
      try {
        const data = JSON.parse(event.data)
        if (data.project) {
          useStore.getState().setProject(data.project)
        }
      } catch {}
    }
    es.onerror = () => {
      // Reconnect after 2s
      es?.close()
      if (!disposed) setTimeout(connect, 2000)
    }
  }
  connect()

  return () => {
    disposed = true
    es?.close()
  }
}

// ─── Main App ───────────────────────────────────────────────────────

function isDark() { return document.body.classList.contains('dark') }

export default function App() {
  const isEmbed = IS_EMBED || (IS_IFRAME && !URL_PARAMS.has('token'))
  const [phase, setPhase] = useState<'splash' | 'start' | 'workspace'>(isEmbed ? 'workspace' : 'splash')
  const [embedReady, setEmbedReady] = useState(!isEmbed)
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
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [embedSettingsOpen, setEmbedSettingsOpen] = useState(false)

  // Collaboration state
  const [collab, setCollab] = useState<CollaborationState>({
    shareToken: null, role: 'viewer', users: [], channel: null, isConnected: false,
  })
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [remoteUsers, setRemoteUsers] = useState<PresenceUser[]>([])

  // ─── Theme ───
  useEffect(() => {
    const t = EMBED_THEME || theme
    document.body.classList.remove('light', 'dark')
    document.body.classList.add(t)
  }, [theme, EMBED_THEME])

  // ─── Embed: auto-load project + init sync ───
  useEffect(() => {
    if (!isEmbed) return
    ;(async () => {
      await loadEmbedProject()
      // Override chrome settings for embed mode
      useStore.setState({
        sidebarOpen: false,
        chatOpen: false,
        inspectorOpen: false,
      })
      setEmbedReady(true)
    })()
  }, [isEmbed])

  // ─── Embed: bidirectional sync with server ───
  useEffect(() => {
    if (!isEmbed || !embedReady) return
    return initBoardSync(EMBED_BOARD_ID)
  }, [isEmbed, embedReady])

  // ─── Embed: listen for PostMessage from parent frame ───
  useEffect(() => {
    if (!isEmbed) return
    const handler = (e: MessageEvent) => {
      const data = e.data
      if (!data || typeof data !== 'object') return
      const store = useStore.getState()
      switch (data.type) {
        case 'loadProject':
          if (data.project) store.setProject(data.project)
          break
        case 'setTheme':
          if (data.theme) store.updateSettings({ theme: data.theme })
          break
        case 'export':
          const json = store.exportProject()
          window.parent?.postMessage({ type: 'exportResult', json }, '*')
          break
        case 'focusItem': {
          const vp = store.project.viewports.find(v => v.id === store.activeViewportId)
          const item = vp?.items.find(i => i.id === data.id)
          if (item && 'pos' in item) {
            store.setZoom(1.5)
            const r = document.querySelector('canvas')?.getBoundingClientRect()
            if (r) store.setPan(r.width / 2 - item.pos.x * 1.5, r.height / 2 - item.pos.y * 1.5)
          }
          break
        }
        case 'addItems':
          if (Array.isArray(data.items)) {
            for (const item of data.items) store.addItem(item)
          }
          break
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isEmbed])

  // ─── Mobile detection ───
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || ''
      const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      const w = window.visualViewport?.width ?? window.innerWidth
      setIsMobile(isIOS || w < 768)
    }
    check()
    window.visualViewport?.addEventListener('resize', check)
    window.addEventListener('resize', check)
    return () => {
      window.visualViewport?.removeEventListener('resize', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  // ─── Lightbox events ───
  useEffect(() => {
    const handler = (e: CustomEvent) => setLightboxItem(e.detail)
    window.addEventListener('moodbored:lightbox' as any, handler)
    return () => window.removeEventListener('moodbored:lightbox' as any, handler)
  }, [])

  const handleSplashComplete = useCallback(() => setPhase('start'), [])
  const handleProjectLoaded = useCallback(() => setPhase('workspace'), [])
  const handleExportForCreation = useCallback(() => setExportModalOpen(true), [])
  const handleUnsplashSearch = useCallback(() => setUnsplashOpen(true), [])
  const handleShareOpen = useCallback(() => setShareOpen(true), [])
  const handleColorPickerOpen = useCallback(() => setColorPickerOpen(true), [])

  const canEdit = isEmbed ? !EMBED_READONLY : (collab.role === 'editor' || !collab.shareToken)

  // ─── Share token (non-embed only) ───
  useEffect(() => {
    if (isEmbed) return
    const token = URL_PARAMS.get('token')
    if (token && phase === 'workspace') {
      getShareByToken(token).then((share) => {
        if (share) setCollab((prev) => ({ ...prev, shareToken: token, role: share.role }))
      })
    }
  }, [phase, isEmbed])

  // ─── Realtime channel (non-embed only) ───
  useEffect(() => {
    if (isEmbed || phase !== 'workspace') return
    const project = useStore.getState().project
    const { channel, leave } = joinBoard(project.id, collab.shareToken, {
      onUserJoin: (user) => setRemoteUsers((prev) => prev.some(u => u.id === user.id) ? prev : [...prev, user]),
      onUserLeave: (userId) => setRemoteUsers((prev) => prev.filter(u => u.id !== userId)),
      onCursorMove: (userId, cursor) => setRemoteUsers((prev) => prev.map(u => u.id === userId ? { ...u, cursor } : u)),
      onSelectionChange: (userId, itemId) => setRemoteUsers((prev) => prev.map(u => u.id === userId ? { ...u, selectedItemId: itemId } : u)),
      onBoardChange: () => {},
    })
    channelRef.current = channel
    setCollab((prev) => ({ ...prev, channel, isConnected: true }))
    return leave
  }, [phase, collab.shareToken, isEmbed])

  // ─── Cursor/selection broadcast (non-embed only) ───
  useEffect(() => {
    if (isEmbed) return
    const handler = (e: MouseEvent) => {
      const state = useStore.getState()
      broadcastCursor(channelRef.current, {
        x: (e.clientX - state.canvas.panX) / state.canvas.zoom,
        y: (e.clientY - state.canvas.panY) / state.canvas.zoom,
      })
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [isEmbed])

  useEffect(() => {
    if (!isEmbed) broadcastSelection(channelRef.current, [...selectedIds][0] ?? null)
  }, [selectedIds, isEmbed])

  // ─── Embed mode: canvas only + background settings ───
  if (isEmbed) {
    if (!embedReady) return null
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-surface-0)', position: 'relative' }}>
        <Canvas />
        <button
          onClick={() => setEmbedSettingsOpen(true)}
          className="toolbar-btn"
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, background: isDark() ? 'rgba(12,8,20,0.8)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: 8, border: `1px solid ${isDark() ? 'rgba(124,108,191,0.1)' : 'rgba(0,0,0,0.06)'}` }}
          title="Board settings"
        >
          <Settings size={16} />
        </button>
        {embedSettingsOpen && <SettingsModal embed onClose={() => setEmbedSettingsOpen(false)} />}
      </div>
    )
  }

  // ─── Mobile layout ───
  if (isMobile && phase === 'workspace') {
    return (
      <>
        {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}
        <MobileLayout showSplash={false} />
      </>
    )
  }

  // ─── Splash ───
  if (phase === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  // ─── Start screen ───
  if (phase === 'start') {
    return <StartScreen onProjectLoaded={handleProjectLoaded} />
  }

  // ─── Full workspace ───
  return (
    <>
      {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}

      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-surface-0)' }}>
        <div className={`transition-all duration-200 ease-in-out ${sidebarOpen ? 'w-56 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
          <Sidebar />
        </div>
        <main className="flex flex-col flex-1 min-w-0">
          <TopBar onExportForCreation={handleExportForCreation} onUnsplashSearch={handleUnsplashSearch} onShare={handleShareOpen} onColorPicker={handleColorPickerOpen} presenceBar={<PresenceBar users={remoteUsers} isConnected={collab.isConnected} />} />
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
        {colorPickerOpen && <ColorPicker onClose={() => setColorPickerOpen(false)} />}
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
  return <ExportModal items={items} boardName={project.name} onClose={onClose} />
}
