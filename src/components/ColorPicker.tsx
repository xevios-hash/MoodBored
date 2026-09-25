import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Pipette, Shuffle, Copy, Check, Plus, Trash2 } from 'lucide-react'
import { showToast } from '@/lib/toasts'
import { useStore } from '@/stores/useStore'

interface Props {
  onClose: () => void
  initialColor?: string
}

// ─── Color Conversion Helpers ───────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// ─── Palette Generation ─────────────────────────────────────────────

function generateHarmony(baseHex: string, type: 'complementary' | 'analogous' | 'triadic' | 'split'): string[] {
  const [h, s, l] = hexToHsl(baseHex)
  switch (type) {
    case 'complementary':
      return [baseHex, hslToHex((h + 180) % 360, s, l)]
    case 'analogous':
      return [hslToHex((h - 30 + 360) % 360, s, l), baseHex, hslToHex((h + 30) % 360, s, l)]
    case 'triadic':
      return [baseHex, hslToHex((h + 120) % 360, s, l), hslToHex((h + 240) % 360, s, l)]
    case 'split':
      return [baseHex, hslToHex((h + 150) % 360, s, l), hslToHex((h + 210) % 360, s, l)]
  }
}

function generateRandomPalette(count: number): string[] {
  const baseH = Math.floor(Math.random() * 360)
  return Array.from({ length: count }, (_, i) => {
    const h = (baseH + i * (360 / count) + Math.floor(Math.random() * 30 - 15)) % 360
    const s = 50 + Math.floor(Math.random() * 40)
    const l = 40 + Math.floor(Math.random() * 30)
    return hslToHex(h, s, l)
  })
}

// ─── Canvas Color Extraction ────────────────────────────────────────

function extractDominantColors(canvasEl: HTMLCanvasElement, count: number = 5): string[] {
  const ctx = canvasEl.getContext('2d')
  if (!ctx) return []
  const w = canvasEl.width, h = canvasEl.height
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  // Sample pixels at intervals
  const step = Math.max(1, Math.floor(data.length / 4 / 1000))
  const colors: Map<string, number> = new Map()

  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue // skip transparent
    // Quantize to reduce noise
    const qr = Math.round(r / 32) * 32
    const qg = Math.round(g / 32) * 32
    const qb = Math.round(b / 32) * 32
    const key = `${qr},${qg},${qb}`
    colors.set(key, (colors.get(key) ?? 0) + 1)
  }

  // Sort by frequency and take top N
  const sorted = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, count)
  return sorted.map(([key]) => {
    const [r, g, b] = key.split(',').map(Number)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  })
}

// ─── Component ──────────────────────────────────────────────────────

