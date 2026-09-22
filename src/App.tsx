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

export default function App() {
  const [phase, setPhase] = useState<'splash' | 'start' | 'workspace'>('splash')
  const chatOpen = useStore((s) => s.chatOpen)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const searchOpen = useStore((s) => s.searchOpen)
  const inspectorOpen = useStore((s) => s.inspectorOpen)
  const theme = useStore((s) => s.project.settings.theme)
  const [lightboxItem, setLightboxItem] = useState<any>(null)

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
          <TopBar />
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
      </div>
    </>
  )
}
