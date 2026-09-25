import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { hitTestItem } from '@/lib/layout'
import { loadFont } from '@/lib/fonts'
import { showToast } from '@/lib/toasts'
import type { BoardItem, Position, PortConnection, ContainerItem, ConnectorOwner } from '@/types'

// ─── Item Creation Defaults ─────────────────────────────────────────
// Shared between the floating toolbar and the right-click context menu.

const ITEM_TYPES = [
  { kind: 'note', icon: '📝', label: 'Note', key: 'N' },
  { kind: 'text', icon: '📄', label: 'Text', key: 'T' },
  { kind: 'image', icon: '🖼️', label: 'Image', key: 'I' },
  { kind: 'link', icon: '🔗', label: 'Link', key: 'L' },
  { kind: 'palette', icon: '🎨', label: 'Palette', key: 'P' },
  { kind: 'gradient', icon: '🌈', label: 'Gradient', key: 'G' },
  { kind: 'font', icon: '🔤', label: 'Font', key: 'F' },
  { kind: 'swatch', icon: '🟧', label: 'Color', key: 'C' },
  { kind: 'sizeguide', icon: '📐', label: 'Size', key: null },
  { kind: 'container', icon: '📦', label: 'Group', key: null },
  { kind: 'video', icon: '🎬', label: 'Video', key: 'V' },
]

function createDefaultItem(kind: string, pos: Position): BoardItem {
  const cx = pos.x, cy = pos.y
  const defaults: Record<string, any> = {
    note: { kind: 'note', id: crypto.randomUUID(), text: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy } },
    text: { kind: 'text', id: crypto.randomUUID(), raw: '', pos: { x: cx, y: cy }, size: { w: 300, h: 200 } },
    image: { kind: 'image', id: crypto.randomUUID(), thumbnail: '', fullSource: '', description: '', source: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 300, h: 200 } },
    link: { kind: 'link', id: crypto.randomUUID(), url: '', title: '', summary: '', description: '', purpose: '', importance: '', source: '', tags: [], pos: { x: cx, y: cy } },
    palette: { kind: 'palette', id: crypto.randomUUID(), label: 'New Palette', colors: [{ hex: '#ff7eb3', label: '' }, { hex: '#7c6cbf', label: '' }, { hex: '#fff07a', label: '' }], purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 120 } },
    gradient: { kind: 'gradient', id: crypto.randomUUID(), label: 'New Gradient', stops: [{ position: 0, color: '#ff7eb3' }, { position: 1, color: '#7c6cbf' }], direction: 90, purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 300, h: 80 } },
    font: { kind: 'font', id: crypto.randomUUID(), fontFamily: 'Inter', weights: [400, 700], sampleText: 'The quick brown fox', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 160 } },
    swatch: { kind: 'swatch', id: crypto.randomUUID(), hex: '#7c6cbf', name: '', usage: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 160, h: 180 } },
    sizeguide: { kind: 'sizeguide', id: crypto.randomUUID(), width: 1920, height: 1080, unit: 'px', label: '', orientation: 'landscape', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 200, h: 160 } },
    container: { kind: 'container', id: crypto.randomUUID(), label: 'New Group', children: [], layout: 'free', gap: 8, collapsed: false, purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 400, h: 300 } },
    video: { kind: 'video', id: crypto.randomUUID(), source: '', sourceUrl: '', startTs: 0, duration: 0, subjectDesc: '', motionDesc: '', purpose: '', importance: '', tags: [], pos: { x: cx, y: cy }, size: { w: 320, h: 240 } },
  }
  return defaults[kind] || defaults.note
}

// ─── Theme ──────────────────────────────────────────────────────────

function isDark() { return document.body.classList.contains('dark') }
function gridColor() { return isDark() ? 'rgba(124,108,191,0.06)' : 'rgba(0,0,0,0.06)' }
function crosshairColor() { return isDark() ? 'rgba(124,108,191,0.2)' : 'rgba(100,80,160,0.25)' }
function cardBg(sel: boolean) { return isDark() ? (sel ? '#1a1030' : '#150f24') : (sel ? '#f0ecfa' : '#ffffff') }
function cardBorder(sel: boolean) { return isDark() ? (sel ? 'rgba(124,108,191,0.4)' : 'rgba(160,140,220,0.08)') : (sel ? 'rgba(100,80,160,0.4)' : 'rgba(0,0,0,0.06)') }
function txtPrimary() { return isDark() ? '#e8e0f5' : '#1a1028' }
function txtSecondary() { return isDark() ? '#a898c8' : '#6b5a8a' }
function txtMuted() { return isDark() ? '#7a6a9a' : '#9a8aba' }
function accent() { return isDark() ? '#7c6cbf' : '#6a5aae' }
function shadow(sel: boolean) { return isDark() ? (sel ? 'rgba(124,108,191,0.2)' : 'rgba(0,0,0,0.4)') : (sel ? 'rgba(100,80,160,0.15)' : 'rgba(0,0,0,0.08)') }

