import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { hitTestItem } from '@/lib/layout'
import { loadFont } from '@/lib/fonts'
import { showToast } from '@/lib/toasts'
import { WebNode } from '@/components/WebNode'
import { FileEditor } from '@/components/FileEditor'
import { AnnotationLayer } from '@/components/AnnotationLayer'
import { getDefaultPorts } from '@/types'
import type { BoardItem, Position, PortConnection, ContainerItem, ConnectorOwner, WebItem, ConnectionType } from '@/types'

// Detect if running in Tauri desktop app
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined
function getApiBaseUrl(): string {
  return isTauri ? 'http://localhost:3000' : ''
}

// Simple X icon component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ─── Item Creation Defaults ─────────────────────────────────────────
// Shared between the floating toolbar and the right-click context menu.

const ITEM_TYPES = [
  { kind: 'note', icon: '📝', label: 'Note', key: 'N' },
  { kind: 'image', icon: '🖼️', label: 'Image', key: 'I' },
  { kind: 'web', icon: '🌐', label: 'Website', key: 'W' },
  { kind: 'video', icon: '🎬', label: 'Video', key: 'V' },
]

const ADVANCED_ITEM_TYPES = [
  { kind: 'link', icon: '🔗', label: 'Bookmark', key: 'L' },
  { kind: 'text', icon: '📄', label: 'Text', key: 'T' },
  { kind: 'palette', icon: '🎨', label: 'Palette', key: 'P' },
  { kind: 'gradient', icon: '🌈', label: 'Gradient', key: 'G' },
  { kind: 'font', icon: '🔤', label: 'Font', key: 'F' },
  { kind: 'swatch', icon: '🟧', label: 'Color', key: 'C' },
  { kind: 'sizeguide', icon: '📐', label: 'Size', key: null },
  { kind: 'container', icon: '📦', label: 'Group', key: null },
]

function createDefaultItem(kind: string, pos: Position): BoardItem {
  const cx = pos.x, cy = pos.y
  const defaults: Record<string, any> = {
    note: { kind: 'note', id: crypto.randomUUID(), text: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, ports: getDefaultPorts('note') },
    text: { kind: 'text', id: crypto.randomUUID(), raw: '', pos: { x: cx, y: cy }, size: { w: 300, h: 200 }, ports: getDefaultPorts('text') },
    image: { kind: 'image', id: crypto.randomUUID(), thumbnail: '', fullSource: '', description: '', source: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 300, h: 200 }, ports: getDefaultPorts('image') },
    link: { kind: 'link', id: crypto.randomUUID(), url: '', title: '', summary: '', description: '', purpose: '', importance: '', source: '', tags: [], pos: { x: cx, y: cy }, ports: getDefaultPorts('link') },
    palette: { kind: 'palette', id: crypto.randomUUID(), label: 'New Palette', colors: [{ hex: '#e88098', label: '' }, { hex: '#8b7dc8', label: '' }, { hex: '#f0e080', label: '' }], purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 120 }, ports: getDefaultPorts('palette') },
    gradient: { kind: 'gradient', id: crypto.randomUUID(), label: 'New Gradient', stops: [{ position: 0, color: '#e88098' }, { position: 1, color: '#8b7dc8' }], direction: 90, purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 300, h: 80 }, ports: getDefaultPorts('gradient') },
    font: { kind: 'font', id: crypto.randomUUID(), fontFamily: 'Inter', weights: [400, 700], sampleText: 'The quick brown fox', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 160 }, ports: getDefaultPorts('font') },
    swatch: { kind: 'swatch', id: crypto.randomUUID(), hex: '#8b7dc8', name: '', usage: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 160, h: 180 }, ports: getDefaultPorts('swatch') },
    sizeguide: { kind: 'sizeguide', id: crypto.randomUUID(), width: 1920, height: 1080, unit: 'px', label: '', orientation: 'landscape', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 200, h: 160 }, ports: getDefaultPorts('sizeguide') },
    container: { kind: 'container', id: crypto.randomUUID(), label: 'New Group', children: [], layout: 'free', gap: 8, collapsed: false, purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 400, h: 300 }, ports: getDefaultPorts('container') },
    video: { kind: 'video', id: crypto.randomUUID(), source: '', sourceUrl: '', startTs: 0, duration: 0, subjectDesc: '', motionDesc: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 240 }, ports: getDefaultPorts('video') },
  }
  return defaults[kind] || defaults.note
}

// ─── Theme ──────────────────────────────────────────────────────────

function isDark() { return document.body.classList.contains('dark') }
function gridColor() { return isDark() ? 'rgba(139,125,200,0.06)' : 'rgba(0,0,0,0.06)' }
function crosshairColor() { return isDark() ? 'rgba(139,125,200,0.2)' : 'rgba(100,80,160,0.25)' }
function cardBg(sel: boolean) { return isDark() ? (sel ? '#1a1030' : '#150f24') : (sel ? '#f0ecfa' : '#ffffff') }
function cardBorder(sel: boolean) { return isDark() ? (sel ? 'rgba(139,125,200,0.4)' : 'rgba(160,140,220,0.08)') : (sel ? 'rgba(100,80,160,0.4)' : 'rgba(0,0,0,0.06)') }
function txtPrimary() { return isDark() ? '#ede5f8' : '#1a1028' }
function txtSecondary() { return isDark() ? '#b8a8d8' : '#6b5a8a' }
function txtMuted() { return isDark() ? '#8a7aaa' : '#9a8aba' }
function accent() { return isDark() ? '#8b7dc8' : '#6a5aae' }
function shadow(sel: boolean) { return isDark() ? (sel ? 'rgba(139,125,200,0.2)' : 'rgba(0,0,0,0.4)') : (sel ? 'rgba(100,80,160,0.15)' : 'rgba(0,0,0,0.08)') }

// ─── LRU Image Cache (max 200) ─────────────────────────────────────

const MAX_IMAGES = 200
const imageCache = new Map<string, HTMLImageElement>()
const imageFailed = new Set<string>()
const blobUrls = new Set<string>() // track blob URLs for revocation

function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:')
}

function revokeBlobUrl(url: string) {
  if (isBlobUrl(url) && blobUrls.has(url)) {
    try { URL.revokeObjectURL(url) } catch {}
    blobUrls.delete(url)
  }
}

function getImage(url: string): HTMLImageElement | null {
  if (!url || imageFailed.has(url)) return null
  const cached = imageCache.get(url)
  if (cached && cached.complete && cached.naturalWidth > 0) {
    // Move to end (most recently used)
    imageCache.delete(url)
    imageCache.set(url, cached)
    return cached
  }
  if (!imageCache.has(url)) {
    try {
      const img = new Image()
      // Don't force crossOrigin - let images load from any source
      img.onload = () => {
        imageCache.set(url, img)
        needsRedrawGlobal = true
        // Evict oldest if over limit
        while (imageCache.size > MAX_IMAGES) {
          const first = imageCache.keys().next().value
          if (first) {
            imageCache.delete(first)
            revokeBlobUrl(first)
          }
        }
      }
      img.onerror = () => {
        imageFailed.add(url)
        imageCache.delete(url)
        revokeBlobUrl(url)
        needsRedrawGlobal = true
      }
      img.src = url
      imageCache.set(url, img) // mark as loading
    } catch {
      imageFailed.add(url)
    }
  }
  return null
}

function isImageFailed(url: string): boolean {
  return !!url && imageFailed.has(url)
}

// Revoke all blob URLs on page unload (safety net)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const url of blobUrls) revokeBlobUrl(url)
  })
}

// Reset imageFailed when project changes (clear stale failures)
let lastProjectId: string | null = null
function maybeClearImageFailed(projectId: string) {
  if (projectId !== lastProjectId) {
    lastProjectId = projectId
    imageFailed.clear()
  }
}

// Global redraw flag so image loads can trigger a repaint
let needsRedrawGlobal = false

// Safe accessor — tags might be a string (from JSON import) or an array
function asArray(v: any): string[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v.length > 0) return v.split(',').map((s: string) => s.trim())
  return []
}

// ─── Constants ──────────────────────────────────────────────────────

const PORT_RADIUS = 5
const PORT_COLORS: Record<string, string> = { data: '#6aa8d8', visual: '#a888d8', reference: '#78c8a0', any: '#8888aa' }
const CONNECTOR_COLORS: Record<ConnectorOwner, string> = { user: '#6aa8d8', llm: '#e88098', objective: '#c8b860' }
const KIND_COLORS: Record<string, string> = {
  text: '#8b7dc8', note: '#e8b840', image: '#e88098', link: '#6aa8d8',
  video: '#a888d8', palette: '#78c8a0', gradient: '#e89060', font: '#d87898',
  swatch: '#78b8d8', sizeguide: '#999999', container: '#78c8a0', connector: '#666688',
  web: '#6aa8d8', region: '#4CAF50',
}
const RESIZE_HANDLE_SIZE = 8

function isGif(item: any): boolean {
  if (item.kind !== 'image') return false
  const src = (item.thumbnail || item.fullSource || '').toLowerCase()
  return src.endsWith('.gif') || src.includes('.gif')
}

// ─── Grid Cache ─────────────────────────────────────────────────────

let gridCanvas: OffscreenCanvas | null = null
let gridZoom = 0
let gridW = 0
let gridH = 0

function getGridTile(zoom: number, w: number, h: number): OffscreenCanvas | null {
  const size = 30
  const key = `${Math.round(zoom * 100)}_${w}_${h}`
  if (gridCanvas && gridZoom === zoom && gridW === w && gridH === h) return gridCanvas

  try {
    gridCanvas = new OffscreenCanvas(w, h)
    const ctx = gridCanvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = gridColor()
    const r = 1.2
    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
    }
    gridZoom = zoom; gridW = w; gridH = h
    return gridCanvas
  } catch {
    return null
  }
}

// ─── Port Helpers ───────────────────────────────────────────────────

function getPortPos(itemId: string, portId: string, items: BoardItem[]): { x: number; y: number } | null {
  const item = items.find(i => i.id === itemId)
  if (!item || !('pos' in item)) return null
  const ports = item.ports || []
  const port = ports.find(p => p.id === portId)
  if (!port) return null
  const list = ports.filter(p => p.direction === port.direction)
  const idx = list.findIndex(p => p.id === portId)
  const w = item.size?.w ?? 250
  const h = item.size?.h ?? 150
  return { x: item.pos.x + (port.direction === 'input' ? 0 : w), y: item.pos.y + (h / (list.length + 1)) * (idx + 1) }
}

function hitTestPort(items: BoardItem[], wx: number, wy: number, zoom: number): { itemId: string; portId: string } | null {
  const thr = (PORT_RADIUS + 4) / zoom
  for (const item of items) {
    if (!('ports' in item) || !item.ports) continue
    for (const port of item.ports) {
      const pos = getPortPos(item.id, port.id, items)
      if (!pos) continue
      const dx = wx - pos.x; const dy = wy - pos.y
      if (dx * dx + dy * dy < thr * thr) return { itemId: item.id, portId: port.id }
    }
  }
  return null
}

function hitTestResize(item: BoardItem, wx: number, wy: number, zoom: number): string | null {
  if (!('pos' in item) || !('size' in item)) return null
  const s = RESIZE_HANDLE_SIZE / zoom
  const x = item.pos.x; const y = item.pos.y
  const w = item.size?.w ?? 250; const h = item.size?.h ?? 150
  const handles = [
    { id: 'se', x: x + w - s / 2, y: y + h - s / 2 },
    { id: 'e', x: x + w - s / 2, y: y + h / 2 - s / 2 },
    { id: 's', x: x + w / 2 - s / 2, y: y + h - s / 2 },
  ]
  for (const handle of handles) {
    if (wx >= handle.x && wx <= handle.x + s && wy >= handle.y && wy <= handle.y + s) return handle.id
  }
  return null
}

