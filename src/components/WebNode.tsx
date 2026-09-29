import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import type { WebItem, CardType } from '@/types'
import { isWebUrl, isSearchQuery, normalizeUrl, getFaviconUrl, getDomain, isTauriMode, isLikelyBlocked, getBrowserEngine } from '@/lib/browser-engine'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(item.isLoading)
  const [loadError, setLoadError] = useState(false)
  const [useTauriWebView, setUseTauriWebView] = useState(false)
  const store = useStore()

  useEffect(() => {
    setUseTauriWebView(isTauriMode())
  }, [])

  // Tauri WebContentsView lifecycle
  useEffect(() => {
    if (!useTauriWebView || !item.url || item.cardType === 'blank') return

    const engine = getBrowserEngine()
    let mounted = true

    const setupWebView = async () => {
      await engine.createWebView(item.id, item.url)
      if (mounted) {
        await engine.setVisible(item.id, true)
        setIsLoading(false)
      }
    }

    setupWebView()

    return () => {
      mounted = false
      if (useTauriWebView) {
        engine.close(item.id)
      }
    }
  }, [useTauriWebView, item.id, item.url, item.cardType])

  // Update Tauri WebContentsView bounds when position/size changes
  useEffect(() => {
    if (!useTauriWebView || !containerRef.current || item.cardType === 'blank') return

    const engine = getBrowserEngine()
    const rect = containerRef.current.getBoundingClientRect()

    const raf = requestAnimationFrame(() => {
      engine.setBounds(item.id, rect.left, rect.top, rect.width, rect.height)
    })

    return () => cancelAnimationFrame(raf)
  }, [useTauriWebView, item.id, item.cardType, canvasZoom, canvasPanX, canvasPanY, item.pos, item.size])

  const x = item.pos.x * canvasZoom + canvasPanX
  const y = item.pos.y * canvasZoom + canvasPanY
  const w = (item.size?.w ?? 640) * canvasZoom
  const h = (item.size?.h ?? 480) * canvasZoom

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

    if (useTauriWebView) {
      const engine = getBrowserEngine()
      engine.navigate(item.id, normalized)
    }
  }, [item.id, useTauriWebView])

  const handleBack = useCallback(() => {
    store.webNodeGoBack(item.id)
    if (useTauriWebView) {
      const engine = getBrowserEngine()
      engine.goBack(item.id)
    }
  }, [item.id, useTauriWebView])

  const handleForward = useCallback(() => {
    store.webNodeGoForward(item.id)
    if (useTauriWebView) {
      const engine = getBrowserEngine()
      engine.goForward(item.id)
    }
  }, [item.id, useTauriWebView])

  const handleReload = useCallback(() => {
    store.webNodeReload(item.id)
    setIsLoading(true)
    if (useTauriWebView) {
      const engine = getBrowserEngine()
      engine.reload(item.id)
    } else if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src
    }
  }, [item.id, useTauriWebView])

  const handleClose = useCallback(() => {
    store.closeWebNode(item.id)
  }, [item.id])

  const handleFocus = useCallback(() => {
    store.focusWebNode(item.id)
    if (useTauriWebView) {
      const engine = getBrowserEngine()
      engine.focus(item.id)
    }
  }, [item.id, useTauriWebView])

  const handleUnfocus = useCallback(() => {
    store.focusWebNode(null)
    if (useTauriWebView) {
      const engine = getBrowserEngine()
      engine.unfocus(item.id)
    }
  }, [item.id, useTauriWebView])

  // BLANK CARD - truly blank square with centered text input
  if (item.cardType === 'blank') {
    return (
      <div
        className="absolute"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: 10,
          zIndex: 50,
          background: 'white',
          border: isSelected ? '2px solid #6a5aae' : '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
        onClick={(e) => {
          e.stopPropagation()
          store.selectItem(item.id)
        }}
      >
        <BlankCardInput item={item} canvasZoom={canvasZoom} />
      </div>
    )
  }

  // Determine what to render based on card type
  const renderContent = () => {
    switch (item.cardType) {
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

    const isBlocked = isLikelyBlocked(item.url)

    return (
      <>
        {isLoading && !isBlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full" />
          </div>
        )}
        {(loadError || (isBlocked && !useTauriWebView)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-10 gap-3 p-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-600">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-900">Can't embed this site</div>
              <div className="text-xs text-gray-600 mt-1 max-w-[250px]">
                {getDomain(item.url) || 'This site'} blocks embedding for security reasons.
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700"
                onClick={(e) => e.stopPropagation()}
              >
                Open in tab <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); handleClose() }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
        {!useTauriWebView && !isBlocked && (
          <iframe
            ref={iframeRef}
            src={item.url}
            onLoad={handleLoad}
            onError={handleError}
            className="w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="origin"
            style={{ pointerEvents: isFocused ? 'auto' : 'none' }}
          />
        )}
        {useTauriWebView && !isBlocked && (
          <div
            ref={containerRef}
            className="w-full h-full"
            style={{ pointerEvents: isFocused ? 'auto' : 'none' }}
          />
        )}
      </>
    )
  }

  // WEB/SEARCH/IMAGE/AI cards - with browser chrome
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 10,
        zIndex: isFocused ? 1000 : isSelected ? 100 : 50,
        border: isSelected ? '2px solid #6a5aae' : '1px solid rgba(0,0,0,0.12)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        background: 'white',
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
      <div className="flex-1 relative overflow-hidden" style={{ height: 'calc(100% - 36px)', background: 'white' }}>
        {renderContent()}
      </div>

      {/* Focus overlay - click to unfocus (only on content area) */}
      {isFocused && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          style={{ cursor: 'default', top: 36 }}
          onClick={(e) => {
            e.stopPropagation()
            handleUnfocus()
          }}
        />
      )}
    </div>
  )
}

