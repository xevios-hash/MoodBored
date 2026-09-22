import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/stores/useStore'
import { searchItems } from '@/lib/api'
import { Search, X, Tag } from 'lucide-react'
import type { BoardItem } from '@/types'

export function SearchOverlay() {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [results, setResults] = useState<BoardItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const project = useStore((s) => s.project)
  const selectItem = useStore((s) => s.selectItem)
  const toggleSearch = useStore((s) => s.toggleSearch)
  const setActiveViewport = useStore((s) => s.setActiveViewport)

  const allItems = useMemo(() => {
    return project.viewports.flatMap((v) => v.items)
  }, [project.viewports])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query && !tag) {
      setResults([])
      return
    }
    setResults(searchItems(allItems, query, tag))
  }, [query, tag, allItems])

  const handleSelect = (item: BoardItem) => {
    selectItem(item.id)
    const state = useStore.getState()
    for (const vp of state.project.viewports) {
      if (vp.items.some((i) => i.id === item.id)) {
        setActiveViewport(vp.id)
        break
      }
    }
    toggleSearch()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') toggleSearch()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh] animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && toggleSearch()}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Search items"
    >
      <div className="w-[min(500px,90vw)] glass-card rounded-xl shadow-panel overflow-hidden animate-scaleIn">
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="flex-1 bg-transparent text-text-primary outline-none text-sm"
            aria-label="Search query"
          />
          <div className="flex items-center gap-1 px-2 py-1 bg-surface-2 rounded">
            <Tag size={12} className="text-text-muted" />
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="tag"
              className="w-16 bg-transparent text-text-secondary outline-none text-xs"
              aria-label="Filter by tag"
            />
          </div>
          <button
            onClick={toggleSearch}
            className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded"
            aria-label="Close search"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {results.length === 0 && (query || tag) && (
            <div className="p-4 text-center text-text-muted text-sm">
              No results found
            </div>
          )}
          {results.length === 0 && !query && !tag && (
            <div className="p-4 text-center text-text-muted text-sm">
              Type to search across all items...
            </div>
          )}
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full px-4 py-3 hover:bg-surface-2 text-left flex items-start gap-3 transition-fast"
            >
              <span className="text-xs font-medium text-accent uppercase shrink-0 mt-0.5">
                {item.kind}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary truncate">
                  {getItemPreview(item)}
                </div>
                {'tags' in item && item.tags && item.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {item.tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-2xs text-text-muted bg-surface-3 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-surface-4 text-center">
          <span className="text-2xs text-text-muted">
            {results.length > 0 ? `${results.length} result${results.length > 1 ? 's' : ''}` : 'Esc to close'}
          </span>
        </div>
      </div>
    </div>
  )
}

function getItemPreview(item: BoardItem): string {
  switch (item.kind) {
    case 'text': return item.raw.slice(0, 80)
    case 'image': return item.description || 'Image'
    case 'link': return item.title || item.url
    case 'note': return item.text.slice(0, 80)
    case 'video': return item.subjectDesc || 'Video'
    case 'palette': return `Palette: ${item.label}`
    case 'gradient': return `Gradient: ${item.label}`
    case 'font': return `Font: ${item.fontFamily}`
    case 'swatch': return `${item.hex} ${item.name}`
    case 'sizeguide': return `${item.width}x${item.height}${item.unit} ${item.label}`
    case 'container': return `Container: ${item.label} (${item.children.length} items)`
    case 'connector': return `Link: ${item.label || item.fromId + ' → ' + item.toId}`
    default: return ''
  }
}