export function ColorPicker({ onClose, initialColor = '#00fff0' }: Props) {
  const [hex, setHex] = useState(initialColor)
  const [palette, setPalette] = useState<string[]>([initialColor])
  const [copied, setCopied] = useState<string | null>(null)
  const addItem = useStore((s) => s.addItem)

  const handleEyedropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const dropper = new (window as any).EyeDropper()
        const result = await dropper.open()
        setHex(result.sRGBHex)
      } catch {}
    } else {
      showToast('EyeDropper not supported — use Chrome or Edge', 'info')
    }
  }

  const handleCopy = (color: string) => {
    navigator.clipboard.writeText(color)
    setCopied(color)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleGenerate = (type: 'complementary' | 'analogous' | 'triadic' | 'split' | 'random') => {
    if (type === 'random') {
      setPalette(generateRandomPalette(5))
    } else {
      setPalette(generateHarmony(hex, type))
    }
  }

  const handleExtract = () => {
    const canvasEl = document.querySelector('canvas')
    if (!canvasEl) { showToast('No canvas found', 'error'); return }
    const colors = extractDominantColors(canvasEl, 5)
    if (colors.length > 0) {
      setPalette(colors)
      showToast(`Extracted ${colors.length} colors from canvas`, 'success')
    } else {
      showToast('No colors found on canvas', 'info')
    }
  }

  const handleAddPaletteToBoard = () => {
    addItem({
      kind: 'palette', id: crypto.randomUUID(),
      label: 'Custom Palette',
      colors: palette.map(c => ({ hex: c, label: '' })),
      purpose: 'User-created', importance: '', tags: ['custom'],
      pos: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      size: { w: Math.max(200, palette.length * 60 + 40), h: 120 },
    } as any)
    showToast('Palette added to board', 'success')
  }

  const handleAddSwatch = () => {
    addItem({
      kind: 'swatch', id: crypto.randomUUID(),
      hex, name: '', usage: '',
      purpose: '', importance: '', tags: ['custom'],
      pos: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      size: { w: 160, h: 180 },
    } as any)
    showToast('Color swatch added', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[min(520px,95vw)] glass-card rounded-xl shadow-panel overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Color Picker</h2>
          <button onClick={onClose} className="btn p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Main color picker */}
          <div className="flex gap-4 items-start">
            <div className="flex flex-col items-center gap-2">
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="w-24 h-24 rounded-lg cursor-pointer border-2 border-surface-4"
              />
              <div className="flex gap-1">
                <button onClick={handleEyedropper} className="btn btn-ghost text-xs p-1" title="Pick from screen"><Pipette size={14} /></button>
                <button onClick={() => handleCopy(hex)} className="btn btn-ghost text-xs p-1" title="Copy hex">
                  {copied === hex ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
                <button onClick={handleAddSwatch} className="btn btn-accent text-xs p-1" title="Add swatch to board"><Plus size={14} /></button>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <label className="text-xs text-text-muted block mb-1">Hex</label>
                <input value={hex} onChange={(e) => setHex(e.target.value)} className="input w-full font-mono" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">HSL</label>
                <div className="flex gap-2">
                  {(() => { const [h, s, l] = hexToHsl(hex); return (
                    <>
                      <input value={h} onChange={(e) => setHex(hslToHex(Number(e.target.value), s, l))} className="input w-16 font-mono text-xs" type="number" min={0} max={360} />
                      <input value={s} onChange={(e) => setHex(hslToHex(h, Number(e.target.value), l))} className="input w-16 font-mono text-xs" type="number" min={0} max={100} />
                      <input value={l} onChange={(e) => setHex(hslToHex(h, s, Number(e.target.value)))} className="input w-16 font-mono text-xs" type="number" min={0} max={100} />
                    </>
                  )})()}
                </div>
              </div>
            </div>
          </div>

          {/* Harmony generators */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Generate Harmony</label>
            <div className="flex gap-2 flex-wrap">
              {(['complementary', 'analogous', 'triadic', 'split', 'random'] as const).map((type) => (
                <button key={type} onClick={() => handleGenerate(type)} className="btn btn-ghost text-xs capitalize">
                  {type === 'random' ? <><Shuffle size={12} className="mr-1" /> Random</> : type}
                </button>
              ))}
              <button onClick={handleExtract} className="btn btn-accent text-xs">Extract from Canvas</button>
            </div>
          </div>

          {/* Palette preview */}
          {palette.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Palette</label>
                <button onClick={handleAddPaletteToBoard} className="btn btn-primary text-xs">Add to Board</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {palette.map((color, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-surface-4 cursor-pointer hover:scale-110 transition-fast"
                      style={{ backgroundColor: color }}
                      onClick={() => handleCopy(color)}
                      title={color}
                    />
                    <span className="text-2xs font-mono text-text-muted">{color.slice(1, 7)}</span>
                  </div>
                ))}
                <button
                  onClick={() => setPalette([...palette, hex])}
                  className="w-12 h-12 rounded-lg border-2 border-dashed border-surface-4 flex items-center justify-center text-text-muted hover:text-accent hover:border-accent cursor-pointer transition-fast"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}