import { useState, useCallback, useEffect } from 'react'
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

export default function App() {
  const [phase, setPhase] = useState<'splash' | 'start' | 'workspace'>('splash')
  const chatOpen = useStore((s) => s.chatOpen)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const searchOpen = useStore((s) => s.searchOpen)
  const inspectorOpen = useStore((s) => s.inspectorOpen)
  const theme = useStore((s) => s.project.settings.theme)
  const [lightboxItem, setLightboxItem] = useState<any>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [unsplashOpen, setUnsplashOpen] = useState(false)

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
          <TopBar onExportForCreation={handleExportForCreation} onUnsplashSearch={handleUnsplashSearch} />
          <div className="flex flex-1 min-h-0">
            <Canvas />
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
