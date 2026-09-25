import { useState, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import {
  MessageSquare, Settings, Search, PanelLeft, Layers,
  Download, Upload, Keyboard, FileText, Check, Cloud,
  LayoutGrid, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  RotateCcw, Group, ArrowUpDown, Sparkles, ImageIcon, Share2,
} from 'lucide-react'

interface Props {
  onExportForCreation?: () => void
  onUnsplashSearch?: () => void
  onShare?: () => void
  presenceBar?: React.ReactNode
}

export function TopBar({ onExportForCreation, onUnsplashSearch, onShare, presenceBar }: Props) {
  const project = useStore((s) => s.project)
  const [saved, setSaved] = useState(true)
  const [showOrgMenu, setShowOrgMenu] = useState(false)
  const selectedIds = useStore((s) => s.selectedIds)
  const arrangeGrid = useStore((s) => s.arrangeGrid)
  const arrangeStack = useStore((s) => s.arrangeStack)
  const arrangeSpiral = useStore((s) => s.arrangeSpiral)
  const sortByProperty = useStore((s) => s.sortByProperty)
  const groupSelected = useStore((s) => s.groupSelected)

  useEffect(() => {
    setSaved(false)
    const timer = setTimeout(() => setSaved(true), 1000)
    return () => clearTimeout(timer)
  }, [project.updated])
  const updateProjectName = useStore((s) => s.updateProjectName)
  const toggleChat = useStore((s) => s.toggleChat)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const toggleSearch = useStore((s) => s.toggleSearch)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const toggleInspector = useStore((s) => s.toggleInspector)
  const chatOpen = useStore((s) => s.chatOpen)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const inspectorOpen = useStore((s) => s.inspectorOpen)
  const exportProject = useStore((s) => s.exportProject)
  const exportProjectSummary = useStore((s) => s.exportProjectSummary)
  const exportForAI = useStore((s) => s.exportForAI)
  const importProject = useStore((s) => s.importProject)

  const handleExport = () => {
    const json = exportProject()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportSummary = () => {
    const summary = exportProjectSummary()
    const blob = new Blob([summary], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}-summary.md`
    a.click()
    URL.revokeObjectURL(url)
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
  }

  return (
    <header className="h-12 glass-panel border-b border-surface-4 flex items-center px-4 gap-2 shrink-0" style={{ zIndex: 20 }}>
      <button
        onClick={toggleSidebar}
        className={`toolbar-btn ${sidebarOpen ? 'active' : ''}`}
        title="Toggle sidebar"
      >
        <PanelLeft size={18} />
      </button>

      <input
        value={project.name}
        onChange={(e) => updateProjectName(e.target.value)}
        className="bg-transparent text-text-primary font-semibold text-sm border-none outline-none flex-1 min-w-0 px-2 py-1 rounded hover:bg-surface-2 focus:bg-surface-2 focus:ring-1 focus:ring-accent"
        spellCheck={false}
      />

      <div className="flex items-center gap-1.5 mr-2">
        {saved ? (
          <div className="flex items-center gap-1 text-2xs text-success">
            <Check size={12} />
            <span>Saved</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-2xs text-text-muted animate-pulse">
            <Cloud size={12} />
            <span>Saving...</span>
          </div>
        )}
        {presenceBar && <div className="ml-2">{presenceBar}</div>}
      </div>

      <div className="flex items-center gap-1">
        <ToolbarButton icon={<Search size={16} />} onClick={toggleSearch} title="Search (Ctrl+K)" />
        <ToolbarButton icon={<Layers size={16} />} onClick={toggleInspector} title="Inspector" active={inspectorOpen} />
        <ToolbarButton icon={<MessageSquare size={16} />} onClick={toggleChat} title="Chat" active={chatOpen} />
        <div className="w-px h-5 bg-surface-4 mx-1" />
        <ToolbarButton icon={<Download size={16} />} onClick={handleExport} title="Export JSON" />
        <ToolbarButton icon={<FileText size={16} />} onClick={handleExportSummary} title="Export Markdown" />
        <ToolbarButton icon={<Upload size={16} />} onClick={handleImport} title="Import project" />
        <ToolbarButton icon={<Sparkles size={16} />} onClick={onExportForCreation ?? (() => {})} title="Export for Creation — generate a creative brief for another LLM" />
        <ToolbarButton icon={<ImageIcon size={16} />} onClick={onUnsplashSearch ?? (() => {})} title="Search Unsplash for images" />
        <ToolbarButton icon={<Share2 size={16} />} onClick={onShare ?? (() => {})} title="Share board — generate view or edit links" />
        <div className="w-px h-5 bg-surface-4 mx-1" />
        <div className="relative">
          <ToolbarButton icon={<LayoutGrid size={16} />} onClick={() => setShowOrgMenu(!showOrgMenu)} title="Arrange items" />
          {showOrgMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 glass-card rounded-lg shadow-lg z-50 py-1 animate-scaleIn">
              <button onClick={() => { arrangeGrid(4, 20); setShowOrgMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2 flex items-center gap-2"><LayoutGrid size={14} /> Grid Layout</button>
              <button onClick={() => { arrangeStack('h', 20); setShowOrgMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2 flex items-center gap-2"><AlignHorizontalDistributeCenter size={14} /> Horizontal Stack</button>
              <button onClick={() => { arrangeStack('v', 20); setShowOrgMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2 flex items-center gap-2"><AlignVerticalDistributeCenter size={14} /> Vertical Stack</button>
              <button onClick={() => { arrangeSpiral(30); setShowOrgMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2 flex items-center gap-2"><RotateCcw size={14} /> Spiral</button>
              <div className="h-px bg-surface-4 my-1" />
              <button onClick={() => { sortByProperty('kind', 'asc'); setShowOrgMenu(false) }} className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2 flex items-center gap-2"><ArrowUpDown size={14} /> Sort by Kind</button>
              {selectedIds.size >= 2 && (
                <>
                  <div className="h-px bg-surface-4 my-1" />
                  <button onClick={() => { const name = prompt('Group name:'); if (name) { groupSelected(name); setShowOrgMenu(false) } }} className="w-full px-3 py-2 text-left text-sm text-accent hover:bg-surface-2 flex items-center gap-2"><Group size={14} /> Group Selected ({selectedIds.size})</button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="w-px h-5 bg-surface-4 mx-1" />
        <ToolbarButton icon={<Keyboard size={16} />} onClick={() => {}} title="Shortcuts" />
        <ToolbarButton icon={<Settings size={16} />} onClick={toggleSettings} title="Settings" />
      </div>
    </header>
  )
}

function ToolbarButton({ icon, onClick, title, active }: { icon: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`toolbar-btn ${active ? 'active' : ''}`}
      title={title}
    >
      {icon}
    </button>
  )
}
