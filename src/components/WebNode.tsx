import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import type { WebItem, CardType } from '@/types'
import { isWebUrl, isSearchQuery, normalizeUrl, getFaviconUrl, getDomain } from '@/lib/browser-engine'

interface WebNodeProps {
  item: WebItem
  canvasZoom: number
  canvasPanX: number
  canvasPanY: number
  isSelected: boolean
  isFocused: boolean
}

export function WebNode({ item, canvasZoom, canvasPanX, canvasPanY, isSelected, isFocused }: WebNodeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(item.isLoading)
  const [loadError, setLoadError] = useState(false)
  const store = useStore()

  const x = item.pos.x * canvasZoom + canvasPanX
  const y = item.pos.y * canvasZoom + canvasPanY
  const w = (item.size?.w ?? 300) * canvasZoom
  const h = (item.size?.h ?? 200) * canvasZoom

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    setLoadError(false)
    store.updateWebNode(item.id, { isLoading: false })
  }, [item.id])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setLoadError(true)
  }, [])

  const handleNavigate = useCallback((url: string) => {
    const normalized = normalizeUrl(url)
    store.navigateWebNode(item.id, normalized)
    setIsLoading(true)
    setLoadError(false)
  }, [item.id])

  const handleBack = useCallback(() => {
    store.webNodeGoBack(item.id)
  }, [item.id])

  const handleForward = useCallback(() => {
    store.webNodeGoForward(item.id)
  }, [item.id])

  const handleReload = useCallback(() => {
    store.webNodeReload(item.id)
    setIsLoading(true)
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }
  }, [item.id])

  const handleClose = useCallback(() => {
    store.closeWebNode(item.id)
  }, [item.id])

  const handleFocus = useCallback(() => {
    store.focusWebNode(item.id)
  }, [item.id])

  const handleUnfocus = useCallback(() => {
    store.focusWebNode(null)
  }, [])

  // Determine what to render based on card type
  const renderContent = () => {
    switch (item.cardType) {
      case 'blank':
        return <BlankCardContent item={item} onMorph={(type, data) => store.morphCard(item.id, type, data)} />
      case 'note':
        return <NoteCardContent item={item} onUpdate={(content) => store.updateWebNode(item.id, { content })} />
      case 'search':
        return <SearchCardContent item={item} onNavigate={handleNavigate} />
      case 'ai':
        return <AICardContent item={item} />
      case 'web':
      case 'image':
      case 'link':
      default:
        return renderWebContent()
    }
  }

  const renderWebContent = () => {
    if (!item.url) return <EmptyCardContent item={item} onNavigate={handleNavigate} />

    return (
      <>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-0/80 z-10">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-0/90 z-10 gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-xs text-text-secondary">This site can't be embedded</span>
            <div className="flex gap-2">
              <button onClick={handleReload} className="btn btn-ghost text-xs px-2 py-1">Retry</button>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-accent text-xs px-2 py-1">Open in tab ↗</a>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={item.url}
          onLoad={handleLoad}
          onError={handleError}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="origin"
          style={{ pointerEvents: isFocused ? 'auto' : 'none' }}
        />
      </>
    )
  }

  return (
    <div
      className="absolute glass-card overflow-hidden"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 10,
        zIndex: isFocused ? 1000 : isSelected ? 100 : 10,
        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
        transition: isFocused ? 'none' : 'all 0.2s ease',
      }}
      onClick={(e) => {
        e.stopPropagation()
        store.selectItem(item.id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        handleFocus()
      }}
    >
      {/* Browser Chrome */}
      <BrowserChrome
        item={item}
        isLoading={isLoading}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onClose={handleClose}
        onNavigate={handleNavigate}
        onFocus={handleFocus}
        isFocused={isFocused}
      />

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden" style={{ height: 'calc(100% - 36px)' }}>
        {renderContent()}
      </div>

      {/* Focus overlay - click to unfocus */}
      {isFocused && (
        <div
          className="absolute top-0 left-0 right-0 h-9 z-20"
          style={{ cursor: 'default' }}
          onClick={(e) => {
            e.stopPropagation()
            handleUnfocus()
          }}
        />
      )}
    </div>
  )
}

// ─── Browser Chrome (URL bar, navigation) ─────────────────────────────

interface BrowserChromeProps {
  item: WebItem
  isLoading: boolean
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onClose: () => void
  onNavigate: (url: string) => void
  onFocus: () => void
  isFocused: boolean
}