// ─── LRU Image Cache (max 200) ─────────────────────────────────────

const MAX_IMAGES = 200
const imageCache = new Map<string, HTMLImageElement>()
const imageFailed = new Set<string>()

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
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        imageCache.set(url, img)
        needsRedrawGlobal = true
        // Evict oldest if over limit
        while (imageCache.size > MAX_IMAGES) {
          const first = imageCache.keys().next().value
          if (first) imageCache.delete(first)
        }
      }
      img.onerror = () => {
        imageFailed.add(url)
        imageCache.delete(url)
        needsRedrawGlobal = true
      }
      img.src = url
      imageCache.set(url, img) // mark as loading
    } catch {
      imageFailed.add(url)
    }
  }
  // If currently loading (in cache but not complete), return null
  if (imageCache.has(url) && !imageFailed.has(url)) return null
  return null
}

function isImageFailed(url: string): boolean {
  return !!url && imageFailed.has(url)
}

// Global redraw flag so image loads can trigger a repaint
let needsRedrawGlobal = false

// ─── Constants ──────────────────────────────────────────────────────

const PORT_RADIUS = 5
const PORT_COLORS: Record<string, string> = { data: '#6aa8d8', visual: '#a888d8', reference: '#78c8a0', any: '#8888aa' }
const CONNECTOR_COLORS: Record<ConnectorOwner, string> = { user: '#6aa8d8', llm: '#ff7eb3', objective: '#c8b860' }
const KIND_COLORS: Record<string, string> = {
  text: '#7c6cbf', note: '#e8b840', image: '#ff7eb3', link: '#6aa8d8',
  video: '#a888d8', palette: '#78c8a0', gradient: '#e89060', font: '#d87898',
  swatch: '#78b8d8', sizeguide: '#999999', container: '#78c8a0', connector: '#666688',
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

  const project = useStore((s) => s.project)
  const activeViewportId = useStore((s) => s.activeViewportId)
  const canvas = useStore((s) => s.canvas)
  const viewport = project.viewports.find(v => v.id === activeViewportId) ?? project.viewports[0]
  const items = viewport?.items ?? []

  // Subscribe to store changes → trigger redraw
  useEffect(() => {
    const unsub = useStore.subscribe(() => { needsRedraw.current = true })
    return unsub
  }, [])

  // Draw loop — only redraws when needed
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    const draw = () => {
      // Check if images finished loading (global flag from getImage callbacks)
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

      // Items
      for (const item of its) {
        if (item.kind === 'connector' || !('pos' in item)) continue
        drawItem(ctx, item, sel.has(item.id), c.zoom)
      }

      // Resize handles
      for (const item of its) {
        if (item.kind === 'connector' || !('pos' in item)) continue
        if (sel.has(item.id)) drawResizeHandles(ctx, item, c.zoom)
      }

      // Ports
      for (const item of its) {
        if (item.kind === 'connector' || !('pos' in item)) continue
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
        ctx.fillStyle = txtSecondary()
        ctx.font = `500 ${16 / c.zoom}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('Drop files here or use the chat to add items', 0, 50 / c.zoom)
        ctx.font = `${12 / c.zoom}px Inter, sans-serif`
        ctx.fillStyle = txtMuted()
        ctx.fillText('Two-finger scroll to pan · Option+scroll to zoom', 0, 80 / c.zoom)
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
      state.updateItem(d.itemId, { pos: { x: d.ix, y: d.iy }, size: { w: nw, h: nh } })
    }
  }

  const onMouseUp = (e: React.MouseEvent) => {
    const d = dragRef.current
    const state = useStore.getState()
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

  const onWheel = (e: React.WheelEvent) => {
    const state = useStore.getState()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    needsRedraw.current = true
    if (e.altKey) {
      state.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY)
    } else {
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
        const url = URL.createObjectURL(file)
        state.addItem({ kind: 'image', id: crypto.randomUUID(), thumbnail: url, fullSource: url, description: file.name, purpose: 'Dropped by user', importance: 'User reference', source: `file:${file.name}`, tags: [], pos: { x: wx, y: wy }, size: { w: 300, h: 200 } })
      } else if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file)
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
      if (e.key === 'Delete' || e.key === 'Backspace') { for (const id of s.selectedIds) s.removeItem(id) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); s.toggleSearch() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); s.selectAll() }
      if (e.key === 'Escape') { s.endConnect(); s.clearSelection() }
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
                const url = URL.createObjectURL(blob)
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
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) { s.addItem(createDefaultItem('link', { x: cx, y: cy })); e.preventDefault() }
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

    // Double-click on empty canvas → create a new note
    if (!hit) {
      state.addItem({
        kind: 'note', id: crypto.randomUUID(), text: '',
        purpose: '', importance: '', tags: [],
        pos: { x: wx - 125, y: wy - 75 },
      })
      return
    }

    // Double-click on note/text → inline edit
    if (hit.kind === 'note' || hit.kind === 'text') {
      const field = hit.kind === 'note' ? 'text' : 'raw'
      const value = (hit as any)[field] || ''
      setEditingItem({ id: hit.id, field, value })
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
      case 'delete':
        for (const id of state.selectedIds) state.removeItem(id)
        break
      case 'duplicate':
        state.copySelected(); state.paste({ x: 30, y: 30 })
        break
      case 'bring-front': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        if (!vp) break
        const selected = vp.items.filter(i => state.selectedIds.has(i.id))
        const rest = vp.items.filter(i => !state.selectedIds.has(i.id))
        useStore.setState((s) => ({
          project: { ...s.project, viewports: s.project.viewports.map(v =>
            v.id === s.activeViewportId ? { ...v, items: [...rest, ...selected] } : v
          )},
        }))
        break
      }
      case 'send-back': {
        const vp = state.project.viewports.find(v => v.id === state.activeViewportId)
        if (!vp) break
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
      case 'new-note':
        state.addItem({ kind: 'note', id: crypto.randomUUID(), text: '', purpose: '', importance: '', tags: [], pos: { x: contextMenu.wx - 125, y: contextMenu.wy - 75 } })
        break
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
            allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
            allowFullScreen={false}
            key={bgVideo}
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

      {/* Status bar */}
      <div className="status-bar" style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10 }}>
        <button className="status-bar-btn" onClick={() => { useStore.getState().setZoom(canvas.zoom * 0.8); needsRedraw.current = true }}>−</button>
        <span style={{ minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(canvas.zoom * 100)}%</span>
        <button className="status-bar-btn" onClick={() => { useStore.getState().setZoom(canvas.zoom * 1.25); needsRedraw.current = true }}>+</button>
        <div className="status-divider" />
        <span>{itemCount} items</span>
        <div className="status-divider" />
        <button className="status-bar-btn" onClick={handleEyedropper} title="Pick color from screen">🎨</button>
        <button className="status-bar-btn" onClick={() => {
          const s = useStore.getState()
          const vp = s.project.viewports.find(v => v.id === s.activeViewportId)
          if (!vp) return
          const pos = vp.items.filter(i => i.kind !== 'connector' && 'pos' in i) as any[]
          if (pos.length === 0) return
          const minX = Math.min(...pos.map(i => i.pos.x))
          const maxX = Math.max(...pos.map(i => i.pos.x + (i.size?.w ?? 250)))
          const minY = Math.min(...pos.map(i => i.pos.y))
          const maxY = Math.max(...pos.map(i => i.pos.y + (i.size?.h ?? 150)))
          const r = canvasRef.current?.getBoundingClientRect()
          if (!r) return
          const pad = 80
          const z = Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2) / (maxY - minY), 2)
          s.setZoom(z)
          s.setPan(r.width / 2 - ((minX + maxX) / 2) * z, r.height / 2 - ((minY + maxY) / 2) * z)
        }} style={{ color: '#00fff0', fontWeight: 600 }}>Fit All</button>
        <button onClick={() => {
          const cvs = canvasRef.current
          if (!cvs) return
          const a = document.createElement('a')
          a.download = 'moodboard.png'
          a.href = cvs.toDataURL('image/png')
          a.click()
        }} className="status-bar-btn" style={{ color: '#00fff0', fontWeight: 600 }}>Export PNG</button>
      </div>

      {/* Floating Add Toolbar — bottom-right */}
      <div className="add-toolbar">
        {addToolbarOpen && (
          <div className="add-toolbar-items">
            {ITEM_TYPES.map(({ kind, icon, label }) => (
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
        if (item.kind === 'video') return <video key={item.id} src={item.source || item.sourceUrl} autoPlay loop muted playsInline style={{ position: 'absolute', left: x, top: y, width: w, height: h, objectFit: 'cover', borderRadius: 10, pointerEvents: 'none' }} />
        if (item.kind === 'image') return <img key={item.id} src={item.thumbnail || item.fullSource} alt={item.description} style={{ position: 'absolute', left: x, top: y, width: w, height: h, objectFit: 'cover', borderRadius: 10, pointerEvents: 'none' }} />
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
                style={{ color: '#7c6cbf', textDecoration: 'none', fontSize: 10, fontWeight: 600 }}
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
              border: `2px solid ${isDark() ? '#7c6cbf' : '#6a5aae'}`,
              borderRadius: 8, padding: 8, outline: 'none', resize: 'none',
              zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
            }}
          />
        )
      })()}

      {itemCount > 0 && (
        <div className="badge badge-accent" style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
          {itemCount} items on board
        </div>
      )}

      {/* Minimap */}
      {itemCount > 0 && (
        <Minimap items={items} canvas={canvas} canvasRef={canvasRef} />
      )}

      {/* Layers panel toggle */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)', zIndex: 10 }}
        title="Toggle layers"
      >
        Layers
      </button>

      {/* Layers panel */}
      {showLayers && (
        <LayersPanel items={items} onClose={() => setShowLayers(false)} />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="glass-card"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 100, padding: 4, minWidth: 180 }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {/* Add item section */}
          <div className="px-2 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider">Add Item</div>
          {ITEM_TYPES.map(({ kind, icon, label }) => (
            <CtxItem
              key={kind}
              label={`${icon}  ${label}`}
              onClick={() => {
                const state = useStore.getState()
                state.addItem(createDefaultItem(kind, { x: contextMenu.wx, y: contextMenu.wy }))
                setContextMenu(null)
              }}
            />
          ))}
          {contextMenu.itemId && (
            <>
              <div className="status-divider" style={{ margin: '4px 0' }} />
              <div className="px-2 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider">Actions</div>
              <CtxItem label="Duplicate" shortcut="⌘C ⌘V" onClick={() => handleContextAction('duplicate')} />
              <CtxItem label="Bring to Front" onClick={() => handleContextAction('bring-front')} />
              <CtxItem label="Send to Back" onClick={() => handleContextAction('send-back')} />
              <div className="status-divider" style={{ margin: '4px 0' }} />
              <CtxItem label="Select All" shortcut="⌘A" onClick={() => handleContextAction('select-all')} />
              <CtxItem label="Delete" shortcut="⌫" onClick={() => handleContextAction('delete')} danger />
            </>
          )}
          {!contextMenu.itemId && (
            <>
              <div className="status-divider" style={{ margin: '4px 0' }} />
              <CtxItem label="Select All" shortcut="⌘A" onClick={() => handleContextAction('select-all')} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Context Menu Item ──────────────────────────────────────────────

function CtxItem({ label, shortcut, onClick, danger }: { label: string; shortcut?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex justify-between items-center px-3 py-1.5 rounded text-xs text-left transition-fast ${
        danger ? 'text-danger hover:bg-danger-light' : 'text-text-primary hover:bg-surface-2'
      }`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-2xs text-text-muted ml-4">{shortcut}</span>}
    </button>
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
    ctx.strokeStyle = isDark() ? '#7c6cbf' : '#6a5aae'; ctx.lineWidth = 1.5 / zoom
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
    default: drawTextBasedItem(ctx, item, x, y, w, h, zoom); break
  }
  ctx.restore()
}

function drawImageItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9}px Inter, sans-serif`; ctx.fillText('IMAGE', x + PAD, y + PAD + 9)
  const imgTop = y + PAD + 20; const imgH = h - PAD * 2 - 40; const imgW = w - PAD * 2
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
    ctx.fillStyle = isDark() ? '#ff6b6b' : '#d44'; ctx.font = `${10}px Inter, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('Image failed to load', x + w / 2, imgTop + imgH / 2 + 4); ctx.textAlign = 'start'
  } else if (src?.startsWith('http')) {
    ctx.fillStyle = isDark() ? '#1a1a25' : '#f1f5f9'; ctx.fillRect(x + PAD, imgTop, imgW, imgH)
    ctx.fillStyle = txtMuted(); ctx.font = `${10}px Inter, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('Loading image...', x + w / 2, imgTop + imgH / 2 + 4); ctx.textAlign = 'start'
  } else {
    ctx.fillStyle = isDark() ? '#1a1a25' : '#f1f5f9'; ctx.fillRect(x + PAD, imgTop, imgW, imgH)
    ctx.fillStyle = txtMuted(); ctx.font = `${10}px Inter, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('No image', x + w / 2, imgTop + imgH / 2 + 4); ctx.textAlign = 'start'
  }
  ctx.fillStyle = txtPrimary(); ctx.font = `${10}px Inter, sans-serif`; ctx.fillText(item.description || '', x + PAD, y + h - PAD)
}

function drawPaletteItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9}px Inter, sans-serif`; ctx.fillText('PALETTE', x + PAD, y + PAD + 9)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12}px Inter, sans-serif`; ctx.fillText(item.label || '', x + PAD, y + PAD + 24)
  const colors = item.colors || []
  const sw = Math.min(60, (w - PAD * 2 - (colors.length - 1) * 4) / Math.max(colors.length, 1))
  const sh = h - PAD * 2 - 44
  for (let i = 0; i < colors.length; i++) {
    const sx = x + PAD + i * (sw + 4)
    ctx.fillStyle = colors[i].hex || '#000'; ctx.beginPath(); roundRect(ctx, sx, y + PAD + 32, sw, sh, 4); ctx.fill()
    ctx.fillStyle = txtSecondary(); ctx.font = `${8}px Inter, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(colors[i].hex || '', sx + sw / 2, y + PAD + 32 + sh + 12); ctx.textAlign = 'start'
  }
}

function drawGradientItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9}px Inter, sans-serif`; ctx.fillText('GRADIENT', x + PAD, y + PAD + 9)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12}px Inter, sans-serif`; ctx.fillText(item.label || '', x + PAD, y + PAD + 24)
  const stops = item.stops || []
  if (stops.length >= 2) {
    const dir = (item.direction || 90) * Math.PI / 180
    const bx = x + PAD; const by = y + PAD + 32; const bw = w - PAD * 2; const bh = h - PAD * 2 - 36
    const grad = ctx.createLinearGradient(bx + bw / 2 - Math.cos(dir) * bw / 2, by + bh / 2 - Math.sin(dir) * bh / 2, bx + bw / 2 + Math.cos(dir) * bw / 2, by + bh / 2 + Math.sin(dir) * bh / 2)
    for (const s of stops) grad.addColorStop(Math.max(0, Math.min(1, s.position)), s.color)
    ctx.fillStyle = grad; ctx.beginPath(); roundRect(ctx, bx, by, bw, bh, 6); ctx.fill()
  }
}

function drawFontItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const ff = item.fontFamily || 'Inter'; loadFont(ff)
  ctx.fillStyle = accent(); ctx.font = `600 ${9}px Inter, sans-serif`; ctx.fillText('FONT', x + PAD, y + PAD + 9)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${11}px Inter, sans-serif`; ctx.fillText(ff, x + PAD, y + PAD + 24)
  const sample = item.sampleText || 'The quick brown fox'
  const sizes = [24, 16, 12]; let ty = y + PAD + 44
  for (const size of sizes) {
    ctx.fillStyle = txtPrimary(); ctx.font = `400 ${size}px "${ff}", sans-serif`
    ctx.fillText(sample.slice(0, 40), x + PAD, ty); ty += size + 8; if (ty > y + h - PAD) break
  }
}

function drawSwatchItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const bh = h * 0.55
  ctx.fillStyle = item.hex || '#000'; ctx.beginPath(); roundRect(ctx, x + PAD, y + PAD, w - PAD * 2, bh, 6); ctx.fill()
  ctx.fillStyle = txtPrimary(); ctx.font = `600 ${13}px Inter, sans-serif`; ctx.fillText(item.name || item.hex, x + PAD, y + PAD + bh + 18)
  ctx.fillStyle = txtSecondary(); ctx.font = `${11}px Inter, sans-serif`; ctx.fillText(item.hex, x + PAD, y + PAD + bh + 34)
  if (item.usage) { ctx.fillStyle = txtMuted(); ctx.font = `${10}px Inter, sans-serif`; wrapText(ctx, item.usage, x + PAD, y + PAD + bh + 50, w - PAD * 2, 14, h - PAD - bh - 54) }
}

function drawSizeGuideItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9}px Inter, sans-serif`; ctx.fillText('SIZE', x + PAD, y + PAD + 9)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12}px Inter, sans-serif`; ctx.fillText(item.label || '', x + PAD, y + PAD + 24)
  const mw = w - PAD * 2; const mh = h - PAD * 2 - 48; const aspect = (item.width || 1) / (item.height || 1)
  let bw = mw * 0.8; let bh = bw / aspect; if (bh > mh) { bh = mh; bw = bh * aspect }
  const cx = x + PAD + (mw - bw) / 2; const by = y + PAD + 34
  ctx.strokeStyle = '#00fff0'; ctx.lineWidth = 1.5 / zoom; ctx.setLineDash([4 / zoom, 3 / zoom]); ctx.strokeRect(cx, by, bw, bh); ctx.setLineDash([])
  ctx.fillStyle = accent(); ctx.font = `${10}px Inter, sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(`${item.width}${item.unit}`, cx + bw / 2, by + bh + 14)
  ctx.save(); ctx.translate(cx - 8, by + bh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${item.height}${item.unit}`, 0, 0); ctx.restore()
  ctx.fillStyle = txtMuted(); ctx.font = `${9}px Inter, sans-serif`; ctx.fillText(item.orientation, cx + bw / 2, by + bh + 26); ctx.textAlign = 'start'
}

