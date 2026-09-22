import { useRef, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import { hitTestItem } from '@/lib/layout'
import { loadFont } from '@/lib/fonts'
import type { BoardItem, Position, PortConnection, ContainerItem, ConnectorOwner } from '@/types'

// ─── Theme ──────────────────────────────────────────────────────────

function isDark() { return document.body.classList.contains('dark') }
function gridColor() { return isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }
function crosshairColor() { return isDark() ? 'rgba(45,212,191,0.3)' : 'rgba(13,148,136,0.3)' }
function cardBg(sel: boolean) { return isDark() ? (sel ? '#1a1a2e' : '#16161f') : (sel ? '#f0fdf9' : '#ffffff') }
function cardBorder(sel: boolean) { return isDark() ? (sel ? 'rgba(45,212,191,0.5)' : 'rgba(255,255,255,0.08)') : (sel ? 'rgba(13,148,136,0.5)' : 'rgba(0,0,0,0.06)') }
function txtPrimary() { return isDark() ? '#e8e8ec' : '#1f2937' }
function txtSecondary() { return isDark() ? '#a1a1b5' : '#6b7280' }
function txtMuted() { return isDark() ? '#6b6b80' : '#9ca3af' }
function accent() { return isDark() ? '#2dd4bf' : '#0d9488' }
function shadow(sel: boolean) { return isDark() ? (sel ? 'rgba(45,212,191,0.3)' : 'rgba(0,0,0,0.4)') : (sel ? 'rgba(13,148,136,0.3)' : 'rgba(0,0,0,0.12)') }

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
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageCache.set(url, img)
      // Evict oldest if over limit
      while (imageCache.size > MAX_IMAGES) {
        const first = imageCache.keys().next().value
        if (first) imageCache.delete(first)
      }
    }
    img.onerror = () => { imageFailed.add(url) }
    img.src = url
  }
  return null
}

// ─── Constants ──────────────────────────────────────────────────────

const PORT_RADIUS = 5
const PORT_COLORS: Record<string, string> = { data: '#3b82f6', visual: '#8b5cf6', reference: '#10b981', any: '#6b7280' }
const CONNECTOR_COLORS: Record<ConnectorOwner, string> = { user: '#3b82f6', llm: '#8b5cf6', objective: '#6b7280' }
const KIND_COLORS: Record<string, string> = {
  note: '#10b981', text: '#3b82f6', image: '#8b5cf6', link: '#14b8a6', video: '#f97316',
  palette: '#ec4899', gradient: '#8b5cf6', font: '#3b82f6', swatch: '#ec4899', sizeguide: '#6b7280', container: '#10b981',
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
      if (!needsRedraw.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      needsRedraw.current = false

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
      state.clearSelection()
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
    if (!d) return

    if (d.type === 'pan') {
      state.setPan(e.clientX - d.sx, e.clientY - d.sy)
    } else if (d.type === 'item' && d.starts) {
      const dx = (e.clientX - d.sx) / state.canvas.zoom
      const dy = (e.clientY - d.sy) / state.canvas.zoom
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
    if (!hit) return

    // Double-click on image that's already selected → open lightbox
    if (hit.kind === 'image' && state.selectedIds.has(hit.id)) {
      window.dispatchEvent(new CustomEvent('moodbored:lightbox', { detail: hit }))
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

  const itemCount = items.filter(i => i.kind !== 'connector').length
  const bgType = project.settings.canvasBgType || 'color'
  const bgVideo = project.settings.canvasBgVideo || ''

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'crosshair' }} onDrop={onDrop} onDragOver={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}>
      {/* Video background */}
      {bgType === 'video' && bgVideo && (
        <video
          autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
          key={bgVideo}
        >
          <source src={bgVideo} type="video/mp4" />
        </video>
      )}

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, background: 'transparent' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onClick={onClick} onDoubleClick={onDoubleClick} onWheel={onWheel} onContextMenu={e => e.preventDefault()} />

      {/* Status bar */}
      <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,0.9)', padding: '6px 10px', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => { useStore.getState().setZoom(canvas.zoom * 0.8); needsRedraw.current = true }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '0 4px' }}>−</button>
        <span style={{ minWidth: 36, textAlign: 'center' }}>{Math.round(canvas.zoom * 100)}%</span>
        <button onClick={() => { useStore.getState().setZoom(canvas.zoom * 1.25); needsRedraw.current = true }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '0 4px' }}>+</button>
        <div style={{ width: 1, height: 12, background: '#e2e4e8' }} />
        <span>{itemCount} items</span>
        <div style={{ width: 1, height: 12, background: '#e2e4e8' }} />
        <button onClick={() => {
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
        }} style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Fit All</button>
        <button onClick={() => {
          const cvs = canvasRef.current
          if (!cvs) return
          const a = document.createElement('a')
          a.download = 'moodboard.png'
          a.href = cvs.toDataURL('image/png')
          a.click()
        }} style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Export PNG</button>
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

      {itemCount > 0 && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: 4 }}>
          {itemCount} items on board
        </div>
      )}
    </div>
  )
}

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
    ctx.fillStyle = txtSecondary(); ctx.font = `${8 / zoom}px Inter, sans-serif`
    ctx.textAlign = port.direction === 'input' ? 'left' : 'right'
    ctx.fillText(port.name, pos.x + (port.direction === 'input' ? 10 : -10) / zoom, pos.y + 3 / zoom)
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
    ctx.fillStyle = isDark() ? '#16161f' : '#ffffff'
    ctx.strokeStyle = '#0d9488'; ctx.lineWidth = 1.5 / zoom
    ctx.beginPath(); roundRect(ctx, handle.x, handle.y, s, s, 2 / zoom); ctx.fill(); ctx.stroke()
  }
}

