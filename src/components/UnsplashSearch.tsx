import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { X, Search, Plus, ExternalLink } from 'lucide-react'
import { showToast } from '@/lib/toasts'

interface UnsplashPhoto {
  id: string
  urls: { small: string; regular: string; full: string }
  alt_description: string
  description: string
  user: { name: string; links: { html: string } }
  links: { html: string }
  width: number
  height: number
}

interface Props {
  onClose: () => void
}

// Unsplash demo access key — rate-limited to 50 req/hour.
// @ts-expect-error import.meta.env is Vite-specific
const UNSPLASH_KEY = import.meta.env?.VITE_UNSPLASH_ACCESS_KEY || ''
const UNSPLASH_API = 'https://api.unsplash.com'

export function UnsplashSearch({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const addItem = useStore((s) => s.addItem)

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback(async (q: string, p: number = 1) => {
    if (!q.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${UNSPLASH_API}/search/photos?query=${encodeURIComponent(q)}&page=${p}&per_page=20`, {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      })
      if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`)
      const data = await res.json()
      setPhotos(p === 1 ? data.results : [...photos, ...data.results])
      setTotalPages(data.total_pages)
      setPage(p)
    } catch (err: any) {
      showToast(err.message || 'Failed to search Unsplash', 'error')
    } finally {
      setLoading(false)
    }
  }, [photos])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search(query)
    if (e.key === 'Escape') onClose()
  }

  const addToBoard = (photo: UnsplashPhoto) => {
    const url = photo.urls.regular
    addItem({
      kind: 'image', id: crypto.randomUUID(),
      thumbnail: photo.urls.small,
      fullSource: url,
      description: photo.alt_description || photo.description || 'Unsplash image',
      source: url,
      purpose: 'Visual reference',
      importance: 'User-selected',
      tags: ['unsplash', photo.user.name],
      pos: { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 },
      size: { w: Math.min(400, photo.width), h: Math.min(300, photo.height) },
    } as any)
    showToast('Added to board', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(900px,95vw)] h-[min(700px,90vh)] glass-card rounded-xl shadow-panel flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Unsplash for images..."
              className="input w-full pl-10"
            />
          </div>
          <button onClick={() => search(query)} className="btn btn-primary" disabled={loading || !query.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {photos.length === 0 && !loading && (
            <div className="text-center text-text-muted mt-20">
              <Search size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Search for images to add to your mood board</p>
              <p className="text-xs mt-1">Powered by Unsplash — free for any use</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden bg-surface-2 cursor-pointer" onClick={() => addToBoard(photo)}>
                <img
                  src={photo.urls.small}
                  alt={photo.alt_description || ''}
                  className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button className="btn btn-primary p-2 rounded-full" title="Add to board">
                      <Plus size={16} />
                    </button>
                    <a
                      href={photo.links.html}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
                      title="View on Unsplash"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-2xs text-white/80 truncate">Photo by {photo.user.name}</p>
                </div>
              </div>
            ))}
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="flex gap-1 justify-center">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                ))}
              </div>
            </div>
          )}

          {photos.length > 0 && page < totalPages && !loading && (
            <div className="text-center py-4">
              <button onClick={() => search(query, page + 1)} className="btn btn-ghost">
                Load more
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.06] flex items-center justify-between text-2xs text-text-muted">
          <span>{photos.length} images</span>
          <span>Click an image to add it to your board</span>
        </div>
      </div>
    </div>
  )
}