function drawContainerItem(ctx: CanvasRenderingContext2D, item: ContainerItem, x: number, y: number, w: number, h: number, zoom: number) {
  ctx.fillStyle = '#059669'; ctx.font = `600 ${9}px Inter, sans-serif`; ctx.fillText('CONTAINER', x + PAD, y + PAD + 9)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12}px Inter, sans-serif`; ctx.fillText(item.label || '', x + PAD, y + PAD + 24)
  ctx.fillStyle = txtMuted(); ctx.font = `${10}px Inter, sans-serif`
  const childCount = item.children?.length || 0
  ctx.fillText(`${childCount} items · ${item.layout}${item.collapsed ? ' · collapsed' : ''}`, x + PAD, y + PAD + 40)

  const iconX = x + w - PAD - 16
  const iconY = y + PAD + 4
  ctx.strokeStyle = txtMuted(); ctx.lineWidth = 1.5 / zoom
  ctx.beginPath()
  if (item.collapsed) {
    ctx.moveTo(iconX, iconY + 6); ctx.lineTo(iconX + 6, iconY); ctx.lineTo(iconX + 12, iconY + 6)
  } else {
    ctx.moveTo(iconX, iconY + 6); ctx.lineTo(iconX + 12, iconY + 6)
    ctx.moveTo(iconX + 6, iconY); ctx.lineTo(iconX + 6, iconY + 12)
  }
  ctx.stroke()

  if (!item.collapsed && item.children?.length) {
    const previewY = y + PAD + 52
    const previewH = h - PAD * 2 - 56
    const cols = Math.max(1, Math.min(4, Math.floor((w - PAD * 2) / 64)))
    const cellW = (w - PAD * 2 - (cols - 1) * 4) / cols
    const cellH = Math.min(40, previewH / Math.ceil(item.children.length / cols))
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = x + PAD + col * (cellW + 4)
      const cy = previewY + row * (cellH + 4)
      const ccolor = KIND_COLORS[child.kind] || accent()
      ctx.fillStyle = ccolor + '22'; ctx.strokeStyle = ccolor
      ctx.lineWidth = 0.5 / zoom
      ctx.beginPath(); roundRect(ctx, cx, cy, cellW, cellH, 3); ctx.fill(); ctx.stroke()
      ctx.fillStyle = ccolor
      ctx.font = `600 ${6}px Inter, sans-serif`
      ctx.fillText(child.kind.toUpperCase(), cx + 4, cy + 10)
      let preview = ''
      if ('text' in (child as any)) preview = (child as any).text?.slice(0, 20) || ''
      else if ('description' in (child as any)) preview = (child as any).description?.slice(0, 20) || ''
      else if ('url' in (child as any)) preview = (child as any).url?.slice(0, 20) || ''
      else if ('raw' in (child as any)) preview = (child as any).raw?.slice(0, 20) || ''
      ctx.fillStyle = txtSecondary()
      ctx.font = `${8}px Inter, sans-serif`
      ctx.fillText(preview, cx + 4, cy + 22)
    }
  } else if (item.collapsed || !item.children?.length) {
    ctx.fillStyle = txtMuted(); ctx.font = `${9}px Inter, sans-serif`
    if (childCount === 0) ctx.fillText('Empty — drag items here or add via chat', x + PAD, y + PAD + 56)
  }
}

function drawLinkItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const url = item.url || ''
  let domain = ''
  try { domain = new URL(url).hostname.replace('www.', '') } catch {}
  const title = item.title || domain || 'Link'
  const summary = item.summary || item.description || url

  ctx.fillStyle = accent(); ctx.font = HEADER_FONT; ctx.fillText('LINK', x + PAD, y + PAD + 9)
  ctx.fillStyle = txtPrimary(); ctx.font = `600 13px Inter, sans-serif`
  ctx.fillText(title.slice(0, 40), x + PAD, y + PAD + 26)

  if (domain) {
    ctx.fillStyle = txtMuted(); ctx.font = SMALL_FONT
    ctx.fillText(domain, x + PAD, y + PAD + 40)
  }

  if (summary) {
    ctx.fillStyle = txtSecondary(); ctx.font = BODY_FONT
    wrapText(ctx, summary.slice(0, 120), x + PAD, y + PAD + 54, w - PAD * 2, 14, h - PAD - 58)
  }

  // URL bar at bottom
  ctx.fillStyle = isDark() ? 'rgba(0,255,240,0.06)' : 'rgba(0,0,0,0.03)'
  ctx.fillRect(x + PAD, y + h - PAD - 16, w - PAD * 2, 16)
  ctx.fillStyle = txtMuted(); ctx.font = `${8}px Inter, sans-serif`
  ctx.fillText(url.slice(0, 50) + (url.length > 50 ? '…' : ''), x + PAD + 4, y + h - PAD - 5)
}

function drawTextBasedItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, zoom: number) {
  const label = item.kind.charAt(0).toUpperCase() + item.kind.slice(1).toLowerCase()
  ctx.fillStyle = accent(); ctx.font = `600 ${10}px Inter, sans-serif`; ctx.fillText(label, x + PAD, y + PAD + 10)
  const text = item.text || item.raw || item.content || ''
  ctx.fillStyle = txtPrimary(); ctx.font = `${12}px Inter, sans-serif`

  if (text.length > 60 || text.includes('\n')) {
    wrapText(ctx, text, x + PAD, y + PAD + 24, w - PAD * 2, 16, h - PAD * 2 - 10)
  } else if (text.length > 30) {
    ctx.font = `500 ${9}px Inter, sans-serif`
    ctx.fillText(text.slice(0, 30), x + PAD, y + PAD + 24)
  } else if (text.length > 0) {
    ctx.font = `500 ${10}px Inter, sans-serif`
    ctx.fillText(text.slice(0, 60), x + PAD, y + PAD + 24)
  }

  if (item.purpose && h > 100) {
    ctx.fillStyle = txtMuted(); ctx.font = `500 ${9}px Inter, sans-serif`
    ctx.fillText(item.purpose.slice(0, 40), x + PAD, y + PAD + 40)
  }

  const summary = [item.purpose, item.importance].filter(Boolean).join(' · ')
  if (summary) {
    wrapText(ctx, summary, x + PAD, y + PAD + 28, w - PAD * 2, 16, h - PAD * 2 - 24)
  } else {
    ctx.font = `500 ${9}px Inter, sans-serif`
    ctx.fillText(item.text?.slice(0, 30) || item.kind, x + PAD, y + PAD + 28)
  }

  if ('tags' in item && item.tags?.length) {
    const tags = item.tags.join(', ')
    ctx.fillStyle = txtMuted(); ctx.font = `${8}px Inter, sans-serif`
    ctx.fillText(tags.slice(0, 3).join(', '), x + PAD, y + h - PAD + 14)
  }
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