function drawItem(ctx: CanvasRenderingContext2D, item: BoardItem, selected: boolean, zoom: number) {
  if (item.kind === 'connector' || !('pos' in item)) return
  const x = item.pos.x; const y = item.pos.y
  const w = item.size?.w ?? 250; const h = item.size?.h ?? 150
  const kindColor = KIND_COLORS[item.kind] || accent()

  ctx.shadowColor = shadow(selected); ctx.shadowBlur = selected ? 16 / zoom : 6 / zoom; ctx.shadowOffsetY = 2 / zoom
  ctx.fillStyle = cardBg(selected)
  ctx.beginPath(); roundRect(ctx, x, y, w, h, 10 / zoom); ctx.fill()
  ctx.shadowColor = 'transparent'

  ctx.strokeStyle = cardBorder(selected); ctx.lineWidth = (selected ? 1.5 : 0.75) / zoom
  ctx.beginPath(); roundRect(ctx, x, y, w, h, 10 / zoom); ctx.stroke()

  ctx.strokeStyle = kindColor; ctx.lineWidth = 2 / zoom
  ctx.beginPath(); ctx.moveTo(x + 14 / zoom, y + 1 / zoom); ctx.lineTo(x + w - 14 / zoom, y + 1 / zoom); ctx.stroke()

  ctx.save()
  ctx.beginPath(); roundRect(ctx, x, y, w, h, 10 / zoom); ctx.clip()
  const pad = 14 / zoom

  switch (item.kind) {
    case 'image': drawImageItem(ctx, item, x, y, w, h, pad, zoom); break
    case 'palette': drawPaletteItem(ctx, item, x, y, w, h, pad, zoom); break
    case 'gradient': drawGradientItem(ctx, item, x, y, w, h, pad, zoom); break
    case 'font': drawFontItem(ctx, item, x, y, w, h, pad, zoom); break
    case 'swatch': drawSwatchItem(ctx, item, x, y, w, h, pad, zoom); break
    case 'sizeguide': drawSizeGuideItem(ctx, item, x, y, w, h, pad, zoom); break
    case 'container': drawContainerItem(ctx, item, x, y, w, h, pad, zoom); break
    default: drawTextBasedItem(ctx, item, x, y, w, h, pad, zoom); break
  }
  ctx.restore()
}

function drawImageItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9 / zoom}px Inter, sans-serif`; ctx.fillText('IMAGE', x + pad, y + pad + 9 / zoom)
  const imgTop = y + pad + 16 / zoom; const imgH = h - pad * 2 - 36 / zoom; const imgW = w - pad * 2
  const img = getImage(item.thumbnail || item.fullSource)
  if (img) {
    const ir = img.naturalWidth / img.naturalHeight; const ar = imgW / imgH
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
    if (ir > ar) { sw = img.naturalHeight * ar; sx = (img.naturalWidth - sw) / 2 }
    else { sh = img.naturalWidth / ar; sy = (img.naturalHeight - sh) / 2 }
    ctx.save(); roundRect(ctx, x + pad, imgTop, imgW, imgH, 4 / zoom); ctx.clip()
    ctx.drawImage(img, sx, sy, sw, sh, x + pad, imgTop, imgW, imgH); ctx.restore()
  } else if (item.fullSource?.startsWith('http')) {
    // Show URL as clickable text
    ctx.fillStyle = isDark() ? '#1a1a25' : '#f1f5f9'; ctx.fillRect(x + pad, imgTop, imgW, imgH)
    ctx.fillStyle = txtMuted(); ctx.font = `${10 / zoom}px Inter, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('Loading image...', x + w / 2, imgTop + imgH / 2 + 4 / zoom); ctx.textAlign = 'start'
  } else {
    ctx.fillStyle = isDark() ? '#1a1a25' : '#f1f5f9'; ctx.fillRect(x + pad, imgTop, imgW, imgH)
    ctx.fillStyle = txtMuted(); ctx.font = `${10 / zoom}px Inter, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('No image', x + w / 2, imgTop + imgH / 2 + 4 / zoom); ctx.textAlign = 'start'
  }
  ctx.fillStyle = txtPrimary(); ctx.font = `${10 / zoom}px Inter, sans-serif`; ctx.fillText(item.description || '', x + pad, y + h - pad - 2 / zoom)
}

function drawPaletteItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9 / zoom}px Inter, sans-serif`; ctx.fillText('PALETTE', x + pad, y + pad + 9 / zoom)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12 / zoom}px Inter, sans-serif`; ctx.fillText(item.label || '', x + pad, y + pad + 24 / zoom)
  const colors = item.colors || []
  const sw = Math.min(60, (w - pad * 2 - (colors.length - 1) * 4 / zoom) / Math.max(colors.length, 1))
  const sh = h - pad * 2 - 40 / zoom
  for (let i = 0; i < colors.length; i++) {
    const sx = x + pad + i * (sw + 4 / zoom)
    ctx.fillStyle = colors[i].hex || '#000'; ctx.beginPath(); roundRect(ctx, sx, y + pad + 32 / zoom, sw, sh, 4 / zoom); ctx.fill()
    ctx.fillStyle = txtSecondary(); ctx.font = `${8 / zoom}px Inter, sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(colors[i].hex || '', sx + sw / 2, y + pad + 32 / zoom + sh + 12 / zoom); ctx.textAlign = 'start'
  }
}

function drawGradientItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9 / zoom}px Inter, sans-serif`; ctx.fillText('GRADIENT', x + pad, y + pad + 9 / zoom)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12 / zoom}px Inter, sans-serif`; ctx.fillText(item.label || '', x + pad, y + pad + 24 / zoom)
  const stops = item.stops || []
  if (stops.length >= 2) {
    const dir = (item.direction || 90) * Math.PI / 180
    const bx = x + pad; const by = y + pad + 30 / zoom; const bw = w - pad * 2; const bh = h - pad * 2 - 30 / zoom
    const grad = ctx.createLinearGradient(bx + bw / 2 - Math.cos(dir) * bw / 2, by + bh / 2 - Math.sin(dir) * bh / 2, bx + bw / 2 + Math.cos(dir) * bw / 2, by + bh / 2 + Math.sin(dir) * bh / 2)
    for (const s of stops) grad.addColorStop(Math.max(0, Math.min(1, s.position)), s.color)
    ctx.fillStyle = grad; ctx.beginPath(); roundRect(ctx, bx, by, bw, bh, 6 / zoom); ctx.fill()
  }
}

function drawFontItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  const ff = item.fontFamily || 'Inter'; loadFont(ff)
  ctx.fillStyle = accent(); ctx.font = `600 ${9 / zoom}px Inter, sans-serif`; ctx.fillText('FONT', x + pad, y + pad + 9 / zoom)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${11 / zoom}px Inter, sans-serif`; ctx.fillText(ff, x + pad, y + pad + 24 / zoom)
  const sample = item.sampleText || 'The quick brown fox'
  const sizes = [24, 16, 12]; let ty = y + pad + 44 / zoom
  for (const size of sizes) {
    ctx.fillStyle = txtPrimary(); ctx.font = `400 ${size / zoom}px "${ff}", sans-serif`
    ctx.fillText(sample.slice(0, 40), x + pad, ty); ty += (size + 8) / zoom; if (ty > y + h - pad) break
  }
}

function drawSwatchItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  const bh = h * 0.55
  ctx.fillStyle = item.hex || '#000'; ctx.beginPath(); roundRect(ctx, x + pad, y + pad, w - pad * 2, bh, 6 / zoom); ctx.fill()
  ctx.fillStyle = txtPrimary(); ctx.font = `600 ${13 / zoom}px Inter, sans-serif`; ctx.fillText(item.name || item.hex, x + pad, y + pad + bh + 18 / zoom)
  ctx.fillStyle = txtSecondary(); ctx.font = `${11 / zoom}px Inter, sans-serif`; ctx.fillText(item.hex, x + pad, y + pad + bh + 34 / zoom)
  if (item.usage) { ctx.fillStyle = txtMuted(); ctx.font = `${10 / zoom}px Inter, sans-serif`; wrapText(ctx, item.usage, x + pad, y + pad + bh + 50 / zoom, w - pad * 2, 14 / zoom, h - pad - bh - 50 / zoom) }
}

function drawSizeGuideItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${9 / zoom}px Inter, sans-serif`; ctx.fillText('SIZE', x + pad, y + pad + 9 / zoom)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12 / zoom}px Inter, sans-serif`; ctx.fillText(item.label || '', x + pad, y + pad + 24 / zoom)
  const mw = w - pad * 2; const mh = h - pad * 2 - 45 / zoom; const aspect = (item.width || 1) / (item.height || 1)
  let bw = mw * 0.8; let bh = bw / aspect; if (bh > mh) { bh = mh; bw = bh * aspect }
  const cx = x + pad + (mw - bw) / 2; const by = y + pad + 32 / zoom
  ctx.strokeStyle = '#0d9488'; ctx.lineWidth = 1.5 / zoom; ctx.setLineDash([4 / zoom, 3 / zoom]); ctx.strokeRect(cx, by, bw, bh); ctx.setLineDash([])
  ctx.fillStyle = accent(); ctx.font = `500 ${10 / zoom}px Inter, sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(`${item.width}${item.unit}`, cx + bw / 2, by + bh + 14 / zoom)
  ctx.save(); ctx.translate(cx - 8 / zoom, by + bh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${item.height}${item.unit}`, 0, 0); ctx.restore()
  ctx.fillStyle = txtMuted(); ctx.font = `${9 / zoom}px Inter, sans-serif`; ctx.fillText(item.orientation, cx + bw / 2, by + bh + 26 / zoom); ctx.textAlign = 'start'
}

function drawContainerItem(ctx: CanvasRenderingContext2D, item: ContainerItem, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  ctx.fillStyle = '#059669'; ctx.font = `600 ${9 / zoom}px Inter, sans-serif`; ctx.fillText('CONTAINER', x + pad, y + pad + 9 / zoom)
  ctx.fillStyle = txtPrimary(); ctx.font = `500 ${12 / zoom}px Inter, sans-serif`; ctx.fillText(item.label || '', x + pad, y + pad + 24 / zoom)
  ctx.fillStyle = txtMuted(); ctx.font = `${10 / zoom}px Inter, sans-serif`
  const childCount = item.children?.length || 0
  ctx.fillText(`${childCount} items · ${item.layout}${item.collapsed ? ' · collapsed' : ''}`, x + pad, y + pad + 38 / zoom)

  // Draw expand/collapse indicator
  const iconX = x + w - pad - 16 / zoom
  const iconY = y + pad + 4 / zoom
  ctx.strokeStyle = txtMuted(); ctx.lineWidth = 1.5 / zoom
  ctx.beginPath()
  if (item.collapsed) {
    // Plus icon
    ctx.moveTo(iconX, iconY + 6 / zoom); ctx.lineTo(iconX + 12 / zoom, iconY + 6 / zoom)
    ctx.moveTo(iconX + 6 / zoom, iconY); ctx.lineTo(iconX + 6 / zoom, iconY + 12 / zoom)
  } else {
    // Minus icon
    ctx.moveTo(iconX, iconY + 6 / zoom); ctx.lineTo(iconX + 12 / zoom, iconY + 6 / zoom)
  }
  ctx.stroke()

  // When expanded, draw children as mini-previews
  if (!item.collapsed && item.children?.length > 0) {
    const previewY = y + pad + 50 / zoom
    const previewH = h - pad * 2 - 50 / zoom
    const cols = Math.max(1, Math.min(4, Math.floor((w - pad * 2) / (60 / zoom))))
    const cellW = (w - pad * 2 - (cols - 1) * 4 / zoom) / cols
    const cellH = Math.min(40 / zoom, previewH / Math.ceil(item.children.length / cols))

    for (let i = 0; i < Math.min(12, item.children.length); i++) {
      const child = item.children[i]
      if (!('pos' in child)) continue
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = x + pad + col * (cellW + 4 / zoom)
      const cy = previewY + row * (cellH + 4 / zoom)

      // Mini card
      ctx.fillStyle = isDark() ? '#1a1a25' : '#f8f9fa'
      ctx.strokeStyle = isDark() ? '#2a2a3a' : '#dee2e6'
      ctx.lineWidth = 0.5 / zoom
      ctx.beginPath(); roundRect(ctx, cx, cy, cellW, cellH, 3 / zoom); ctx.fill(); ctx.stroke()

      // Kind label
      const kindColor = KIND_COLORS[child.kind] || '#6b7280'
      ctx.fillStyle = kindColor
      ctx.font = `600 ${6 / zoom}px Inter, sans-serif`
      ctx.fillText(child.kind.toUpperCase(), cx + 4 / zoom, cy + 10 / zoom)

      // Content preview
      ctx.fillStyle = txtPrimary()
      ctx.font = `${8 / zoom}px Inter, sans-serif`
      let preview = ''
      switch (child.kind) {
        case 'note': preview = (child as any).text?.slice(0, 20) || ''; break
        case 'text': preview = (child as any).raw?.slice(0, 20) || ''; break
        case 'image': preview = (child as any).description?.slice(0, 20) || ''; break
        case 'palette': preview = (child as any).label || ''; break
        default: preview = child.kind; break
      }
      ctx.fillText(preview, cx + 4 / zoom, cy + 22 / zoom)
    }

    if (item.children.length > 12) {
      ctx.fillStyle = txtMuted(); ctx.font = `${9 / zoom}px Inter, sans-serif`
      ctx.fillText(`+${item.children.length - 12} more`, x + pad, y + h - pad)
    }
  }
}

function drawTextBasedItem(ctx: CanvasRenderingContext2D, item: any, x: number, y: number, w: number, h: number, pad: number, zoom: number) {
  ctx.fillStyle = accent(); ctx.font = `600 ${10 / zoom}px Inter, sans-serif`; ctx.fillText(item.kind.toUpperCase(), x + pad, y + pad + 10 / zoom)
  ctx.fillStyle = txtPrimary(); ctx.font = `${12 / zoom}px Inter, sans-serif`
  let text = ''
  switch (item.kind) {
    case 'text': text = item.raw; break
    case 'link': text = item.title || item.url; break
    case 'video': text = item.subjectDesc || 'Video'; break
    default: text = item.text || ''; break
  }

  // Check if expanded (from store)
  const expandedId = useStore.getState().expandedItemId
  const isExpanded = expandedId === item.id

  if (isExpanded) {
    // Expanded: show full text with wrapping
    wrapText(ctx, text, x + pad, y + pad + 24 / zoom, w - pad * 2, 16 / zoom, h - pad * 2 - 10 / zoom)
    // Collapse indicator
    ctx.fillStyle = accent()
    ctx.font = `500 ${9 / zoom}px Inter, sans-serif`
    ctx.fillText('▲ click to collapse', x + pad, y + h - pad)
  } else if (zoom < 0.5) {
    ctx.font = `500 ${10 / zoom}px Inter, sans-serif`
    ctx.fillText(text.slice(0, 30) || item.kind, x + pad, y + pad + 24 / zoom)
  } else if (zoom < 1) {
    ctx.font = `500 ${11 / zoom}px Inter, sans-serif`
    ctx.fillText(text.slice(0, 60), x + pad, y + pad + 24 / zoom)
    if (item.purpose) {
      ctx.fillStyle = txtMuted(); ctx.font = `${9 / zoom}px Inter, sans-serif`
      ctx.fillText(item.purpose.slice(0, 40), x + pad, y + pad + 40 / zoom)
    }
  } else {
    // Normal zoom: show truncated with expand hint
    wrapText(ctx, text, x + pad, y + pad + 28 / zoom, w - pad * 2, 16 / zoom, h - pad * 2 - 24 / zoom)
    // Expand hint
    ctx.fillStyle = accent()
    ctx.font = `${9 / zoom}px Inter, sans-serif`
    ctx.fillText('▼ click to expand', x + pad, y + h - pad)
    const tags = item.tags || []
    if (tags.length > 0) {
      ctx.fillStyle = txtMuted(); ctx.font = `${8 / zoom}px Inter, sans-serif`
      ctx.fillText(tags.slice(0, 3).join(', '), x + pad, y + h - pad + 14 / zoom)
    }
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