function BrowserChrome({ item, isLoading, onBack, onForward, onReload, onClose, onNavigate, onFocus, isFocused }: BrowserChromeProps) {
  const [inputValue, setInputValue] = useState(item.url || '')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!isEditing) {
      setInputValue(item.url || '')
    }
  }, [item.url, isEditing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onNavigate(inputValue.trim())
      setIsEditing(false)
    }
  }

  const canGoBack = item.history.index > 0
  const canGoForward = item.history.index < item.history.urls.length - 1
  const domain = getDomain(item.url)

  return (
    <div
      className="flex items-center gap-1.5 px-2 h-9 border-b border-border bg-surface-1"
      style={{ cursor: 'default' }}
    >
      {/* Navigation buttons */}
      <button
        onClick={onBack}
        disabled={!canGoBack}
        className="p-1 rounded hover:bg-surface-2 disabled:opacity-30 transition-fast"
        title="Back"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={onForward}
        disabled={!canGoForward}
        className="p-1 rounded hover:bg-surface-2 disabled:opacity-30 transition-fast"
        title="Forward"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={onReload}
        className="p-1 rounded hover:bg-surface-2 transition-fast"
        title="Reload"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 4v6h6M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
        </svg>
      </button>

      {/* URL Bar */}
      <form onSubmit={handleSubmit} className="flex-1 mx-1">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-0 border border-border hover:border-accent/30 transition-fast">
          {item.favicon && (
            <img src={item.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          {isEditing ? (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => setIsEditing(false)}
              autoFocus
              className="flex-1 text-xs bg-transparent outline-none text-text-primary"
              placeholder="Enter URL or search..."
            />
          ) : (
            <div
              className="flex-1 text-xs text-text-secondary truncate cursor-text"
              onClick={() => setIsEditing(true)}
            >
              {domain || item.title || 'New Tab'}
            </div>
          )}
        </div>
      </form>

      {/* Focus/Close buttons */}
      {!isFocused && (
        <button
          onClick={onFocus}
          className="p-1 rounded hover:bg-surface-2 transition-fast"
          title="Focus fullscreen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      )}
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-danger/10 hover:text-danger transition-fast"
        title="Close"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Card Content Types ───────────────────────────────────────────────

function BlankCardContent({ item, onMorph }: { item: WebItem; onMorph: (type: CardType, data?: any) => void }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    if (isWebUrl(text)) {
      onMorph('web', { url: normalizeUrl(text), title: getDomain(text) || text, favicon: getFaviconUrl(text) })
    } else if (isSearchQuery(text)) {
      onMorph('search', { searchText: text })
    } else {
      onMorph('note', { content: text, title: text.slice(0, 30) })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const text = e.dataTransfer.getData('text/plain')
    if (text) {
      if (isWebUrl(text)) {
        onMorph('web', { url: normalizeUrl(text), title: getDomain(text) || text, favicon: getFaviconUrl(text) })
      } else {
        onMorph('note', { content: text, title: text.slice(0, 30) })
      }
    }
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        onMorph('image', { url, title: file.name })
      } else {
        onMorph('note', { content: `File: ${file.name}`, title: file.name })
      }
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full p-4 gap-3"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="text-2xl opacity-30">+</div>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a URL, search, or note..."
          className="w-full px-3 py-2 text-sm rounded-lg bg-surface-0 border border-border focus:border-accent focus:outline-none text-text-primary placeholder:text-text-muted"
          autoFocus
        />
      </form>
      <div className="text-xs text-text-muted text-center">
        URL → website · text → note · question → search
      </div>
    </div>
  )
}

function NoteCardContent({ item, onUpdate }: { item: WebItem; onUpdate: (content: string) => void }) {
  const [content, setContent] = useState(item.content || '')

  const handleBlur = () => {
    onUpdate(content)
  }

  return (
    <div className="h-full p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        placeholder="Write your note..."
        className="w-full h-full resize-none bg-transparent text-sm text-text-primary outline-none"
      />
    </div>
  )
}

function SearchCardContent({ item, onNavigate }: { item: WebItem; onNavigate: (url: string) => void }) {
  const [query, setQuery] = useState(item.searchText || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onNavigate(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSubmit} className="p-2 border-b border-border">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full px-2 py-1 text-sm rounded bg-surface-0 border border-border focus:border-accent focus:outline-none text-text-primary"
        />
      </form>
      {item.url && (
        <iframe
          src={item.url}
          className="flex-1 w-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  )
}

function AICardContent({ item }: { item: WebItem }) {
  return (
    <div className="h-full p-3 overflow-auto">
      <div className="text-xs text-accent font-medium mb-2">AI Response</div>
      <div className="text-sm text-text-primary whitespace-pre-wrap">{item.content || 'No content yet...'}</div>
    </div>
  )
}

function EmptyCardContent({ item, onNavigate }: { item: WebItem; onNavigate: (url: string) => void }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      onNavigate(input.trim())
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 gap-3">
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter URL..."
          className="w-full px-3 py-2 text-sm rounded-lg bg-surface-0 border border-border focus:border-accent focus:outline-none text-text-primary"
          autoFocus
        />
      </form>
    </div>
  )
}