// ─── Blank Card Input (centered, no chrome) ─────────────────────────

function BlankCardInput({ item, canvasZoom }: { item: WebItem; canvasZoom: number }) {
  const [input, setInput] = useState('')
  const store = useStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    if (isWebUrl(text)) {
      // URL → browser card
      store.morphCard(item.id, 'web', {
        url: normalizeUrl(text),
        title: getDomain(text) || text,
        favicon: getFaviconUrl(text),
      })
    } else if (isSearchQuery(text) && (text.endsWith('?') || text.startsWith('how ') || text.startsWith('what ') || text.startsWith('why ') || text.startsWith('when ') || text.startsWith('where '))) {
      // Question → search card
      store.morphCard(item.id, 'search', { searchText: text })
    } else {
      // Text → note card (old style)
      store.morphCard(item.id, 'note', { content: text })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const text = e.dataTransfer.getData('text/plain')
    if (text) {
      if (isWebUrl(text)) {
        store.morphCard(item.id, 'web', {
          url: normalizeUrl(text),
          title: getDomain(text) || text,
          favicon: getFaviconUrl(text),
        })
      } else {
        store.morphCard(item.id, 'note', { content: text })
      }
    }
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        store.morphCard(item.id, 'image', { url, title: file.name })
      } else {
        store.morphCard(item.id, 'note', { content: `File: ${file.name}` })
      }
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full gap-3"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSubmit(e)
          }
          if (e.key === 'Escape') {
            store.closeWebNode(item.id)
            e.stopPropagation()
          }
        }}
        placeholder="Type something..."
        style={{
          width: '85%',
          maxWidth: 400,
          padding: '12px 16px',
          fontSize: 14 * Math.max(0.8, Math.min(canvasZoom, 1.2)),
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.15)',
          outline: 'none',
          textAlign: 'center',
          background: 'rgba(0,0,0,0.03)',
          color: '#1a1a2e',
        }}
        autoFocus
      />
      <div style={{ fontSize: 11, color: '#666', textAlign: 'center' }}>
        URL → website · question → search · text → note
      </div>
    </div>
  )
}

// ─── Browser Chrome ──────────────────────────────────────────────────

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
      className="flex items-center gap-1.5 px-2 h-9"
      style={{
        cursor: 'default',
        background: '#f5f5f7',
        borderBottom: '1px solid rgba(0,0,0,0.1)',
      }}
    >
      {/* Navigation buttons */}
      <button
        onClick={onBack}
        disabled={!canGoBack}
        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
        title="Back"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={onForward}
        disabled={!canGoForward}
        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
        title="Forward"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={onReload}
        className="p-1 rounded hover:bg-gray-200 transition-colors"
        title="Reload"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
          <path d="M1 4v6h6M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
        </svg>
      </button>

      {/* URL Bar */}
      <form onSubmit={handleSubmit} className="flex-1 mx-1">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-gray-200 hover:border-gray-300 transition-colors">
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
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: '#1a1a2e' }}
              placeholder="Enter URL..."
            />
          ) : (
            <div
              className="flex-1 text-xs truncate cursor-text"
              style={{ color: '#333' }}
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
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          title="Focus fullscreen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      )}
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-red-100 hover:text-red-600 transition-colors"
        title="Close"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Card Content Types ──────────────────────────────────────────────

function NoteCardContent({ item, onUpdate }: { item: WebItem; onUpdate: (content: string) => void }) {
  const [content, setContent] = useState(item.content || '')

  const handleBlur = () => {
    onUpdate(content)
  }

  return (
    <div className="h-full p-3" style={{ background: 'white' }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        placeholder="Write your note..."
        className="w-full h-full resize-none outline-none"
        style={{ color: '#1a1a2e', fontSize: 14, lineHeight: 1.6 }}
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
    <div className="flex flex-col h-full" style={{ background: 'white' }}>
      <form onSubmit={handleSubmit} className="p-2 border-b border-gray-200">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full px-2 py-1 text-sm rounded border border-gray-300 focus:border-purple-500 focus:outline-none"
          style={{ color: '#1a1a2e' }}
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
    <div className="h-full p-3 overflow-auto" style={{ background: 'white' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: '#6a5aae' }}>AI Response</div>
      <div className="text-sm whitespace-pre-wrap" style={{ color: '#1a1a2e' }}>{item.content || 'No content yet...'}</div>
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
    <div className="flex flex-col items-center justify-center h-full p-4 gap-3" style={{ background: 'white' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter URL..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:border-purple-500 focus:outline-none"
          style={{ color: '#1a1a2e' }}
          autoFocus
        />
      </form>
    </div>
  )
}