// ─── Canvas Component ───────────────────────────────────────────────

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const needsRedraw = useRef(true)
  const lastSize = useRef({ w: 0, h: 0 })
  const dragRef = useRef<any>(null)
  const mouseWorld = useRef({ x: 0, y: 0 })
  const lassoRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const snapGuides = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; wx: number; wy: number; itemId?: string } | null>(null)
  const [showLayers, setShowLayers] = useState(false)
  const [eyedropperActive, setEyedropperActive] = useState(false)
  const [addToolbarOpen, setAddToolbarOpen] = useState(false)
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set())
  const [editingItem, setEditingItem] = useState<{ id: string; field: string; value: string } | null>(null)
  const [editingFile, setEditingFile] = useState<{ id: string; filePath: string; fileName: string; content: string; language: string } | null>(null)
  const [canvasConversations, setCanvasConversations] = useState<Map<string, { parentId: string; responseIds: string[] }>>(new Map())
  const [isGeneratingResponse, setIsGeneratingResponse] = useState<Set<string>>(new Set())

  // ─── Quick Input Box ──────────────────────────────────────────────
  const [quickInputOpen, setQuickInputOpen] = useState(false)
  const [quickInputValue, setQuickInputValue] = useState('')
  const [quickInputPos, setQuickInputPos] = useState({ x: 0, y: 0 })
  const quickInputRef = useRef<HTMLInputElement>(null)

  // Smart node type detection based on input content
  const detectNodeType = useCallback((input: string): { kind: string; extra?: any } => {
    const trimmed = input.trim()

    // URL detection
    if (trimmed.match(/^https?:\/\//i)) {
      return { kind: 'link', extra: { url: trimmed, title: '', summary: '' } }
    }

    // Color hex detection
    if (trimmed.match(/^#[0-9a-fA-F]{3,8}$/)) {
      return { kind: 'swatch', extra: { hex: trimmed, name: '' } }
    }

    // Multiple colors (palette)
    if (trimmed.match(/(#[0-9a-fA-F]{3,8}[\s,]+){2,}/)) {
      const colors = trimmed.match(/#[0-9a-fA-F]{3,8}/g) || []
      return { kind: 'palette', extra: { label: 'Colors', colors: colors.map(hex => ({ hex, label: '' })) } }
    }

    // Question or search query (starts with ? or "search" or "find")
    if (trimmed.startsWith('?') || trimmed.match(/^(search|find|look up|what is|how to|who is)/i)) {
      return { kind: 'note', extra: { tags: ['query'] } }
    }

    // Task or todo (starts with - or * or "todo" or "task")
    if (trimmed.match(/^[-*]\s/) || trimmed.match(/^(todo|task|do|remember|note to self)/i)) {
      return { kind: 'note', extra: { tags: ['task', 'todo'] } }
    }

    // Image description (starts with "image:" or "img:" or "picture:")
    if (trimmed.match(/^(image|img|picture|photo|screenshot)/i)) {
      return { kind: 'image', extra: { description: trimmed.replace(/^(image|img|picture|photo|screenshot):?\s*/i, '') } }
    }

    // Default to note
    return { kind: 'note' }
  }, [])

  // Toggle quick input with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      // Press '/' to open quick input
      if (e.key === '/') {
        e.preventDefault()
        const state = useStore.getState()
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const cx = (rect.width / 2 - state.canvas.panX) / state.canvas.zoom
          const cy = (rect.height / 2 - state.canvas.panY) / state.canvas.zoom
          setQuickInputPos({ x: cx - 150, y: cy - 100 })
        }
        setQuickInputOpen(true)
        setTimeout(() => quickInputRef.current?.focus(), 50)
      }

      // Press 'Space' on a selected note → ask AI to respond
      if (e.key === ' ' && !quickInputOpen) {
        e.preventDefault()
        const state = useStore.getState()
        const selectedIds = [...state.selectedIds]

        if (selectedIds.length === 1) {
          const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
          const selectedItem = vp?.items.find(i => i.id === selectedIds[0])

          if (selectedItem && (selectedItem.kind === 'note' || selectedItem.kind === 'text')) {
            // Ask AI to respond to this note
            requestCanvasResponse(selectedItem)
            return
          }
        }

        // If no note selected, open quick input
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const cx = (rect.width / 2 - state.canvas.panX) / state.canvas.zoom
          const cy = (rect.height / 2 - state.canvas.panY) / state.canvas.zoom
          setQuickInputPos({ x: cx - 150, y: cy - 100 })
        }
        setQuickInputOpen(true)
        setTimeout(() => quickInputRef.current?.focus(), 50)
      }

      // Escape to close
      if (e.key === 'Escape' && quickInputOpen) {
        setQuickInputOpen(false)
        setQuickInputValue('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [quickInputOpen])

  const project = useStore((s) => s.project)
  const activeViewportId = useStore((s) => s.activeViewportId)
  const canvas = useStore((s) => s.canvas)
  const selectedIds = useStore((s) => s.selectedIds)
  const focusedWebNodeId = useStore((s) => s.focusedWebNodeId)
  const viewport = project.viewports.find(v => v.id === activeViewportId) ?? project.viewports[0]
  const items = viewport?.items ?? []

  // Subscribe to store changes → trigger redraw
  useEffect(() => {
    const unsub = useStore.subscribe(() => { needsRedraw.current = true })
    return unsub
  }, [])

  // Revoke blob URLs when items are removed from the board
  const prevItemIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentIds = new Set(items.map(i => i.id))
    for (const id of prevItemIds.current) {
      if (!currentIds.has(id)) {
        // Item was removed — find its blob URLs from the cache and revoke them
        for (const [url] of imageCache) {
          if (isBlobUrl(url)) {
            // Check if any remaining item still uses this URL
            const stillUsed = items.some((i: any) =>
              i.thumbnail === url || i.fullSource === url || i.source === url
            )
            if (!stillUsed) {
              imageCache.delete(url)
              revokeBlobUrl(url)
            }
          }
        }
      }
    }
    prevItemIds.current = currentIds
  }, [items])

  // Clear stale image failures when project changes
  useEffect(() => {
    maybeClearImageFailed(project.id)
  }, [project.id])

  // ─── Canvas Conversation ──────────────────────────────────────────
  // When user creates a note, they can request an AI response directly on canvas

  const requestCanvasResponse = useCallback(async (noteItem: any) => {
    if (isGeneratingResponse.has(noteItem.id)) return

    const noteText = noteItem.text || noteItem.raw || ''
    if (!noteText.trim()) return

    setIsGeneratingResponse(prev => new Set([...prev, noteItem.id]))

    try {
      const state = useStore.getState()
      const settings = state.project.settings

      // Build a prompt that asks for a canvas response
      const systemPrompt = `You are a creative assistant on a visual mood board. The user has created a note on the canvas. Respond with helpful, creative content that builds on their idea.

IMPORTANT RULES:
1. Respond with ONLY a valid JSON array - no markdown, no explanation, no code blocks
2. Each item should have: kind, text/raw/title, purpose
3. Maximum 3 items
4. Keep text concise but complete (under 150 chars per item)
5. Ensure your JSON is complete and valid - do not truncate

Example response:
[{"kind":"note","text":"Great idea! Consider...","purpose":"Building on your thought"},{"kind":"text","raw":"Additional details...","purpose":"Supporting info"}]`

      const response = await fetch(`${getApiBaseUrl()}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.defaultModel || 'anthropic/claude-sonnet-4',
          provider: settings.provider || undefined,
          apiKey: settings.apiKey || undefined,
          providerSettings: {
            provider: settings.provider,
            apiKey: settings.apiKey,
            ollamaUrl: settings.ollamaUrl,
            lmstudioUrl: settings.lmstudioUrl,
            customAiUrl: settings.customAiUrl,
            customAiKey: settings.customAiKey,
          },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `My note says: "${noteText}"\n\nRespond with related items for the canvas. Return ONLY valid JSON array.` },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) throw new Error('Failed to get AI response')

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      // Parse the response to extract items
      let items: any[] = []
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanContent = content.trim()
        if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7)
        if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3)
        if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3)
        cleanContent = cleanContent.trim()

        // Try to parse JSON from the response
        const jsonMatch = cleanContent.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          items = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        // If JSON parsing fails, create a single note with the response
        // Truncate to reasonable length but don't cut mid-word
        const truncated = content.length > 300 ? content.slice(0, 300).replace(/\s+\S*$/, '') + '...' : content
        items = [{ kind: 'note', text: truncated || 'AI response generated', purpose: 'AI Response' }]
      }

      // Create response items near the original note
      const responseIds: string[] = []
      const offsetX = (noteItem.size?.w || 250) + 40
      const startY = noteItem.pos.y

      items.forEach((item: any, idx: number) => {
        const newItem = {
          kind: item.kind || 'note',
          id: crypto.randomUUID(),
          text: item.text || item.raw || item.title || '',
          raw: item.raw || item.text || '',
          purpose: item.purpose || 'AI Response',
          importance: 'AI generated',
          tags: ['ai-response', 'canvas-conversation'],
          pos: {
            x: noteItem.pos.x + offsetX,
            y: startY + (idx * 130),
          },
          size: { w: 280, h: 100 },
        }
        state.addItem(newItem)
        responseIds.push(newItem.id)
      })

      // Track the conversation
      setCanvasConversations(prev => {
        const next = new Map(prev)
        const existing = next.get(noteItem.id)
        next.set(noteItem.id, {
          parentId: noteItem.id,
          responseIds: [...(existing?.responseIds || []), ...responseIds],
        })
        return next
      })

      // Create connectors between note and responses
      responseIds.forEach(responseId => {
        state.addConnection({
          fromItemId: noteItem.id,
          fromPortId: 'note-out',
          toItemId: responseId,
          toPortId: 'note-in',
        })
      })

      showToast('AI response added to canvas', 'success')
    } catch (err) {
      console.error('Canvas conversation error:', err)

      // Provide helpful error message based on the error
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      const currentProvider = useStore.getState().project.settings.provider || 'openrouter'
      const isLocalProvider = currentProvider === 'ollama' || currentProvider === 'lmstudio' || currentProvider === 'custom'
      const isProduction = window.location.hostname.includes('railway.app') || window.location.hostname.includes('up.railway.app')

      if (isLocalProvider && isProduction) {
        showToast('Local AI providers require running MoodBored locally. Use npm run dev.', 'error')
      } else if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
        showToast(`Cannot connect to ${currentProvider}. Make sure it's running.`, 'error')
      } else {
        showToast('Failed to get AI response', 'error')
      }
    } finally {
      setIsGeneratingResponse(prev => {
        const next = new Set(prev)
        next.delete(noteItem.id)
        return next
      })
    }
  }, [isGeneratingResponse])

  // Handle annotation double-click for canvas conversation
  const handleAnnotationConversation = useCallback(async (annotation: any) => {
    if (annotation.type !== 'text') return
    const text = (annotation as any).text || ''
    if (!text.trim()) return

    // Create a temporary note item for the conversation
    const tempNote = {
      id: annotation.id,
      text: text,
      pos: { x: annotation.x, y: annotation.y },
      size: { w: 250, h: 100 },
    }

    await requestCanvasResponse(tempNote)
  }, [requestCanvasResponse])

  // Submit quick input - creates node and triggers AI response
  const handleQuickInputSubmit = useCallback(async () => {
    const trimmed = quickInputValue.trim()
    if (!trimmed) return

    const state = useStore.getState()
    const { kind, extra } = detectNodeType(trimmed)

    // Create the node
    const newItem: any = {
      kind,
      id: crypto.randomUUID(),
      pos: { x: quickInputPos.x, y: quickInputPos.y },
      size: { w: 300, h: 200 },
      tags: [],
      purpose: '',
      importance: '',
    }

    // Set content based on type
    switch (kind) {
      case 'note':
        newItem.text = trimmed
        newItem.tags = [...(extra?.tags || [])]
        break
      case 'text':
        newItem.raw = trimmed
        break
      case 'link':
        newItem.url = extra?.url || trimmed
        newItem.title = extra?.title || ''
        newItem.summary = extra?.summary || ''
        break
      case 'swatch':
        newItem.hex = extra?.hex || '#8b7dc8'
        newItem.name = extra?.name || ''
        break
      case 'palette':
        newItem.label = extra?.label || 'Colors'
        newItem.colors = extra?.colors || []
        break
      case 'image':
        newItem.description = extra?.description || ''
        newItem.thumbnail = ''
        newItem.fullSource = ''
        break
      default:
        newItem.text = trimmed
    }

    state.addItem(newItem)

    // Close input and clear
    setQuickInputOpen(false)
    setQuickInputValue('')

    // Trigger AI response automatically
    await requestCanvasResponse(newItem)
  }, [quickInputValue, quickInputPos, detectNodeType, requestCanvasResponse])

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) needsRedraw.current = true
    }, { threshold: 0 })
    if (canvasRef.current) observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [])

  // Draw loop — only redraws when needed
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) { console.warn('[Canvas] no canvas ref'); return }
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (needsRedrawGlobal) {
        needsRedrawGlobal = false
        needsRedraw.current = true
      }
      if (!needsRedraw.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      needsRedraw.current = false

      try {
      const state = useStore.getState()
      const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
      const its = vp?.items ?? []
      const conns = vp?.connections ?? []
      const c = state.canvas
      const sel = state.selectedIds

      const dpr = window.devicePixelRatio || 1
      const rect = cvs.getBoundingClientRect()
      const pw = Math.round(rect.width * dpr)
      const ph = Math.round(rect.height * dpr)

      if (pw === 0 || ph === 0) { rafRef.current = requestAnimationFrame(draw); return }

      // Only resize canvas when dimensions actually change
      if (lastSize.current.w !== pw || lastSize.current.h !== ph) {
        cvs.width = pw
        cvs.height = ph
        lastSize.current = { w: pw, h: ph }
        gridCanvas = null // invalidate grid cache
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Background — transparent if video, solid if color
      const bgType = state.project.settings.canvasBgType || 'color'
      if (bgType !== 'video') {
        ctx.fillStyle = state.project.settings.canvasBg || '#e0f2fe'
        ctx.fillRect(0, 0, rect.width, rect.height)
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height)
      }

      ctx.save()
      ctx.translate(c.panX, c.panY)
      ctx.scale(c.zoom, c.zoom)

      // Grid (cached)
      const grid = getGridTile(c.zoom, Math.ceil(rect.width / c.zoom) + 60, Math.ceil(rect.height / c.zoom) + 60)
      if (grid) {
        const startX = Math.floor(-c.panX / c.zoom / 30) * 30
        const startY = Math.floor(-c.panY / c.zoom / 30) * 30
        ctx.drawImage(grid, startX, startY)
      }

      // Crosshair
      ctx.strokeStyle = crosshairColor()
      ctx.lineWidth = 1.5 / c.zoom
      ctx.beginPath()
      ctx.moveTo(-20 / c.zoom, 0); ctx.lineTo(20 / c.zoom, 0)
      ctx.moveTo(0, -20 / c.zoom); ctx.lineTo(0, 20 / c.zoom)
      ctx.stroke()

      // Connections
      for (const conn of conns) drawPortConnection(ctx, conn, its, c.zoom)
      for (const item of its) { if (item.kind === 'connector') drawLegacyConnector(ctx, item, its, c.zoom) }

      // In-progress connection
      if (state.connectingFrom && dragRef.current?.type === 'port') {
        const fromPos = getPortPos(state.connectingFrom.itemId, state.connectingFrom.portId, its)
        if (fromPos) {
          const mw = mouseWorld.current
          ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2 / c.zoom
          ctx.setLineDash([6 / c.zoom, 4 / c.zoom])
          ctx.beginPath(); ctx.moveTo(fromPos.x, fromPos.y)
          const cp = Math.abs(mw.x - fromPos.x) * 0.5
          ctx.bezierCurveTo(fromPos.x + cp, fromPos.y, mw.x - cp, mw.y, mw.x, mw.y)
          ctx.stroke(); ctx.setLineDash([])
        }
      }

      // Items (skip web items - they are rendered as HTML overlays)
      // Viewport culling: only draw items visible in viewport
      const viewLeft = -c.panX / c.zoom - 100
      const viewTop = -c.panY / c.zoom - 100
      const viewRight = viewLeft + rect.width / c.zoom + 200
      const viewBottom = viewTop + rect.height / c.zoom + 200
      
      const isItemVisible = (item: any) => {
        if (!item || !('pos' in item)) return true
        const w = item.size?.w ?? 250
        const h = item.size?.h ?? 150
        return !(item.pos.x + w < viewLeft || item.pos.x > viewRight || 
                 item.pos.y + h < viewTop || item.pos.y > viewBottom)
      }

      // Draw regions first (send to back)
      for (const item of its) {
        if (item.kind !== 'region' || !('pos' in item)) continue
        if (!isItemVisible(item)) continue
        drawItem(ctx, item, sel.has(item.id), c.zoom)
      }

      // Draw all other items on top of regions
      for (const item of its) {
        if (item.kind === 'connector' || item.kind === 'web' || item.kind === 'region' || !('pos' in item)) continue
        if (!isItemVisible(item)) continue  // Cull off-screen items
        drawItem(ctx, item, sel.has(item.id), c.zoom)
      }

      // Resize handles (skip web items, only visible)
      for (const item of its) {
        if (item.kind === 'connector' || item.kind === 'web' || !('pos' in item)) continue
        if (!isItemVisible(item)) continue
        if (sel.has(item.id)) drawResizeHandles(ctx, item, c.zoom)
      }

      // Ports (skip web items, only visible)
      for (const item of its) {
        if (item.kind === 'connector' || item.kind === 'web' || !('pos' in item)) continue
        if (!isItemVisible(item)) continue
        if ('ports' in item && item.ports) drawPorts(ctx, item, c.zoom)
      }

      // Alignment guides (snap lines during drag)
      if (dragRef.current?.type === 'item' && snapGuides.current.x.length + snapGuides.current.y.length > 0) {
        ctx.save()
        ctx.strokeStyle = isDark() ? 'rgba(45,212,191,0.6)' : 'rgba(13,148,136,0.6)'
        ctx.lineWidth = 1 / c.zoom
        ctx.setLineDash([4 / c.zoom, 4 / c.zoom])
        for (const gx of snapGuides.current.x) {
          ctx.beginPath(); ctx.moveTo(gx, -10000); ctx.lineTo(gx, 10000); ctx.stroke()
        }
        for (const gy of snapGuides.current.y) {
          ctx.beginPath(); ctx.moveTo(-10000, gy); ctx.lineTo(10000, gy); ctx.stroke()
        }
        ctx.setLineDash([])
        ctx.restore()
      }

      // Lasso selection rectangle
      if (lassoRef.current) {
        const l = lassoRef.current
        const lx = Math.min(l.sx, l.cx); const ly = Math.min(l.sy, l.cy)
        const lw = Math.abs(l.cx - l.sx); const lh = Math.abs(l.cy - l.sy)
        ctx.fillStyle = isDark() ? 'rgba(45,212,191,0.08)' : 'rgba(13,148,136,0.08)'
        ctx.fillRect(lx, ly, lw, lh)
        ctx.strokeStyle = isDark() ? 'rgba(45,212,191,0.5)' : 'rgba(13,148,136,0.5)'
        ctx.lineWidth = 1.5 / c.zoom
        ctx.setLineDash([6 / c.zoom, 4 / c.zoom])
        ctx.strokeRect(lx, ly, lw, lh)
        ctx.setLineDash([])
      }

      // Empty state
      if (its.filter(i => i.kind !== 'connector').length === 0) {
        ctx.fillStyle = txtPrimary()
        ctx.font = `600 ${20 / c.zoom}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('Start building your board', 0, -20 / c.zoom)
        
        ctx.fillStyle = txtSecondary()
        ctx.font = `${14 / c.zoom}px Inter, sans-serif`
        ctx.fillText('Double-click anywhere to add your first card', 0, 15 / c.zoom)
        
        ctx.fillStyle = txtMuted()
        ctx.font = `${12 / c.zoom}px Inter, sans-serif`
        ctx.fillText('or drag & drop images and links here', 0, 40 / c.zoom)
        ctx.textAlign = 'start'
      }

      ctx.restore()
      } catch (err) {
        console.warn('[MoodBored] draw error:', err)
        needsRedraw.current = true // retry next frame
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Input Handlers ──

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const state = useStore.getState()
    const wx = (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom
    const wy = (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom

    // Close context menu on any click
    setContextMenu(null)

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      dragRef.current = { type: 'pan', sx: e.clientX - state.canvas.panX, sy: e.clientY - state.canvas.panY }
      return
    }

    const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
    const its = vp?.items ?? []

    // Port hit
    if (e.button === 0) {
      const ph = hitTestPort(its, wx, wy, state.canvas.zoom)
      if (ph) {
        const pItem = its.find(i => i.id === ph.itemId && 'ports' in i)
        const port = pItem && 'ports' in pItem ? pItem.ports?.find(p => p.id === ph.portId) : null
        if (port) {
          if (port.direction === 'output') {
            state.startConnect(ph.itemId, ph.portId)
            dragRef.current = { type: 'port', sx: e.clientX, sy: e.clientY }
            return
          } else if (state.connectingFrom) {
            const from = state.connectingFrom
            if (from.itemId !== ph.itemId) state.addConnection({ fromItemId: from.itemId, fromPortId: from.portId, toItemId: ph.itemId, toPortId: ph.portId })
            state.endConnect(); dragRef.current = null; return
          }
        }
      }
    }

    // Resize hit
    if (e.button === 0) {
      for (const item of its) {
        if (!state.selectedIds.has(item.id)) continue
        const handle = hitTestResize(item, wx, wy, state.canvas.zoom)
        if (handle && 'pos' in item && 'size' in item) {
          state.pushHistory()
          dragRef.current = { type: 'resize', sx: e.clientX, sy: e.clientY, itemId: item.id, handle, ix: item.pos.x, iy: item.pos.y, iw: item.size?.w ?? 250, ih: item.size?.h ?? 150 }
          return
        }
      }
    }

    // Right-click connector
    if (e.button === 2) {
      const hit = hitTestItem(its, wx, wy)
      if (hit && 'ports' in hit) {
        e.preventDefault()
        const outPort = hit.ports?.find(p => p.direction === 'output')
        if (outPort) {
          state.startConnect(hit.id, outPort.id)
          dragRef.current = { type: 'port', sx: e.clientX, sy: e.clientY }
        }
      }
      return
    }

    // Item select/drag
    const hit = hitTestItem(its, wx, wy)
    if (hit) {
      if (e.shiftKey) state.toggleSelect(hit.id)
      else if (!state.selectedIds.has(hit.id)) state.selectItem(hit.id)
      if ('pos' in hit) {
        state.pushHistory()
        const sel = state.selectedIds.has(hit.id) ? state.selectedIds : new Set([hit.id])
        const starts = new Map<string, { x: number; y: number }>()
        for (const id of sel) {
          const it = its.find(i => i.id === id)
          if (it && 'pos' in it) starts.set(id, { x: it.pos.x, y: it.pos.y })
        }
        dragRef.current = { type: 'item', sx: e.clientX, sy: e.clientY, starts }
      }
    } else {
      // Start lasso selection on empty canvas
      lassoRef.current = { sx: wx, sy: wy, cx: wx, cy: wy }
      if (!e.shiftKey) state.clearSelection()
      if (state.connectingFrom) state.endConnect()
    }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const state = useStore.getState()
    mouseWorld.current = {
      x: (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom,
      y: (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom,
    }
    needsRedraw.current = true

    const d = dragRef.current
    if (!d && !lassoRef.current) return

    // Lasso tracking
    if (lassoRef.current) {
      const wx = (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom
      const wy = (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom
      lassoRef.current.cx = wx
      lassoRef.current.cy = wy
      return
    }

    if (!d) return

    if (d.type === 'pan') {
      state.setPan(e.clientX - d.sx, e.clientY - d.sy)
    } else if (d.type === 'item' && d.starts) {
      const dx = (e.clientX - d.sx) / state.canvas.zoom
      const dy = (e.clientY - d.sy) / state.canvas.zoom
      // Alignment snapping — find nearest edges of other items
      const SNAP_THRESHOLD = 8 / state.canvas.zoom
      const guidesX: number[] = []
      const guidesY: number[] = []
      const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
      const others = (vp?.items ?? []).filter(i => i.kind !== 'connector' && 'pos' in i && !d.starts.has(i.id))
      for (const [id, start] of d.starts) {
        const movedItem = (vp?.items ?? []).find(i => i.id === id)
        if (!movedItem || !('pos' in movedItem)) continue
        const w = (movedItem as any).size?.w ?? 250
        const h = (movedItem as any).size?.h ?? 150
        const nx = start.x + dx; const ny = start.y + dy
        for (const other of others) {
          if (!('pos' in other)) continue
          const ow = (other as any).size?.w ?? 250
          const oh = (other as any).size?.h ?? 150
          // Left-to-left, left-to-right, right-to-right, center-to-center
          const xPairs = [
            [nx, other.pos.x], [nx, other.pos.x + ow], [nx + w, other.pos.x], [nx + w, other.pos.x + ow],
            [nx + w / 2, other.pos.x + ow / 2],
          ]
          for (const [a, b] of xPairs) {
            if (Math.abs(a - b) < SNAP_THRESHOLD) { guidesX.push(b); break }
          }
          const yPairs = [
            [ny, other.pos.y], [ny, other.pos.y + oh], [ny + h, other.pos.y], [ny + h, other.pos.y + oh],
            [ny + h / 2, other.pos.y + oh / 2],
          ]
          for (const [a, b] of yPairs) {
            if (Math.abs(a - b) < SNAP_THRESHOLD) { guidesY.push(b); break }
          }
        }
      }
      snapGuides.current = { x: [...new Set(guidesX)], y: [...new Set(guidesY)] }
      for (const [id, start] of d.starts) {
        state.moveItem(id, { x: start.x + dx, y: start.y + dy })
      }
    } else if (d.type === 'resize' && d.itemId) {
      const dx = (e.clientX - d.sx) / state.canvas.zoom
      const dy = (e.clientY - d.sy) / state.canvas.zoom
      let nw = d.iw, nh = d.ih
      if (d.handle === 'se' || d.handle === 'e') nw = Math.max(100, d.iw + dx)
      if (d.handle === 'se' || d.handle === 's') nh = Math.max(80, d.ih + dy)
      state.updateItemNoHistory(d.itemId, { pos: { x: d.ix, y: d.iy }, size: { w: nw, h: nh } })
    }
  }

  const onMouseUp = (e: React.MouseEvent) => {
    const d = dragRef.current
    const state = useStore.getState()
    
    // Push history at end of resize (not during)
    if (d?.type === 'resize') {
      state.pushHistory()
    }
    
    if (d?.type === 'port' && state.connectingFrom) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const wx = (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom
        const wy = (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
        const ph = hitTestPort(vp?.items ?? [], wx, wy, state.canvas.zoom)
        if (ph) {
          const from = state.connectingFrom
          if (from.itemId !== ph.itemId) state.addConnection({ fromItemId: from.itemId, fromPortId: from.portId, toItemId: ph.itemId, toPortId: ph.portId })
        }
      }
      state.endConnect()
    }
    // Complete lasso selection
    if (lassoRef.current) {
      const l = lassoRef.current
      const lx = Math.min(l.sx, l.cx); const ly = Math.min(l.sy, l.cy)
      const rx = Math.max(l.sx, l.cx); const ry = Math.max(l.sy, l.cy)
      const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
      const newSel = new Set<string>()
      for (const item of (vp?.items ?? [])) {
        if (item.kind === 'connector' || !('pos' in item)) continue
        const w = (item as any).size?.w ?? 250; const h = (item as any).size?.h ?? 150
        if (item.pos.x + w > lx && item.pos.x < rx && item.pos.y + h > ly && item.pos.y < ry) {
          newSel.add(item.id)
        }
      }
      if (newSel.size > 0) {
        useStore.setState({ selectedIds: newSel })
      }
      lassoRef.current = null
      return
    }

    // Clear snap guides
    snapGuides.current = { x: [], y: [] }

    dragRef.current = null
  }

  // Native wheel listener (non-passive) to prevent browser zoom
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    
    const handleWheelNative = (e: WheelEvent) => {
      // Prevent browser zoom on Ctrl/Cmd + scroll (trackpad pinch)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const state = useStore.getState()
        state.zoomAt(e.clientX - cvs.getBoundingClientRect().left, e.clientY - cvs.getBoundingClientRect().top, e.deltaY)
        needsRedraw.current = true
      }
    }
    
    cvs.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => cvs.removeEventListener('wheel', handleWheelNative)
  }, [])

  const onWheel = (e: React.WheelEvent) => {
    const state = useStore.getState()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    needsRedraw.current = true
    // Ctrl/Cmd + scroll = zoom (handled by native listener above)
    if (e.ctrlKey || e.metaKey) {
      return // Already handled by native listener
    }
    // Alt + scroll = zoom
    if (e.altKey) {
      state.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY)
    } else {
      // Regular scroll = pan
      state.setPan(state.canvas.panX - e.deltaX, state.canvas.panY - e.deltaY)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const state = useStore.getState()
    const wx = (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom
    const wy = (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file); blobUrls.add(url)
        state.addItem({ kind: 'image', id: crypto.randomUUID(), thumbnail: url, fullSource: url, description: file.name, purpose: 'Dropped by user', importance: 'User reference', source: `file:${file.name}`, tags: [], pos: { x: wx, y: wy }, size: { w: 300, h: 200 } })
      } else if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file); blobUrls.add(url)
        state.addItem({ kind: 'video', id: crypto.randomUUID(), source: url, sourceUrl: url, startTs: 0, duration: 0, subjectDesc: file.name, motionDesc: '', purpose: 'Dropped by user', importance: 'User video', tags: [], pos: { x: wx, y: wy }, size: { w: 320, h: 240 } })
      } else {
        state.addItem({ kind: 'note', id: crypto.randomUUID(), text: `File: ${file.name}`, purpose: 'Dropped file', importance: 'User file', tags: [`file:${file.name}`], pos: { x: wx, y: wy } })
      }
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const s = useStore.getState()
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const ids = [...s.selectedIds]
        if (ids.length > 0) s.removeItems(ids)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); s.toggleSearch() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); s.selectAll() }
      if (e.key === 'Escape') {
        s.endConnect()
        s.clearSelection()
        if (s.focusedWebNodeId) s.focusWebNode(null)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); s.undo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); s.redo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); s.redo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') { e.preventDefault(); s.copySelected() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') { e.preventDefault(); s.paste() }
      // Paste images from clipboard
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        navigator.clipboard.read?.().then(async (items) => {
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type)
                const url = URL.createObjectURL(blob); blobUrls.add(url)
                s.addItem({
                  kind: 'image', id: crypto.randomUUID(),
                  thumbnail: url, fullSource: url,
                  description: 'Pasted image', source: 'clipboard',
                  purpose: 'Pasted by user', importance: 'User reference',
                  tags: ['pasted'], pos: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
                  size: { w: 300, h: 200 },
                } as any)
              }
            }
          }
        }).catch(() => {})
      }

      // ─── Single-key shortcuts (only when not typing) ───────────
      // Create items at canvas center
      const cx = -s.canvas.panX / s.canvas.zoom + 400
      const cy = -s.canvas.panY / s.canvas.zoom + 300
      if (e.key === 'n' || e.key === 'N') { s.addItem(createDefaultItem('note', { x: cx + Math.random() * 100, y: cy + Math.random() * 100 })); e.preventDefault() }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) { s.addItem(createDefaultItem('text', { x: cx, y: cy })); e.preventDefault() }
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey) { s.addItem(createDefaultItem('image', { x: cx, y: cy })); e.preventDefault() }
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) {
        const url = prompt('Paste link URL:')
        if (url && url.trim()) {
          const item = createDefaultItem('link', { x: cx, y: cy })
          ;(item as any).url = url.trim()
          ;(item as any).title = url.trim().split('/').pop() || url.trim()
          s.addItem(item)
        }
        e.preventDefault()
      }
      if (e.key === 'p' && !e.metaKey && !e.ctrlKey) { s.addItem(createDefaultItem('palette', { x: cx, y: cy })); e.preventDefault() }
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) { s.addItem(createDefaultItem('gradient', { x: cx, y: cy })); e.preventDefault() }
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) { s.addItem(createDefaultItem('font', { x: cx, y: cy })); e.preventDefault() }
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey) { s.addItem(createDefaultItem('video', { x: cx, y: cy })); e.preventDefault() }
      // Zoom shortcuts
      if (e.key === '=' || e.key === '+') { s.setZoom(s.canvas.zoom * 1.2); e.preventDefault() }
      if (e.key === '-') { s.setZoom(s.canvas.zoom * 0.8); e.preventDefault() }
      if (e.key === '0') { s.setZoom(1); s.setPan(0, 0); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const state = useStore.getState()
    const wx = (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom
    const wy = (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom
    const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
    const hit = hitTestItem(vp?.items ?? [], wx, wy)

    // Double-click on empty canvas → create a blank card (WebNode handles input)
    if (!hit) {
      const id = state.createBlankCard({ x: wx - 150, y: wy - 100 })
      // WebNode component will render the input
      return
    }

    // Double-click on note/text → inline edit
    if (hit.kind === 'note' || hit.kind === 'text') {
      const field = hit.kind === 'note' ? 'text' : 'raw'
      const value = (hit as any)[field] || ''
      setEditingItem({ id: hit.id, field, value })
      return
    }

    // Double-click on file → open Monaco Editor
    if (hit.kind === 'file') {
      const fileItem = hit as any
      setEditingFile({
        id: fileItem.id,
        filePath: fileItem.filePath || '',
        fileName: fileItem.fileName || 'untitled',
        content: fileItem.content || '',
        language: fileItem.language || 'plaintext',
      })
      return
    }

    // Double-click on image that's already selected → open lightbox
    if (hit.kind === 'image' && state.selectedIds.has(hit.id)) {
      window.dispatchEvent(new CustomEvent('moodbored:lightbox', { detail: hit }))
      return
    }

    // Double-click on link → toggle iframe preview
    if (hit.kind === 'link') {
      setExpandedLinks((prev) => {
        const next = new Set(prev)
        if (next.has(hit.id)) next.delete(hit.id)
        else next.add(hit.id)
        return next
      })
      return
    }

    // Double-click on palette → open color picker for nearest swatch
    if (hit.kind === 'palette' && 'colors' in hit) {
      const palette = hit as any
      const localX = wx - hit.pos.x - PAD
      const swatchWidth = Math.min(60, ((hit.size?.w ?? 320) - PAD * 2 - (palette.colors.length - 1) * 4) / Math.max(palette.colors.length, 1))
      const colorIndex = Math.floor((localX - 0) / (swatchWidth + 4))
      if (colorIndex >= 0 && colorIndex < palette.colors.length) {
        const color = palette.colors[colorIndex]
        const newColor = prompt('Edit color hex:', color.hex)
        if (newColor && /^#[0-9a-fA-F]{6}$/.test(newColor.trim())) {
          const updatedColors = [...palette.colors]
          updatedColors[colorIndex] = { ...color, hex: newColor.trim() }
          state.updateItem(hit.id, { colors: updatedColors })
        }
      }
      return
    }

    // Otherwise select and open inspector
    state.selectItem(hit.id)
    if (!state.inspectorOpen) state.toggleInspector()
  }

  // Single click on note/text → expand/collapse
  const onClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const state = useStore.getState()
    const wx = (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom
    const wy = (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom
    const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
    const hit = hitTestItem(vp?.items ?? [], wx, wy)
    if (hit && (hit.kind === 'note' || hit.kind === 'text')) {
      state.setExpandedItem(state.expandedItemId === hit.id ? null : hit.id)
    }
  }

  // Right-click context menu
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const state = useStore.getState()
    const wx = (e.clientX - rect.left - state.canvas.panX) / state.canvas.zoom
    const wy = (e.clientY - rect.top - state.canvas.panY) / state.canvas.zoom
    const vp = state.project.viewports.find(v => v.id === state.activeViewportId) ?? state.project.viewports[0]
    const hit = hitTestItem(vp?.items ?? [], wx, wy)
    if (hit && !state.selectedIds.has(hit.id)) state.selectItem(hit.id)
    setContextMenu({ x: e.clientX, y: e.clientY, wx, wy, itemId: hit?.id })
  }

  const handleContextAction = (action: string) => {
    const state = useStore.getState()
    if (!contextMenu) return
    switch (action) {
      case 'delete': {
        const ids = [...state.selectedIds]
        if (ids.length > 0) state.removeItems(ids)
        break
      }
      case 'duplicate':
        state.copySelected(); state.paste({ x: 30, y: 30 })
        break
      case 'copy':
        state.copySelected()
        showToast('Copied', 'success')
        break
      case 'paste':
        state.paste({ x: contextMenu.wx, y: contextMenu.wy })
        break
      case 'edit':
        if (contextMenu.itemId) {
          state.selectItem(contextMenu.itemId)
          state.toggleInspector()
        }
        break
      case 'bring-front': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        if (!vp) break
        state.pushHistory()
        const selected = vp.items.filter(i => state.selectedIds.has(i.id))
        const rest = vp.items.filter(i => !state.selectedIds.has(i.id))
        useStore.setState((s) => ({
          project: { ...s.project, viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId ? { ...v, items: [...rest, ...selected] } : v
          )},
        }))
        break
      }
      case 'bring-forward': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        if (!vp) break
        state.pushHistory()
        const items = [...vp.items]
        for (const id of state.selectedIds) {
          const idx = items.findIndex(i => i.id === id)
          if (idx < items.length - 1 && idx >= 0) {
            [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]]
          }
        }
        useStore.setState((s) => ({
          project: { ...s.project, viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId ? { ...v, items } : v
          )},
        }))
        break
      }
      case 'send-backward': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        if (!vp) break
        state.pushHistory()
        const items = [...vp.items]
        for (const id of state.selectedIds) {
          const idx = items.findIndex(i => i.id === id)
          if (idx > 0) {
            [items[idx], items[idx - 1]] = [items[idx - 1], items[idx]]
          }
        }
        useStore.setState((s) => ({
          project: { ...s.project, viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId ? { ...v, items } : v
          )},
        }))
        break
      }
      case 'send-back': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        if (!vp) break
        state.pushHistory()
        const selected = vp.items.filter(i => state.selectedIds.has(i.id))
        const rest = vp.items.filter(i => !state.selectedIds.has(i.id))
        useStore.setState((s) => ({
          project: { ...s.project, viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId ? { ...v, items: [...selected, ...rest] } : v
          )},
        }))
        break
      }
      case 'select-all':
        state.selectAll()
        break
      case 'fit-all': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        if (!vp) break
        const positioned = vp.items.filter(i => i.kind !== 'connector' && 'pos' in i) as any[]
        if (positioned.length === 0) break
        const minX = Math.min(...positioned.map(i => i.pos.x))
        const maxX = Math.max(...positioned.map(i => i.pos.x + (i.size?.w ?? 250)))
        const minY = Math.min(...positioned.map(i => i.pos.y))
        const maxY = Math.max(...positioned.map(i => i.pos.y + (i.size?.h ?? 150)))
        const r = canvasRef.current?.getBoundingClientRect()
        if (!r) break
        const pad = 80
        const z = Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2) / (maxY - minY), 2)
        state.setZoom(z)
        state.setPan(r.width / 2 - ((minX + maxX) / 2) * z, r.height / 2 - ((minY + maxY) / 2) * z)
        break
      }
      case 'group': {
        const name = prompt('Group name:')
        if (name) state.groupSelected(name)
        break
      }
      case 'lock': {
        // Toggle lock on selected items
        for (const id of state.selectedIds) {
          const item = state.project.viewports.find(v => v.id === state.activeViewportId)?.items.find(i => i.id === id)
          if (item) {
            state.updateItem(id, { locked: !(item as any).locked })
          }
        }
        showToast('Toggled lock', 'success')
        break
      }
      case 'annotate': {
        state.setAnnotationTool('text')
        showToast('Annotation tool active - click to add text', 'info')
        break
      }
      case 'connect': {
        if (contextMenu.itemId) {
          state.startConnect(contextMenu.itemId, 'out')
          showToast('Click another item to connect', 'info')
        }
        break
      }
      case 'export-png': {
        try {
          const cvs = canvasRef.current
          if (!cvs) break
          const a = document.createElement('a')
          a.download = 'item.png'
          a.href = cvs.toDataURL('image/png')
          a.click()
        } catch {
          showToast('Export failed - cross-origin images', 'error')
        }
        break
      }
      case 'copy-json': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        const items = vp?.items.filter(i => state.selectedIds.has(i.id)) || []
        navigator.clipboard.writeText(JSON.stringify(items, null, 2))
        showToast('Copied as JSON', 'success')
        break
      }
      case 'new-note':
        state.addItem({ kind: 'note', id: crypto.randomUUID(), text: '', purpose: '', importance: '', tags: [], pos: { x: contextMenu.wx - 125, y: contextMenu.wy - 75 } })
        break
      case 'arrange-grid':
        state.arrangeGrid(4, 20)
        showToast('Arranged in grid', 'success')
        break
      case 'arrange-stack-h':
        state.arrangeStack('h', 20)
        showToast('Arranged horizontally', 'success')
        break
      case 'arrange-stack-v':
        state.arrangeStack('v', 20)
        showToast('Arranged vertically', 'success')
        break
      case 'arrange-spiral':
        state.arrangeSpiral(20)
        showToast('Arranged in spiral', 'success')
        break
      case 'create-region': {
        const regionId = crypto.randomUUID()
        state.addItem({
          kind: 'region',
          id: regionId,
          label: 'New Region',
          color: '#8b7dc8',
          fillColor: isDark() ? 'rgba(139,125,200,0.04)' : 'rgba(106,90,174,0.04)',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          opacity: 0.2,
          purpose: '',
          importance: '',
          tags: [],
          locked: false,
          pos: { x: contextMenu.wx - 200, y: contextMenu.wy - 150 },
          size: { w: 400, h: 300 },
        })
        showToast('Region created', 'success')
        break
      }
      case 'present': {
        // Convert board to lesson and enter presentation mode
        import('@/lib/lesson').then(({ projectToLesson }) => {
          const lesson = projectToLesson(state.project)
          state.enterLessonMode(lesson)
          showToast('Presentation mode started', 'success')
        })
        break
      }
      case 'create-lesson': {
        // Open lesson generator modal
        const event = new CustomEvent('moodbored:open-lesson-generator')
        window.dispatchEvent(event)
        break
      }
      case 'ask-ai': {
        // Request AI response for the selected note
        if (contextMenu.itemId) {
          const item = items.find(i => i.id === contextMenu.itemId)
          if (item && (item.kind === 'note' || item.kind === 'text')) {
            requestCanvasResponse(item)
          }
        }
        break
      }
      case 'ai-export': {
        // Open AI export modal
        const event = new CustomEvent('moodbored:open-ai-export')
        window.dispatchEvent(event)
        break
      }
      case 'ai-generate': {
        // Open AI connection modal for image generation
        const event = new CustomEvent('moodbored:open-ai-connection')
        window.dispatchEvent(event)
        break
      }
      case 'delete-file': {
        // Delete file from disk and remove from canvas
        if (contextMenu.itemId) {
          const item = items.find(i => i.id === contextMenu.itemId)
          if (item && item.kind === 'file') {
            const filePath = (item as any).filePath
            if (filePath) {
              fetch('/api/files/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: filePath }),
              }).then(res => {
                if (res.ok) {
                  state.removeItem(contextMenu.itemId!)
                  showToast('File deleted', 'success')
                } else {
                  showToast('Failed to delete file', 'error')
                }
              })
            }
          }
        }
        break
      }
      case 'rename-file': {
        // Rename file on disk
        if (contextMenu.itemId) {
          const item = items.find(i => i.id === contextMenu.itemId)
          if (item && item.kind === 'file') {
            const oldPath = (item as any).filePath
            if (oldPath) {
              const newPath = prompt('New file path:', oldPath)
              if (newPath && newPath !== oldPath) {
                fetch('/api/files/rename', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ oldPath, newPath }),
                }).then(res => {
                  if (res.ok) {
                    state.updateItem(contextMenu.itemId!, {
                      filePath: newPath,
                      fileName: newPath.split('/').pop() || newPath.split('\\').pop() || 'untitled',
                      fileExtension: newPath.split('.').pop() || '',
                    })
                    showToast('File renamed', 'success')
                  } else {
                    showToast('Failed to rename file', 'error')
                  }
                })
              }
            }
          }
        }
        break
      }
    }
    setContextMenu(null)
  }

  // Touch gestures — pinch-to-zoom and touch-drag
  const touchRef = useRef<{ id: number; x: number; y: number }[] | null>(null)
  const pinchRef = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }))
    if (touches.length === 2) {
      const dx = touches[1].x - touches[0].x
      const dy = touches[1].y - touches[0].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const state = useStore.getState()
      pinchRef.current = { dist, zoom: state.canvas.zoom, cx: (touches[0].x + touches[1].x) / 2, cy: (touches[0].y + touches[1].y) / 2 }
    }
    touchRef.current = touches
  }

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }))
    const state = useStore.getState()

    if (touches.length === 2 && pinchRef.current && touchRef.current) {
      const dx = touches[1].x - touches[0].x
      const dy = touches[1].y - touches[0].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scale = dist / pinchRef.current.dist
      const newZoom = Math.max(0.1, Math.min(5, pinchRef.current.zoom * scale))
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const cx = pinchRef.current.cx - rect.left
        const cy = pinchRef.current.cy - rect.top
        const factor = newZoom / state.canvas.zoom
        state.setPan(cx - (cx - state.canvas.panX) * factor, cy - (cy - state.canvas.panY) * factor)
      }
      state.setZoom(newZoom)
    } else if (touches.length === 1 && touchRef.current?.length === 1) {
      const dx = touches[0].x - touchRef.current[0].x
      const dy = touches[0].y - touchRef.current[0].y
      state.setPan(state.canvas.panX + dx, state.canvas.panY + dy)
    }

    touchRef.current = touches
    needsRedraw.current = true
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) touchRef.current = null
  }

  const handleEyedropper = async () => {
    // Use native EyeDropper API if available (Chrome, Edge)
    if ('EyeDropper' in window) {
      try {
        const dropper = new (window as any).EyeDropper()
        const result = await dropper.open()
        const hex = result.sRGBHex
        const state = useStore.getState()
        state.addItem({
          kind: 'swatch', id: crypto.randomUUID(), hex, name: '',
          usage: 'Picked from screen', purpose: 'Color reference',
          importance: 'User-picked color', tags: ['eyedropper'],
          pos: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
          size: { w: 160, h: 180 },
        } as any)
        showToast(`Picked color: ${hex}`, 'success')
      } catch {
        // User cancelled
      }
    } else {
      showToast('Eyedropper not supported in this browser — use Chrome or Edge', 'info')
    }
    setEyedropperActive(false)
  }

  const itemCount = items.filter(i => i.kind !== 'connector').length
  const bgType = project.settings.canvasBgType || 'color'
  const bgVideo = project.settings.canvasBgVideo || ''

  // YouTube detection — returns embed URL or null
  function getYouTubeEmbedUrl(url: string): string | null {
    if (!url) return null
    // Match v= parameter anywhere in query string, or youtu.be short URL
    const m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
    if (!m) return null
    const id = m[1]
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0&iv_load_policy=3`
  }

  const ytEmbed = getYouTubeEmbedUrl(bgVideo)
  const isVideo = bgType === 'video' && bgVideo

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: 'crosshair' }} onDrop={onDrop} onDragOver={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}>
      {/* Video background */}
      {isVideo && ytEmbed && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
          <iframe
            src={ytEmbed}
            style={{ position: 'absolute', top: '50%', left: '50%', width: '120vw', height: '120vh', transform: 'translate(-50%, -50%)', border: 'none', pointerEvents: 'none' }}
            allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen={true}
            key={bgVideo}
            referrerPolicy="origin"
          />
        </div>
      )}
      {isVideo && !ytEmbed && (
        <video
          autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
          key={bgVideo}
        >
          <source src={bgVideo} />
        </video>
      )}

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, background: 'transparent', touchAction: 'none' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onClick={onClick} onDoubleClick={onDoubleClick} onWheel={onWheel} onContextMenu={onContextMenu}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />

      {/* Zoom controls - minimal */}
      <div className="flex items-center gap-1 px-2 py-1 rounded-lg shadow-sm" style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, background: 'var(--bg-surface-1)', border: '1px solid var(--border-color)' }}>
        <button className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors" onClick={() => { useStore.getState().setZoom(canvas.zoom * 0.8); needsRedraw.current = true }}>−</button>
        <span className="text-xs tabular-nums min-w-[32px] text-center">{Math.round(canvas.zoom * 100)}%</span>
        <button className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors" onClick={() => { useStore.getState().setZoom(canvas.zoom * 1.25); needsRedraw.current = true }}>+</button>
      </div>

      {/* Floating Add Toolbar — bottom-right */}
      <div className="add-toolbar">
        {addToolbarOpen && (
          <div className="add-toolbar-items">
            {/* Core items */}
            {ITEM_TYPES.map(({ kind, icon, label }) => (
              <button
                key={kind}
                className="add-toolbar-item"
                title={label}
                onClick={() => {
                  const state = useStore.getState()
                  const cx = -state.canvas.panX / state.canvas.zoom + 400
                  const cy = -state.canvas.panY / state.canvas.zoom + 300
                  // Prompt for URL when creating image or link
                  if (kind === 'image' || kind === 'link') {
                    const url = prompt(kind === 'image' ? 'Paste image URL (or leave empty):' : 'Paste link URL:')
                    if (url && url.trim()) {
                      const item = createDefaultItem(kind, { x: cx, y: cy })
                      if (kind === 'image') {
                        ;(item as any).source = url.trim()
                        ;(item as any).fullSource = url.trim()
                        ;(item as any).thumbnail = url.trim()
                        ;(item as any).description = 'Pasted image'
                      } else {
                        ;(item as any).url = url.trim()
                        ;(item as any).title = url.trim().split('/').pop() || url.trim()
                      }
                      state.addItem(item)
                    } else if (kind === 'link') {
                      // Links require a URL — cancel if none given
                      showToast('Link requires a URL', 'info')
                    } else {
                      // Images can be blank (uploaded later)
                      state.addItem(createDefaultItem(kind, { x: cx, y: cy }))
                    }
                  } else {
                    state.addItem(createDefaultItem(kind, { x: cx, y: cy }))
                  }
                  setAddToolbarOpen(false)
                }}
              >
                {icon}
              </button>
            ))}
            {/* Divider */}
            <div style={{ width: '100%', height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
            {/* Advanced items */}
            {ADVANCED_ITEM_TYPES.map(({ kind, icon, label }) => (
              <button
                key={kind}
                className="add-toolbar-item"
                title={label}
                onClick={() => {
                  const state = useStore.getState()
                  const cx = -state.canvas.panX / state.canvas.zoom + 400
                  const cy = -state.canvas.panY / state.canvas.zoom + 300
                  state.addItem(createDefaultItem(kind, { x: cx, y: cy }))
                  setAddToolbarOpen(false)
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        )}
        <button
          className={`add-toolbar-trigger ${addToolbarOpen ? 'open' : ''}`}
          onClick={() => setAddToolbarOpen(!addToolbarOpen)}
          title="Add item"
        >
          +
        </button>
      </div>

      {/* Video/GIF overlays */}
      {items.filter(i => i.kind === 'video' || (i.kind === 'image' && isGif(i))).map(item => {
        if (!('pos' in item)) return null
        const x = item.pos.x * canvas.zoom + canvas.panX
        const y = item.pos.y * canvas.zoom + canvas.panY
        const w = (item.size?.w ?? 250) * canvas.zoom
        const h = (item.size?.h ?? 150) * canvas.zoom
        if (item.kind === 'video') return <video key={item.id} src={item.source || item.sourceUrl} autoPlay loop muted playsInline style={{ position: 'absolute', left: x, top: y, width: w, height: h, objectFit: 'cover', borderRadius: 10, pointerEvents: 'none', zIndex: 2 }} />
        if (item.kind === 'image') return <img key={item.id} src={item.thumbnail || item.fullSource} alt={item.description} style={{ position: 'absolute', left: x, top: y, width: w, height: h, objectFit: 'cover', borderRadius: 10, pointerEvents: 'none', zIndex: 2 }} />
        return null
      })}

      {/* Expanded link iframes */}
      {items.filter(i => i.kind === 'link' && expandedLinks.has(i.id) && 'url' in i && i.url).map(item => {
        if (!('pos' in item)) return null
        const x = item.pos.x * canvas.zoom + canvas.panX
        const y = item.pos.y * canvas.zoom + canvas.panY
        const w = (item.size?.w ?? 250) * canvas.zoom
        const h = (item.size?.h ?? 150) * canvas.zoom
        return (
          <div key={item.id} className="glass-card" style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 10, overflow: 'hidden', zIndex: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid rgba(124,108,191,0.1)', fontSize: 10, color: isDark() ? '#a898c8' : '#6b5a8a' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(item as any).url}</span>
              <a
                href={(item as any).url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#8b7dc8', textDecoration: 'none', fontSize: 10, fontWeight: 600 }}
                onClick={(e) => e.stopPropagation()}
              >Open ↗</a>
              <button
                onClick={() => setExpandedLinks((prev) => { const n = new Set(prev); n.delete(item.id); return n })}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
              >×</button>
            </div>
            <iframe
              src={(item as any).url}
              style={{ width: '100%', height: 'calc(100% - 28px)', border: 'none' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onError={(e) => {
                // Fallback: show open-in-new-tab message if iframe fails
                const el = e.currentTarget.parentElement?.querySelector('.iframe-error') as HTMLElement
                if (el) el.style.display = 'flex'
              }}
            />
            <div className="iframe-error" style={{ display: 'none', position: 'absolute', inset: 0, top: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, background: isDark() ? '#150f24' : '#f8f5ff', fontSize: 12, color: isDark() ? '#a898c8' : '#6b5a8a' }}>
              <span>This site can't be embedded</span>
              <a href={(item as any).url} target="_blank" rel="noopener noreferrer" className="btn btn-accent text-xs">Open in new tab ↗</a>
            </div>
          </div>
        )
      })}

      {/* Web node overlays */}
      {items.filter(i => i.kind === 'web').map(item => {
        if (!('pos' in item) || item.kind !== 'web') return null
        const webItem = item as WebItem
        const isSelected = selectedIds.has(item.id)
        const isFocused = focusedWebNodeId === item.id
        return (
          <WebNode
            key={item.id}
            item={webItem}
            canvasZoom={canvas.zoom}
            canvasPanX={canvas.panX}
            canvasPanY={canvas.panY}
            isSelected={isSelected}
            isFocused={isFocused}
          />
        )
      })}

      {/* Canvas-level annotation layer - free-floating annotations */}
      <AnnotationLayer
        x={0}
        y={0}
        width={2000}
        height={2000}
        zoom={canvas.zoom}
        isInteractive={true}
        isCanvasLayer={true}
      />

      {/* Typed connection overlays */}
      {(viewport?.typedConnections || []).map((conn, idx) => {
        const fromItem = items.find(i => i.id === conn.fromItemId)
        const toItem = items.find(i => i.id === conn.toItemId)
        if (!fromItem || !toItem || !('pos' in fromItem) || !('pos' in toItem)) return null
        const fx = (fromItem.pos.x + (fromItem.size?.w ?? 250) / 2) * canvas.zoom + canvas.panX
        const fy = (fromItem.pos.y + (fromItem.size?.h ?? 150) / 2) * canvas.zoom + canvas.panY
        const tx = (toItem.pos.x + (toItem.size?.w ?? 250) / 2) * canvas.zoom + canvas.panX
        const ty = (toItem.pos.y + (toItem.size?.h ?? 150) / 2) * canvas.zoom + canvas.panY
        const connColors: Record<string, string> = {
          citation: '#6aa8d8', dependency: '#e88098', contradiction: '#e89060',
          related: '#78c8a0', mcp: '#a888d8', api: '#d87898', custom: '#8888aa',
        }
        const color = connColors[conn.connectionType] || '#8888aa'
        return (
          <svg key={`typed-${idx}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
            <defs>
              <marker id={`arrow-${idx}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <path d={`M0,0 L8,3 L0,6`} fill={color} />
              </marker>
            </defs>
            <line
              x1={fx} y1={fy} x2={tx} y2={ty}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={conn.connectionType === 'contradiction' ? '6,4' : 'none'}
              markerEnd={`url(#arrow-${idx})`}
            />
            {conn.label && (
              <text
                x={(fx + tx) / 2}
                y={(fy + ty) / 2 - 8}
                textAnchor="middle"
                fill={color}
                fontSize={10}
                fontFamily="Inter, sans-serif"
              >
                {conn.label}
              </text>
            )}
          </svg>
        )
      })}

      {/* File Editor (Monaco) */}
      {editingFile && (
        <FileEditor
          filePath={editingFile.filePath}
          fileName={editingFile.fileName}
          content={editingFile.content}
          language={editingFile.language}
          onSave={(content) => {
            useStore.getState().updateItem(editingFile.id, { content, isDirty: false, lastModified: new Date().toISOString() })
            setEditingFile(null)
          }}
          onClose={() => setEditingFile(null)}
        />
      )}

      {/* Inline text editing overlay */}
      {editingItem && (() => {
        const item = items.find(i => i.id === editingItem.id)
        if (!item || !('pos' in item)) return null
        const x = item.pos.x * canvas.zoom + canvas.panX + PAD * canvas.zoom
        const y = item.pos.y * canvas.zoom + canvas.panY + (item.kind === 'note' ? 10 : 24) * canvas.zoom
        const w = ((item.size?.w ?? 250) - PAD * 2) * canvas.zoom
        const h = ((item.size?.h ?? 150) - PAD * 2 - 10) * canvas.zoom
        const fontSize = (item.kind === 'note' ? 12 : 10) * canvas.zoom

        const handleSave = () => {
          useStore.getState().updateItem(editingItem.id, { [editingItem.field]: editingItem.value })
          setEditingItem(null)
        }

        return (
          <textarea
            autoFocus
            value={editingItem.value}
            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setEditingItem(null); e.stopPropagation() }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
            }}
            style={{
              position: 'absolute', left: x, top: y, width: w, height: Math.max(h, 60),
              fontSize, fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
              background: isDark() ? 'rgba(21,15,36,0.95)' : 'rgba(255,255,255,0.95)',
              color: isDark() ? '#e8e0f5' : '#1a1028',
              border: `2px solid ${isDark() ? '#8b7dc8' : '#6a5aae'}`,
              borderRadius: 8, padding: 8, outline: 'none', resize: 'none',
              zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
            }}
          />
        )
      })()}

      {/* Layers panel toggle */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        className="text-xs px-2 py-1 rounded-md shadow-sm"
        style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'var(--bg-surface-1)', border: '1px solid var(--border-color)' }}
        title="Toggle layers"
      >
        Layers
      </button>

      {/* Layers panel */}
      {showLayers && (
        <LayersPanel items={items} onClose={() => setShowLayers(false)} />
      )}

      {/* Quick Input Box */}
      {quickInputOpen && (
        <QuickInputBox
          value={quickInputValue}
          onChange={setQuickInputValue}
          onSubmit={handleQuickInputSubmit}
          onClose={() => { setQuickInputOpen(false); setQuickInputValue('') }}
          position={quickInputPos}
          inputRef={quickInputRef}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="glass-card"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 100, padding: 4, minWidth: 200 }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {/* Add item section */}
          <div className="px-2 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider">Add</div>
          <div className="grid grid-cols-2 gap-1 px-1">
            {ITEM_TYPES.map(({ kind, icon, label }) => (
              <CtxItem
                key={kind}
                label={`${icon}  ${label}`}
                onClick={() => {
                  const state = useStore.getState()
                  state.addItem(createDefaultItem(kind, { x: contextMenu.wx, y: contextMenu.wy }))
                  setContextMenu(null)
                }}
                small
              />
            ))}
          </div>
          
          <details className="px-1">
            <summary className="px-2 py-1 text-2xs text-text-muted cursor-pointer hover:bg-surface-2 rounded">
              More types →
            </summary>
            <div className="grid grid-cols-2 gap-1 px-1">
              {ADVANCED_ITEM_TYPES.map(({ kind, icon, label }) => (
                <CtxItem
                  key={kind}
                  label={`${icon}  ${label}`}
                  onClick={() => {
                    const state = useStore.getState()
                    state.addItem(createDefaultItem(kind, { x: contextMenu.wx, y: contextMenu.wy }))
                    setContextMenu(null)
                  }}
                  small
                />
              ))}
            </div>
          </details>

          <div className="status-divider" style={{ margin: '4px 0' }} />

          {/* Canvas actions (always available) */}
          <CtxItem label="📋  Paste" shortcut="⌘V" onClick={() => handleContextAction('paste')} />
          <CtxItem label="🔍  Select All" shortcut="⌘A" onClick={() => handleContextAction('select-all')} />

          <div className="status-divider" style={{ margin: '4px 0' }} />

          {/* Arrange submenu */}
          <details className="px-1">
            <summary className="px-2 py-1.5 text-xs text-text-primary cursor-pointer hover:bg-surface-2 rounded flex items-center">
              <span className="mr-2">📐</span> Arrange
            </summary>
            <div className="pl-2">
              <CtxItem label="  Grid" onClick={() => { handleContextAction('arrange-grid'); setContextMenu(null) }} small />
              <CtxItem label="  Stack Horizontal" onClick={() => { handleContextAction('arrange-stack-h'); setContextMenu(null) }} small />
              <CtxItem label="  Stack Vertical" onClick={() => { handleContextAction('arrange-stack-v'); setContextMenu(null) }} small />
              <CtxItem label="  Spiral" onClick={() => { handleContextAction('arrange-spiral'); setContextMenu(null) }} small />
            </div>
          </details>

          {/* Create Region */}
          <CtxItem label="🟦  Create Region" onClick={() => { handleContextAction('create-region'); setContextMenu(null) }} />

          <div className="status-divider" style={{ margin: '4px 0' }} />

          {/* Presentation */}
          <CtxItem label="▶  Present" onClick={() => { handleContextAction('present'); setContextMenu(null) }} />
          <CtxItem label="🎓  Create Lesson" onClick={() => { handleContextAction('create-lesson'); setContextMenu(null) }} />
          <CtxItem label="🤖  Export for AI" onClick={() => { handleContextAction('ai-export'); setContextMenu(null) }} />
          <CtxItem label="⚡  Generate Image" onClick={() => { handleContextAction('ai-generate'); setContextMenu(null) }} />

          {contextMenu.itemId && (
            <>
              <div className="status-divider" style={{ margin: '4px 0' }} />
              <div className="px-2 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider">Item Actions</div>
              
              {/* Edit & Copy */}
              <CtxItem label="✏️  Edit" onClick={() => handleContextAction('edit')} />
              <CtxItem label="📋  Copy" shortcut="⌘C" onClick={() => handleContextAction('copy')} />
              <CtxItem label="📑  Duplicate" shortcut="⌘D" onClick={() => handleContextAction('duplicate')} />
              
              <div className="status-divider" style={{ margin: '4px 0' }} />
              
              {/* Layer order */}
              <div className="px-2 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider">Layer</div>
              <CtxItem label="⬆️  Bring to Front" shortcut="]" onClick={() => handleContextAction('bring-front')} />
              <CtxItem label="↗️  Bring Forward" shortcut="⇧]" onClick={() => handleContextAction('bring-forward')} />
              <CtxItem label="↘️  Send Backward" shortcut="⇧[" onClick={() => handleContextAction('send-backward')} />
              <CtxItem label="⬇️  Send to Back" shortcut="[" onClick={() => handleContextAction('send-back')} />
              
              <div className="status-divider" style={{ margin: '4px 0' }} />
              
              {/* Organization */}
              <CtxItem label="📦  Group Selected" shortcut="⌘G" onClick={() => handleContextAction('group')} />
              <CtxItem label="📌  Lock Position" onClick={() => handleContextAction('lock')} />
              
              <div className="status-divider" style={{ margin: '4px 0' }} />
              
              {/* Annotations & Connections */}
              <CtxItem label="🖍️  Add Annotation" onClick={() => handleContextAction('annotate')} />
              <CtxItem label="🔗  Connect to..." onClick={() => handleContextAction('connect')} />

              {/* Canvas Conversation - only for notes/text */}
              {contextMenu.itemId && (() => {
                const item = items.find(i => i.id === contextMenu.itemId)
                if (item && (item.kind === 'note' || item.kind === 'text')) {
                  const itemId = item.id
                  return (
                    <>
                      <div className="status-divider" style={{ margin: '4px 0' }} />
                      <CtxItem
                        label={isGeneratingResponse.has(itemId) ? "⏳  Generating..." : "💬  Ask AI"}
                        onClick={() => {
                          if (!isGeneratingResponse.has(itemId)) {
                            requestCanvasResponse(item)
                            setContextMenu(null)
                          }
                        }}
                      />
                    </>
                  )
                }
                return null
              })()}

              <div className="status-divider" style={{ margin: '4px 0' }} />
              
              {/* File operations */}
              {contextMenu.itemId && (() => {
                const item = items.find(i => i.id === contextMenu.itemId)
                if (item && item.kind === 'file') {
                  return (
                    <>
                      <CtxItem label="✏️  Rename File" onClick={() => handleContextAction('rename-file')} />
                      <CtxItem label="🗑️  Delete File" onClick={() => handleContextAction('delete-file')} danger />
                      <div className="status-divider" style={{ margin: '4px 0' }} />
                    </>
                  )
                }
                return null
              })()}
              
              {/* Export */}
              <CtxItem label="📤  Export as PNG" onClick={() => handleContextAction('export-png')} />
              <CtxItem label="📋  Copy as JSON" onClick={() => handleContextAction('copy-json')} />
              
              <div className="status-divider" style={{ margin: '4px 0' }} />
              
              {/* Danger zone */}
              <CtxItem label="🗑️  Delete" shortcut="⌫" onClick={() => handleContextAction('delete')} danger />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Context Menu Item ──────────────────────────────────────────────

function CtxItem({ label, shortcut, onClick, danger, small }: { label: string; shortcut?: string; onClick: () => void; danger?: boolean; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex justify-between items-center px-2 ${small ? 'py-1' : 'py-1.5'} rounded text-xs text-left transition-fast ${
        danger ? 'text-danger hover:bg-danger-light' : 'text-text-primary hover:bg-surface-2'
      }`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-2xs text-text-muted ml-2">{shortcut}</span>}
    </button>
  )
}

// ─── Quick Input Box ────────────────────────────────────────────────

function QuickInputBox({
  value,
  onChange,
  onSubmit,
  onClose,
  position,
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onClose: () => void
  position: { x: number; y: number }
  inputRef: React.RefObject<any>
}) {
  return (
    <div
      className="fixed z-[200] animate-fadeIn"
      style={{
        left: '50%',
        top: '20%',
        transform: 'translateX(-50%)',
      }}
    >
      <div className="glass-card rounded-xl shadow-2xl border border-white/10 overflow-hidden" style={{ width: 500 }}>
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-2 text-text-muted mr-3">
            <span className="text-sm">💬</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit()
              }
              if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="Type a note, URL, question, or idea... (Enter to create & get AI response)"
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            autoFocus
          />
          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={onSubmit}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              Create
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted transition-colors"
            >
              <XIcon size={14} />
            </button>
          </div>
        </div>
        <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-4 text-2xs text-text-muted">
            <span>💡 Type anything — becomes a note</span>
            <span>🔗 Paste a URL — becomes a link</span>
            <span>🎨 Type hex colors — becomes a palette</span>
            <span>❓ Start with ? — asks AI</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Minimap ────────────────────────────────────────────────────────

function Minimap({ items, canvas, canvasRef }: { items: BoardItem[]; canvas: any; canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const W = 140; const H = 100
  const nonConn = items.filter(i => i.kind !== 'connector' && 'pos' in i)
  if (nonConn.length === 0) return null

  const minX = Math.min(...nonConn.map((i: any) => i.pos.x))
  const minY = Math.min(...nonConn.map((i: any) => i.pos.y))
  const maxX = Math.max(...nonConn.map((i: any) => i.pos.x + (i.size?.w ?? 250)))
  const maxY = Math.max(...nonConn.map((i: any) => i.pos.y + (i.size?.h ?? 150)))
  const pad = 50
  const worldW = maxX - minX + pad * 2
  const worldH = maxY - minY + pad * 2
  const scale = Math.min(W / worldW, H / worldH)

  const rect = canvasRef.current?.getBoundingClientRect()
  const vpW = (rect?.width ?? 800) / canvas.zoom
  const vpH = (rect?.height ?? 600) / canvas.zoom
  const vpX = -canvas.panX / canvas.zoom
  const vpY = -canvas.panY / canvas.zoom

  return (
    <div className="glass-card" style={{ position: 'absolute', bottom: 48, right: 12, width: W, height: H, overflow: 'hidden', zIndex: 10 }}>
      <svg width={W} height={H}>
        {nonConn.map((item: any) => {
          const x = (item.pos.x - minX + pad) * scale
          const y = (item.pos.y - minY + pad) * scale
          const w = Math.max(2, (item.size?.w ?? 250) * scale)
          const h = Math.max(2, (item.size?.h ?? 150) * scale)
          return <rect key={item.id} x={x} y={y} width={w} height={h} fill={accent()} opacity={0.3} rx={1} />
        })}
        <rect
          x={(vpX - minX + pad) * scale}
          y={(vpY - minY + pad) * scale}
          width={vpW * scale}
          height={vpH * scale}
          fill="none"
          stroke={accent()}
          strokeWidth={1.5}
          opacity={0.6}
        />
      </svg>
    </div>
  )
}

// ─── Layers Panel ───────────────────────────────────────────────────

function LayersPanel({ items, onClose }: { items: BoardItem[]; onClose: () => void }) {
  const nonConn = items.filter(i => i.kind !== 'connector')
  const selectedIds = useStore((s) => s.selectedIds)
  const selectItem = useStore((s) => s.selectItem)
  const toggleSelect = useStore((s) => s.toggleSelect)

  const kindIcons: Record<string, string> = {
    note: '📝', text: '📄', image: '🖼️', link: '🔗', video: '🎬',
    palette: '🎨', gradient: '🌈', font: '🔤', swatch: '🟧',
    sizeguide: '📐', container: '📦',
  }

  return (
    <div className="glass-card" style={{ position: 'absolute', top: 36, left: 12, width: 200, maxHeight: 300, overflow: 'hidden', zIndex: 10 }}>
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-surface-4">
        <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Layers</span>
        <button onClick={onClose} className="status-bar-btn text-xs">×</button>
      </div>
      <div className="overflow-y-auto p-1" style={{ maxHeight: 260 }}>
        {[...nonConn].reverse().map((item) => {
          const sel = selectedIds.has(item.id)
          const label = ('text' in item && item.text) ? item.text.slice(0, 20) :
                        ('description' in item && item.description) ? item.description.slice(0, 20) :
                        ('label' in item && item.label) ? item.label.slice(0, 20) :
                        ('url' in item && item.url) ? item.url.slice(0, 20) : item.kind
          return (
            <button
              key={item.id}
              onClick={(e) => e.shiftKey ? toggleSelect(item.id) : selectItem(item.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-fast ${
                sel ? 'bg-accent/10 text-accent' : 'hover:bg-surface-2 text-text-primary'
              }`}
            >
              <span className="w-5 text-center">{kindIcons[item.kind] || '•'}</span>
              <span className="flex-1 truncate">{label}</span>
              <span className="text-2xs text-text-muted">{item.kind}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Draw Functions ─────────────────────────────────────────────────
// These are intentionally NOT divided by zoom — the canvas transform
// handles scaling. Text and thin chrome use /zoom to stay readable
// at any zoom level (constant screen-pixel size).
const CARD_RADIUS = 10
const PAD = 14
const KIND_STRIP_HEIGHT = 1
const HEADER_FONT = '600 9px Inter, sans-serif'
const LABEL_FONT = '500 12px Inter, sans-serif'
const BODY_FONT = '400 10px Inter, sans-serif'
const SMALL_FONT = '400 8px Inter, sans-serif'
const TAG_FONT = '400 9px Inter, sans-serif'

// ─── Draw Functions ─────────────────────────────────────────────────

function drawPorts(ctx: CanvasRenderingContext2D, item: BoardItem, zoom: number) {
  if (!('ports' in item) || !item.ports) return
  for (const port of item.ports) {
    const pos = getPortPos(item.id, port.id, [item])
    if (!pos) continue
    const color = PORT_COLORS[port.type] || PORT_COLORS.any
    ctx.fillStyle = isDark() ? '#16161f' : '#ffffff'
    ctx.strokeStyle = color; ctx.lineWidth = 1.5 / zoom
    ctx.beginPath(); ctx.arc(pos.x, pos.y, PORT_RADIUS / zoom, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(pos.x, pos.y, (PORT_RADIUS - 2) / zoom, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = txtSecondary(); ctx.font = `${8}px Inter, sans-serif`
    ctx.textAlign = port.direction === 'input' ? 'left' : 'right'
    ctx.fillText(port.name, pos.x + (port.direction === 'input' ? 10 : -10) / zoom, pos.y + 3)
    ctx.textAlign = 'start'
  }
}

function drawPortConnection(ctx: CanvasRenderingContext2D, conn: PortConnection, items: BoardItem[], zoom: number) {
  const from = getPortPos(conn.fromItemId, conn.fromPortId, items)
  const to = getPortPos(conn.toItemId, conn.toPortId, items)
  if (!from || !to) return
  const fromItem = items.find(i => i.id === conn.fromItemId)
  const fromPort = fromItem && 'ports' in fromItem ? fromItem.ports?.find(p => p.id === conn.fromPortId) : null
  const color = fromPort ? (PORT_COLORS[fromPort.type] || PORT_COLORS.any) : '#6b7280'
  const cp = Math.abs(to.x - from.x) * 0.4
  ctx.strokeStyle = color; ctx.lineWidth = 2 / zoom
  ctx.beginPath(); ctx.moveTo(from.x, from.y)
  ctx.bezierCurveTo(from.x + cp, from.y, to.x - cp, to.y, to.x, to.y); ctx.stroke()
  const angle = Math.atan2(to.y - (to.y - cp * 0.3), to.x - (to.x - cp))
  const hl = 8 / zoom
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - hl * Math.cos(angle - Math.PI / 6), to.y - hl * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(to.x - hl * Math.cos(angle + Math.PI / 6), to.y - hl * Math.sin(angle + Math.PI / 6))
  ctx.closePath(); ctx.fill()
}

function drawLegacyConnector(ctx: CanvasRenderingContext2D, conn: any, items: BoardItem[], zoom: number) {
  const fromItem = items.find(i => i.id === conn.fromId)
  const toItem = items.find(i => i.id === conn.toId)
  if (!fromItem || !toItem || !('pos' in fromItem) || !('pos' in toItem)) return
  const from = { x: fromItem.pos.x + (fromItem.size?.w ?? 250) / 2, y: fromItem.pos.y + (fromItem.size?.h ?? 150) / 2 }
  const to = { x: toItem.pos.x + (toItem.size?.w ?? 250) / 2, y: toItem.pos.y + (toItem.size?.h ?? 150) / 2 }
  const color = CONNECTOR_COLORS[conn.owner as ConnectorOwner] || CONNECTOR_COLORS.objective
  ctx.strokeStyle = color; ctx.lineWidth = 2 / zoom
  ctx.setLineDash(conn.style === 'dashed' ? [6 / zoom, 4 / zoom] : [])
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
  ctx.setLineDash([])
}

function drawResizeHandles(ctx: CanvasRenderingContext2D, item: BoardItem, zoom: number) {
  if (!('pos' in item) || !('size' in item)) return
  const x = item.pos.x; const y = item.pos.y
  const w = item.size?.w ?? 250; const h = item.size?.h ?? 150
  const s = RESIZE_HANDLE_SIZE / zoom
  const handles = [
    { x: x + w - s / 2, y: y + h - s / 2 },
    { x: x + w - s / 2, y: y + h / 2 - s / 2 },
    { x: x + w / 2 - s / 2, y: y + h - s / 2 },
  ]
  for (const handle of handles) {
    ctx.fillStyle = isDark() ? '#150f24' : '#ffffff'
    ctx.strokeStyle = isDark() ? '#8b7dc8' : '#6a5aae'; ctx.lineWidth = 1.5 / zoom
    ctx.beginPath(); roundRect(ctx, handle.x, handle.y, s, s, 2 / zoom); ctx.fill(); ctx.stroke()
  }
}

function drawItem(ctx: CanvasRenderingContext2D, item: BoardItem, selected: boolean, zoom: number) {
  if (item.kind === 'connector' || !('pos' in item)) return
  const x = item.pos.x; const y = item.pos.y
  const w = item.size?.w ?? 250; const h = item.size?.h ?? 150
  const kindColor = KIND_COLORS[item.kind] || accent()

  // Card shadow and fill — world coordinates, scales with zoom
  ctx.shadowColor = shadow(selected); ctx.shadowBlur = (selected ? 16 : 6) / zoom; ctx.shadowOffsetY = 2 / zoom
  ctx.fillStyle = cardBg(selected)
  ctx.beginPath(); roundRect(ctx, x, y, w, h, CARD_RADIUS); ctx.fill()
  ctx.shadowColor = 'transparent'

  // Card border — thin chrome, constant screen size
  ctx.strokeStyle = selected ? kindColor : cardBorder(false); ctx.lineWidth = (selected ? 1.5 : 0.75) / zoom
  ctx.beginPath(); roundRect(ctx, x, y, w, h, CARD_RADIUS); ctx.stroke()

  // Kind accent strip at top — fixed height in world coords
  ctx.strokeStyle = kindColor; ctx.lineWidth = KIND_STRIP_HEIGHT / zoom
  ctx.beginPath(); ctx.moveTo(x + PAD, y + KIND_STRIP_HEIGHT); ctx.lineTo(x + w - PAD, y + KIND_STRIP_HEIGHT); ctx.stroke()

  ctx.save()
  ctx.beginPath(); roundRect(ctx, x, y, w, h, CARD_RADIUS); ctx.clip()

  switch (item.kind) {
    case 'image': drawImageItem(ctx, item, x, y, w, h, zoom); break
    case 'palette': drawPaletteItem(ctx, item, x, y, w, h, zoom); break
    case 'gradient': drawGradientItem(ctx, item, x, y, w, h, zoom); break
    case 'font': drawFontItem(ctx, item, x, y, w, h, zoom); break
    case 'swatch': drawSwatchItem(ctx, item, x, y, w, h, zoom); break
    case 'sizeguide': drawSizeGuideItem(ctx, item, x, y, w, h, zoom); break
    case 'container': drawContainerItem(ctx, item, x, y, w, h, zoom); break
    case 'link': drawLinkItem(ctx, item, x, y, w, h, zoom); break
    case 'web': drawWebItem(ctx, item as any, x, y, w, h, zoom); break
    case 'region': drawRegionItem(ctx, item as any, x, y, w, h, zoom); break
    case 'file': drawFileItem(ctx, item as any, x, y, w, h, zoom); break
    default: drawTextBasedItem(ctx, item, x, y, w, h, zoom); break
  }
  ctx.restore()
}

function drawImageItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  let cy = y + PAD
  ctx.fillStyle = accent(); ctx.font = `600 9px Inter, sans-serif`; ctx.fillText('IMAGE', x + PAD, cy + 9); cy += 20
  const imgTop = cy; const imgBot = y + h - PAD - 18; const imgH = Math.max(40, imgBot - imgTop); const imgW = w - PAD * 2
  const src = item.thumbnail || item.fullSource
  const img = getImage(src)
  if (img) {
    const ir = img.naturalWidth / img.naturalHeight; const ar = imgW / imgH
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
    if (ir > ar) { sw = img.naturalHeight * ar; sx = (img.naturalWidth - sw) / 2 }
    else { sh = img.naturalWidth / ar; sy = (img.naturalHeight - sh) / 2 }
    ctx.save(); roundRect(ctx, x + PAD, imgTop, imgW, imgH, 4); ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, x + PAD, imgTop, imgW, imgH); ctx.restore()
  } else if (isImageFailed(src)) {
    ctx.fillStyle = isDark() ? '#1a0018' : '#fff0f0'; ctx.fillRect(x + PAD, imgTop, imgW, imgH)
    ctx.fillStyle = isDark() ? '#ff6b6b' : '#d44'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Image failed to load', x + w / 2, imgTop + imgH / 2 + 4); ctx.textAlign = 'start'
  } else if (src?.startsWith('http')) {
    ctx.fillStyle = isDark() ? '#1a1a25' : '#f1f5f9'; ctx.fillRect(x + PAD, imgTop, imgW, imgH)
    ctx.fillStyle = txtMuted(); ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Loading image...', x + w / 2, imgTop + imgH / 2 + 4); ctx.textAlign = 'start'
  } else {
    ctx.fillStyle = isDark() ? '#1a1a25' : '#f1f5f9'; ctx.fillRect(x + PAD, imgTop, imgW, imgH)
    ctx.fillStyle = txtMuted(); ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('No image', x + w / 2, imgTop + imgH / 2 + 4); ctx.textAlign = 'start'
  }
  if (item.description) {
    ctx.fillStyle = txtPrimary(); ctx.font = '10px Inter, sans-serif'
    ctx.fillText(item.description.slice(0, 60), x + PAD, y + h - PAD + 2)
  }
}

function drawPaletteItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  let cy = y + PAD
  ctx.fillStyle = accent(); ctx.font = '600 9px Inter, sans-serif'; ctx.fillText('PALETTE', x + PAD, cy + 9); cy += 20
  ctx.fillStyle = txtPrimary(); ctx.font = '500 12px Inter, sans-serif'; ctx.fillText(item.label || '', x + PAD, cy + 2); cy += 18
  const colors = item.colors || []
  const sw = Math.min(60, (w - PAD * 2 - (colors.length - 1) * 4) / Math.max(colors.length, 1))
  const maxBot = y + h - PAD - 14
  const sh = Math.max(20, maxBot - cy - 14)
  for (let i = 0; i < colors.length; i++) {
    const sx = x + PAD + i * (sw + 4)
    ctx.fillStyle = colors[i].hex || '#000'; ctx.beginPath(); roundRect(ctx, sx, cy, sw, sh, 4); ctx.fill()
    if (cy + sh + 12 < maxBot) {
      ctx.fillStyle = txtSecondary(); ctx.font = '8px Inter, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(colors[i].hex || '', sx + sw / 2, cy + sh + 12); ctx.textAlign = 'start'
    }
  }
}

function drawGradientItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  let cy = y + PAD
  ctx.fillStyle = accent(); ctx.font = '600 9px Inter, sans-serif'; ctx.fillText('GRADIENT', x + PAD, cy + 9); cy += 20
  ctx.fillStyle = txtPrimary(); ctx.font = '500 12px Inter, sans-serif'; ctx.fillText(item.label || '', x + PAD, cy + 2); cy += 18
  const stops = item.stops || []
  if (stops.length >= 2) {
    const dir = (item.direction || 90) * Math.PI / 180
    const bx = x + PAD; const by = cy; const bw = w - PAD * 2; const bh = y + h - PAD - cy
    if (bh > 10) {
      const grad = ctx.createLinearGradient(bx + bw / 2 - Math.cos(dir) * bw / 2, by + bh / 2 - Math.sin(dir) * bh / 2, bx + bw / 2 + Math.cos(dir) * bw / 2, by + bh / 2 + Math.sin(dir) * bh / 2)
      for (const s of stops) grad.addColorStop(Math.max(0, Math.min(1, s.position)), s.color)
      ctx.fillStyle = grad; ctx.beginPath(); roundRect(ctx, bx, by, bw, bh, 6); ctx.fill()
    }
  }
}

function drawFontItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const ff = item.fontFamily || 'Inter'; loadFont(ff)
  let cy = y + PAD
  ctx.fillStyle = accent(); ctx.font = '600 9px Inter, sans-serif'; ctx.fillText('FONT', x + PAD, cy + 9); cy += 20
  ctx.fillStyle = txtPrimary(); ctx.font = '500 11px Inter, sans-serif'; ctx.fillText(ff, x + PAD, cy + 2); cy += 20
  const sample = item.sampleText || 'The quick brown fox'
  const sizes = [24, 16, 12]
  const maxBot = y + h - PAD
  for (const size of sizes) {
    if (cy + size > maxBot) break
    ctx.fillStyle = txtPrimary(); ctx.font = `400 ${size}px "${ff}", sans-serif`
    ctx.fillText(sample.slice(0, 40), x + PAD, cy + size)
    cy += size + 8
  }
}

function drawSwatchItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const maxBot = y + h - PAD
  const colorH = Math.max(40, (maxBot - y - PAD) * 0.5)
  let cy = y + PAD
  ctx.fillStyle = item.hex || '#000'; ctx.beginPath(); roundRect(ctx, x + PAD, cy, w - PAD * 2, colorH, 6); ctx.fill()
  cy += colorH + 12
  if (cy + 14 < maxBot) {
    ctx.fillStyle = txtPrimary(); ctx.font = '600 13px Inter, sans-serif'
    ctx.fillText(item.name || item.hex, x + PAD, cy); cy += 16
  }
  if (cy + 14 < maxBot) {
    ctx.fillStyle = txtSecondary(); ctx.font = '11px Inter, sans-serif'
    ctx.fillText(item.hex, x + PAD, cy); cy += 16
  }
  if (item.usage && cy < maxBot) {
    ctx.fillStyle = txtMuted(); ctx.font = '10px Inter, sans-serif'
    wrapText(ctx, item.usage, x + PAD, cy, w - PAD * 2, 14, maxBot - cy)
  }
}

function drawSizeGuideItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  let cy = y + PAD
  ctx.fillStyle = accent(); ctx.font = '600 9px Inter, sans-serif'; ctx.fillText('SIZE', x + PAD, cy + 9); cy += 20
  ctx.fillStyle = txtPrimary(); ctx.font = '500 12px Inter, sans-serif'; ctx.fillText(item.label || '', x + PAD, cy + 2); cy += 20
  const maxBot = y + h - PAD
  const mw = w - PAD * 2; const mh = Math.max(20, maxBot - cy - 26); const aspect = (item.width || 1) / (item.height || 1)
  let bw = mw * 0.8; let bh = bw / aspect; if (bh > mh) { bh = mh; bw = bh * aspect }
  const cx = x + PAD + (mw - bw) / 2
  ctx.strokeStyle = '#8b7dc8'; ctx.lineWidth = 1.5 / zoom; ctx.setLineDash([4 / zoom, 3 / zoom]); ctx.strokeRect(cx, cy, bw, bh); ctx.setLineDash([])
  ctx.fillStyle = accent(); ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
  ctx.fillText(`${item.width}${item.unit}`, cx + bw / 2, cy + bh + 14)
  ctx.save(); ctx.translate(cx - 8, cy + bh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${item.height}${item.unit}`, 0, 0); ctx.restore()
  if (cy + bh + 26 < maxBot) {
    ctx.fillStyle = txtMuted(); ctx.font = '9px Inter, sans-serif'
    ctx.fillText(item.orientation, cx + bw / 2, cy + bh + 26); ctx.textAlign = 'start'
  }
}

function drawContainerItem(ctx: CanvasRenderingContext2D, item: ContainerItem, x: number, y: number, w: number, h: number, zoom: number) {
  let cy = y + PAD
  ctx.fillStyle = '#4a9e6e'; ctx.font = '600 9px Inter, sans-serif'; ctx.fillText('CONTAINER', x + PAD, cy + 9); cy += 20
  ctx.fillStyle = txtPrimary(); ctx.font = '500 12px Inter, sans-serif'; ctx.fillText(item.label || '', x + PAD, cy + 2); cy += 18
  const childCount = item.children?.length || 0
  ctx.fillStyle = txtMuted(); ctx.font = '10px Inter, sans-serif'
  ctx.fillText(`${childCount} items · ${item.layout}${item.collapsed ? ' · collapsed' : ''}`, x + PAD, cy); cy += 16
  const iconX = x + w - PAD - 16; const iconY = y + PAD + 4
  ctx.strokeStyle = txtMuted(); ctx.lineWidth = 1.5 / zoom
  ctx.beginPath()
  if (item.collapsed) {
    ctx.moveTo(iconX, iconY + 6); ctx.lineTo(iconX + 6, iconY); ctx.lineTo(iconX + 12, iconY + 6)
  } else {
    ctx.moveTo(iconX, iconY + 6); ctx.lineTo(iconX + 12, iconY + 6)
    ctx.moveTo(iconX + 6, iconY); ctx.lineTo(iconX + 6, iconY + 12)
  }
  ctx.stroke()
  const maxBot = y + h - PAD
  if (!item.collapsed && item.children?.length && cy < maxBot) {
    const previewH = maxBot - cy
    const cols = Math.max(1, Math.min(4, Math.floor((w - PAD * 2) / 64)))
    const cellW = (w - PAD * 2 - (cols - 1) * 4) / cols
    const cellH = Math.min(40, previewH / Math.ceil(item.children.length / cols))
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      const col = i % cols; const row = Math.floor(i / cols)
      const ccx = x + PAD + col * (cellW + 4); const ccy = cy + row * (cellH + 4)
      if (ccy + cellH > maxBot) break
      const ccolor = KIND_COLORS[child.kind] || accent()
      ctx.fillStyle = ccolor + '22'; ctx.strokeStyle = ccolor; ctx.lineWidth = 0.5 / zoom
      ctx.beginPath(); roundRect(ctx, ccx, ccy, cellW, cellH, 3); ctx.fill(); ctx.stroke()
      ctx.fillStyle = ccolor; ctx.font = '600 6px Inter, sans-serif'
      ctx.fillText(child.kind.toUpperCase(), ccx + 4, ccy + 10)
      let preview = ''
      if ('text' in (child as any)) preview = (child as any).text?.slice(0, 20) || ''
      else if ('description' in (child as any)) preview = (child as any).description?.slice(0, 20) || ''
      else if ('url' in (child as any)) preview = (child as any).url?.slice(0, 20) || ''
      ctx.fillStyle = txtSecondary(); ctx.font = '8px Inter, sans-serif'
      ctx.fillText(preview, ccx + 4, ccy + 22)
    }
  } else if (childCount === 0 && cy < maxBot) {
    ctx.fillStyle = txtMuted(); ctx.font = '9px Inter, sans-serif'
    ctx.fillText('Empty — drag items here or add via chat', x + PAD, cy)
  }
}

function drawLinkItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const url = item.url || ''
  let domain = ''
  try { domain = new URL(url).hostname.replace('www.', '') } catch {}
  const title = item.title || domain || 'Link'
  const summary = item.summary || item.description || ''
  const maxBot = y + h - PAD
  let cy = y + PAD
  ctx.fillStyle = accent(); ctx.font = '600 9px Inter, sans-serif'; ctx.fillText('LINK', x + PAD, cy + 9); cy += 20
  ctx.fillStyle = txtPrimary(); ctx.font = '600 13px Inter, sans-serif'
  ctx.fillText(title.slice(0, 40), x + PAD, cy + 2); cy += 18
  if (domain && cy < maxBot) {
    ctx.fillStyle = txtMuted(); ctx.font = '8px Inter, sans-serif'
    ctx.fillText(domain, x + PAD, cy); cy += 14
  }
  if (summary && cy < maxBot) {
    ctx.fillStyle = txtSecondary(); ctx.font = '10px Inter, sans-serif'
    wrapText(ctx, summary.slice(0, 120), x + PAD, cy, w - PAD * 2, 14, maxBot - cy)
  }
  if (url) {
    ctx.fillStyle = isDark() ? 'rgba(139,125,200,0.06)' : 'rgba(0,0,0,0.03)'
    ctx.fillRect(x + PAD, maxBot - 14, w - PAD * 2, 14)
    ctx.fillStyle = txtMuted(); ctx.font = '8px Inter, sans-serif'
    ctx.fillText(url.slice(0, 50) + (url.length > 50 ? '…' : ''), x + PAD + 4, maxBot - 3)
  }
}

function drawWebItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const url = item.url || ''
  let domain = ''
  try { domain = new URL(url).hostname.replace('www.', '') } catch {}
  const title = item.title || domain || 'Web'
  const cardType = item.cardType || 'web'
  const maxBot = y + h - PAD
  let cy = y + PAD

  // Card type label
  const typeLabels: Record<string, string> = {
    blank: 'NEW CARD', web: 'WEB', note: 'NOTE', search: 'SEARCH', file: 'FILE', ai: 'AI', image: 'IMAGE', link: 'LINK',
  }
  ctx.fillStyle = accent(); ctx.font = '600 9px Inter, sans-serif'
  ctx.fillText(typeLabels[cardType] || 'WEB', x + PAD, cy + 9); cy += 20

  if (cardType === 'blank') {
    // Blank card - show placeholder
    ctx.fillStyle = txtMuted(); ctx.font = '400 11px Inter, sans-serif'
    ctx.fillText('Type a URL, search, or note...', x + PAD, cy + 2)
    return
  }

  if (cardType === 'note' || cardType === 'ai') {
    // Note/AI card - show content
    const content = item.content || ''
    if (title && title !== 'Note' && title !== 'AI Response') {
      ctx.fillStyle = txtPrimary(); ctx.font = '600 12px Inter, sans-serif'
      ctx.fillText(title.slice(0, 40), x + PAD, cy + 2); cy += 18
    }
    if (content && cy < maxBot) {
      ctx.fillStyle = txtSecondary(); ctx.font = '10px Inter, sans-serif'
      wrapText(ctx, content.slice(0, 200), x + PAD, cy, w - PAD * 2, 14, maxBot - cy)
    }
    return
  }

  // Web/Search/Image cards - show URL and favicon area
  ctx.fillStyle = txtPrimary(); ctx.font = '600 12px Inter, sans-serif'
  ctx.fillText(title.slice(0, 40), x + PAD, cy + 2); cy += 18

  if (domain && cy < maxBot) {
    ctx.fillStyle = txtMuted(); ctx.font = '8px Inter, sans-serif'
    ctx.fillText(domain, x + PAD, cy); cy += 14
  }

  if (url && cy < maxBot) {
    ctx.fillStyle = isDark() ? 'rgba(139,125,200,0.06)' : 'rgba(0,0,0,0.03)'
    ctx.fillRect(x + PAD, maxBot - 14, w - PAD * 2, 14)
    ctx.fillStyle = txtMuted(); ctx.font = '8px Inter, sans-serif'
    ctx.fillText(url.slice(0, 50) + (url.length > 50 ? '…' : ''), x + PAD + 4, maxBot - 3)
  }

  // Loading indicator
  if (item.isLoading) {
    ctx.fillStyle = isDark() ? 'rgba(139,125,200,0.1)' : 'rgba(106,90,174,0.1)'
    ctx.fillRect(x + PAD, cy, w - PAD * 2, maxBot - cy - 18)
    ctx.fillStyle = txtMuted(); ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Loading...', x + w / 2, cy + (maxBot - cy - 18) / 2 + 4)
    ctx.textAlign = 'start'
  }
}

function drawTextBasedItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const label = item.kind.charAt(0).toUpperCase() + item.kind.slice(1).toLowerCase()
  const text = item.text || item.raw || item.content || ''
  const purpose = item.purpose || ''
  const tags = ('tags' in item && item.tags?.length) ? asArray(item.tags) : []
  const cx = x + PAD
  const contentW = w - PAD * 2

  // Check if this is an AI response or part of a conversation
  const isAiResponse = tags.includes('ai-response') || tags.includes('canvas-conversation')
  const isGenerating = false // Could be connected to state if needed

  // Fixed zones from bottom: tags (14px) → purpose (14px) → text fills the rest
  const tagsZone = tags.length > 0 ? y + h - PAD + 2 : y + h
  const purposeZone = purpose ? tagsZone - 18 : tagsZone
  const textMaxH = Math.max(14, purposeZone - (y + PAD + 20) - 4)

  // AI response indicator
  const labelColor = isAiResponse ? '#4CAF50' : accent()
  ctx.fillStyle = labelColor; ctx.font = '600 9px Inter, sans-serif'
  ctx.fillText(label, cx, y + PAD + 9)

  // AI icon for response items
  if (isAiResponse) {
    const iconX = x + w - PAD - 16
    const iconY = y + PAD
    ctx.fillStyle = '#4CAF50'
    ctx.font = '10px Inter, sans-serif'
    ctx.fillText('AI', iconX, iconY + 9)
  }

  if (text.length > 0 && textMaxH > 10) {
    ctx.fillStyle = txtPrimary(); ctx.font = '400 10px Inter, sans-serif'
    wrapText(ctx, text, cx, y + PAD + 20, contentW, 14, textMaxH)
  }

  if (purpose && purposeZone < tagsZone) {
    ctx.fillStyle = txtMuted(); ctx.font = '500 8px Inter, sans-serif'
    ctx.fillText(purpose.slice(0, 60), cx, purposeZone)
  }

  if (tags.length > 0) {
    ctx.fillStyle = txtMuted(); ctx.font = '400 8px Inter, sans-serif'
    ctx.fillText(tags.slice(0, 3).join(', '), cx, tagsZone)
  }
}

function drawRegionItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const borderColor = item.color || '#8b7dc8'
  const fillColor = item.fillColor || (isDark() ? 'rgba(139,125,200,0.05)' : 'rgba(106,90,174,0.05)')

  // Full card is the region - subtle fill
  ctx.fillStyle = fillColor
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, 8)
  ctx.fill()

  // Border
  ctx.strokeStyle = borderColor
  ctx.lineWidth = (item.borderWidth || 1.5) / zoom
  ctx.globalAlpha = 0.4
  if (item.borderStyle === 'dashed') {
    ctx.setLineDash([8 / zoom, 6 / zoom])
  } else if (item.borderStyle === 'dotted') {
    ctx.setLineDash([3 / zoom, 4 / zoom])
  } else {
    ctx.setLineDash([])
  }
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, 8)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // Small label in top-left corner
  if (item.label) {
    const labelText = item.label.slice(0, 20)
    ctx.font = '600 10px Inter, sans-serif'
    const textW = ctx.measureText(labelText).width + 12
    const labelH = 20
    const lx = x + 8
    const ly = y + 8

    // Label background pill
    ctx.fillStyle = borderColor
    ctx.globalAlpha = 0.15
    ctx.beginPath()
    roundRect(ctx, lx, ly, textW, labelH, 4)
    ctx.fill()
    ctx.globalAlpha = 1

    // Label text
    ctx.fillStyle = borderColor
    ctx.fillText(labelText, lx + 6, ly + 14)
  }
}

function drawFileItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const maxBot = y + h - PAD
  let cy = y + PAD

  // Language badge with color
  const langColors: Record<string, string> = {
    typescript: '#3178c6', javascript: '#f7df1e', python: '#3776ab',
    rust: '#ce422b', go: '#00add8', java: '#ed8b00', html: '#e34c26',
    css: '#1572b6', json: '#292929', markdown: '#083fa1',
  }
  const langColor = langColors[item.language] || '#8b7dc8'

  // File icon and language badge
  ctx.fillStyle = langColor
  ctx.font = '600 9px Inter, sans-serif'
  ctx.fillText('FILE', x + PAD, cy + 9)

  // Language badge
  const langText = item.language?.toUpperCase() || 'TEXT'
  ctx.font = '600 8px Inter, sans-serif'
  const langW = ctx.measureText(langText).width + 8
  ctx.fillStyle = langColor + '33'
  ctx.beginPath()
  roundRect(ctx, x + w - PAD - langW - 4, cy, langW + 4, 16, 3)
  ctx.fill()
  ctx.fillStyle = langColor
  ctx.fillText(langText, x + w - PAD - langW, cy + 11)
  cy += 20

  // File name
  ctx.fillStyle = txtPrimary()
  ctx.font = '600 12px Inter, sans-serif'
  ctx.fillText(item.fileName?.slice(0, 30) || 'Untitled', x + PAD, cy + 2)
  cy += 18

  // File path (truncated)
  if (item.filePath) {
    ctx.fillStyle = txtMuted()
    ctx.font = '8px Inter, sans-serif'
    const pathText = item.filePath.length > 40 ? '...' + item.filePath.slice(-37) : item.filePath
    ctx.fillText(pathText, x + PAD, cy)
    cy += 14
  }

  // File size and modified date
  ctx.fillStyle = txtMuted()
  ctx.font = '8px Inter, sans-serif'
  const sizeText = item.fileSize ? formatFileSize(item.fileSize) : ''
  const modifiedText = item.lastModified ? new Date(item.lastModified).toLocaleDateString() : ''
  ctx.fillText(`${sizeText} · ${modifiedText}`, x + PAD, cy)
  cy += 14

  // Content preview with syntax highlighting simulation
  if (item.content && cy < maxBot - 20) {
    const previewH = maxBot - cy - 10
    const previewW = w - PAD * 2

    // Code background
    ctx.fillStyle = isDark() ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'
    ctx.beginPath()
    roundRect(ctx, x + PAD, cy, previewW, previewH, 4)
    ctx.fill()

    // Line numbers
    const lines = item.content.split('\n')
    const lineHeight = 14
    const maxLines = Math.floor(previewH / lineHeight)
    const lineNumW = 24

    ctx.fillStyle = txtMuted()
    ctx.font = '9px monospace'

    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      const ly = cy + 12 + i * lineHeight
      if (ly + lineHeight > maxBot - 10) break

      // Line number
      ctx.fillStyle = txtMuted()
      ctx.textAlign = 'right'
      ctx.fillText(String(i + 1), x + PAD + lineNumW - 4, ly)
      ctx.textAlign = 'start'

      // Code line (truncated)
      ctx.fillStyle = txtPrimary()
      const lineText = lines[i].slice(0, 50)
      ctx.fillText(lineText, x + PAD + lineNumW + 4, ly)
    }

    // Dirty indicator
    if (item.isDirty) {
      ctx.fillStyle = '#f59e0b'
      ctx.font = '600 10px Inter, sans-serif'
      ctx.fillText('●', x + w - PAD - 12, y + PAD + 9)
    }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, mw: number, lh: number, mh: number) {
  const words = text.split(' '); let line = ''; let cy = y
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word
    if (ctx.measureText(test).width > mw && line) { if (cy + lh > y + mh) { ctx.fillText(line + '...', x, cy); return } ctx.fillText(line, x, cy); line = word; cy += lh } else { line = test }
  }
  if (cy + lh <= y + mh) ctx.fillText(line, x, cy)
}
