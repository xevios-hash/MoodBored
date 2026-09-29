import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/stores/useStore'
import {
  Search, PanelLeft, MessageSquare, Settings, MoreVertical,
  Download, Upload, FileText, Camera, FolderOpen, Globe,
  ImageIcon, Share2, Palette, Sparkles, LayoutGrid, Keyboard,
} from 'lucide-react'

interface Props {
  onExportForCreation?: () => void
  onUnsplashSearch?: () => void
  onShare?: () => void
  onColorPicker?: () => void
  onSnapshotTimeline?: () => void
  onWorkspaceManager?: () => void
  onChromeImport?: () => void
  presenceBar?: React.ReactNode
}

export function TopBar({ onExportForCreation, onUnsplashSearch, onShare, onColorPicker, onSnapshotTimeline, onWorkspaceManager, onChromeImport, presenceBar }: Props) {
  const project = useStore((s) => s.project)
  const [showMenu, setShowMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showArrangeMenu, setShowArrangeMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateProjectName = useStore((s) => s.updateProjectName)
  const toggleChat = useStore((s) => s.toggleChat)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const toggleSearch = useStore((s) => s.toggleSearch)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const toggleInspector = useStore((s) => s.toggleInspector)
  const chatOpen = useStore((s) => s.chatOpen)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const exportProject = useStore((s) => s.exportProject)
  const exportProjectSummary = useStore((s) => s.exportProjectSummary)
  const exportForAI = useStore((s) => s.exportForAI)
  const importProject = useStore((s) => s.importProject)
  const selectedIds = useStore((s) => s.selectedIds)
  const arrangeGrid = useStore((s) => s.arrangeGrid)
  const arrangeStack = useStore((s) => s.arrangeStack)
  const arrangeSpiral = useStore((s) => s.arrangeSpiral)
  const sortByProperty = useStore((s) => s.sortByProperty)
  const groupSelected = useStore((s) => s.groupSelected)

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setShowExportMenu(false)
        setShowArrangeMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleExportJSON = () => {
    const json = exportProject()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
    setShowExportMenu(false)
  }

  const handleExportMarkdown = () => {
    const summary = exportProjectSummary()
    const blob = new Blob([summary], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}-summary.md`
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
    setShowExportMenu(false)
  }

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    try {
      const a = document.createElement('a')
      a.download = 'moodboard.png'
      a.href = canvas.toDataURL('image/png')
      a.click()
    } catch (err) {
      alert('Cannot export PNG: canvas contains cross-origin images. Try removing remote images or use Export JSON instead.')
    }
    setShowMenu(false)
    setShowExportMenu(false)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const success = importProject(reader.result)
          if (!success) alert('Failed to import project. Invalid JSON format.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
    setShowMenu(false)
  }

  return (
    <header className="h-11 flex items-center px-3 gap-2 shrink-0" style={{ zIndex: 20, background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
      {/* Left: Sidebar toggle + project name */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        style={{ color: 'var(--text-primary)' }}
        title="Toggle sidebar"
      >
        <PanelLeft size={16} />
      </button>

      <input
        value={project.name}
        onChange={(e) => updateProjectName(e.target.value)}
        className="bg-transparent text-sm font-medium border-none outline-none px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 focus:bg-black/5 dark:focus:bg-white/10 transition-colors min-w-0 max-w-[200px]"
        style={{ color: 'var(--text-primary)' }}
        spellCheck={false}
      />

      {/* Center: Presence */}
      <div className="flex-1" />
      {presenceBar && <div className="mr-2">{presenceBar}</div>}

      {/* Right: Core actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={toggleSearch}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-primary)' }}
          title="Search (Ctrl+K)"
        >
          <Search size={16} />
        </button>
        <button
          onClick={toggleInspector}
          className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-primary)' }}
          title="Inspector"
        >
          <Keyboard size={16} />
        </button>
        <button
          onClick={toggleChat}
          className={`p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${chatOpen ? 'bg-black/5 dark:bg-white/10' : ''}`}
          style={{ color: 'var(--text-primary)' }}
          title="Chat"
        >
          <MessageSquare size={16} />
        </button>

        {/* Overflow menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${showMenu ? 'bg-black/5 dark:bg-white/10' : ''}`}
            style={{ color: 'var(--text-primary)' }}
            title="More options"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-lg shadow-lg border py-1 animate-fadeIn" style={{ background: 'var(--bg-surface-1)', borderColor: 'var(--border-color)', zIndex: 100, color: 'var(--text-primary)' }}>
              {/* Export submenu */}
              <div className="relative">
                <button
                  onClick={() => { setShowExportMenu(!showExportMenu); setShowArrangeMenu(false) }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Download size={14} /> Export
                </button>
                {showExportMenu && (
                  <div className="absolute left-full top-0 ml-1 w-44 rounded-lg shadow-lg border py-1" style={{ background: 'var(--bg-surface-1)', borderColor: 'var(--border-color)', zIndex: 101, color: 'var(--text-primary)' }}>
                    <button onClick={handleExportJSON} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>JSON</button>
                    <button onClick={handleExportMarkdown} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Markdown</button>
                    <button onClick={handleExportPNG} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>PNG Image</button>
                    <button onClick={() => { onExportForCreation?.(); setShowMenu(false); setShowExportMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Creative Brief</button>
                  </div>
                )}
              </div>

              <button onClick={handleImport} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Upload size={14} /> Import Project
              </button>
              <button onClick={() => { onChromeImport?.(); setShowMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Globe size={14} /> Import Chrome Tabs
              </button>

              <div className="h-px my-1" style={{ background: 'var(--border-color)' }} />

              {/* Arrange submenu */}
              <div className="relative">
                <button
                  onClick={() => { setShowArrangeMenu(!showArrangeMenu); setShowExportMenu(false) }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <LayoutGrid size={14} /> Arrange
                </button>
                {showArrangeMenu && (
                  <div className="absolute left-full top-0 ml-1 w-44 rounded-lg shadow-lg border py-1" style={{ background: 'var(--bg-surface-1)', borderColor: 'var(--border-color)', zIndex: 101, color: 'var(--text-primary)' }}>
                    <button onClick={() => { arrangeGrid(4, 20); setShowMenu(false); setShowArrangeMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Grid</button>
                    <button onClick={() => { arrangeStack('h', 20); setShowMenu(false); setShowArrangeMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Horizontal Stack</button>
                    <button onClick={() => { arrangeStack('v', 20); setShowMenu(false); setShowArrangeMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Vertical Stack</button>
                    <button onClick={() => { arrangeSpiral(30); setShowMenu(false); setShowArrangeMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Spiral</button>
                    <button onClick={() => { sortByProperty('kind', 'asc'); setShowMenu(false); setShowArrangeMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Sort by Kind</button>
                    {selectedIds.size >= 2 && (
                      <button onClick={() => { const name = prompt('Group name:'); if (name) { groupSelected(name); setShowMenu(false); setShowArrangeMenu(false) } }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'var(--text-primary)' }}>Group Selected ({selectedIds.size})</button>
                    )}
                  </div>
                )}
              </div>

              <div className="h-px my-1" style={{ background: 'var(--border-color)' }} />

              <button onClick={() => { onSnapshotTimeline?.(); setShowMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Camera size={14} /> Snapshots
              </button>
              <button onClick={() => { onWorkspaceManager?.(); setShowMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <FolderOpen size={14} /> Workspaces
              </button>
              <button onClick={() => { onUnsplashSearch?.(); setShowMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <ImageIcon size={14} /> Search Unsplash
              </button>
              <button onClick={() => { onColorPicker?.(); setShowMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Palette size={14} /> Color Picker
              </button>
              <button onClick={() => { onShare?.(); setShowMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Share2 size={14} /> Share Board
              </button>

              <div className="h-px my-1" style={{ background: 'var(--border-color)' }} />

              <button onClick={() => { onExportForCreation?.(); setShowMenu(false) }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Sparkles size={14} /> Export for AI
              </button>
              <button onClick={toggleSettings} className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Settings size={14} /> Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}