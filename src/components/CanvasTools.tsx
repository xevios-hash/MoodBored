// Canvas Tools - Color Picker, Measure, Grab, Frame Capture
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/stores/useStore'
import { Pipette, Ruler, Camera, Scissors, X, Copy, Download } from 'lucide-react'
import { showToast } from '@/lib/toasts'

export type CanvasTool = 'select' | 'color-picker' | 'measure' | 'grab' | 'frame-capture'

interface CanvasToolsProps {
  activeTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
}

export function CanvasTools({ activeTool, onToolChange }: CanvasToolsProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1.5 rounded-xl glass-card shadow-lg">
      <ToolButton
        icon={<span className="text-sm">👆</span>}
        label="Select"
        active={activeTool === 'select'}
        onClick={() => onToolChange('select')}
        shortcut="V"
      />
      <ToolButton
        icon={<Pipette size={16} />}
        label="Color Picker"
        active={activeTool === 'color-picker'}
        onClick={() => onToolChange('color-picker')}
        shortcut="I"
      />
      <ToolButton
        icon={<Ruler size={16} />}
        label="Measure"
        active={activeTool === 'measure'}
        onClick={() => onToolChange('measure')}
        shortcut="M"
      />
      <ToolButton
        icon={<Scissors size={16} />}
        label="Grab"
        active={activeTool === 'grab'}
        onClick={() => onToolChange('grab')}
        shortcut="G"
      />
      <ToolButton
        icon={<Camera size={16} />}
        label="Capture"
        active={activeTool === 'frame-capture'}
        onClick={() => onToolChange('frame-capture')}
        shortcut="C"
      />
    </div>
  )
}

function ToolButton({ icon, label, active, onClick, shortcut }: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  shortcut: string
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all ${
        active
          ? 'bg-accent text-white shadow-md'
          : 'hover:bg-surface-2 text-text-muted'
      }`}
      title={`${label} (${shortcut})`}
    >
      {icon}
    </button>
  )
}

// ─── Color Picker Overlay ──────────────────────────────────────────

interface ColorPickerOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onColorPick: (color: string, x: number, y: number) => void
  onClose: () => void
}

export function ColorPickerOverlay({ canvasRef, onColorPick, onClose }: ColorPickerOverlayProps) {
  const [color, setColor] = useState('#000000')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [magnifierVisible, setMagnifierVisible] = useState(false)
  const magnifierRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(e.clientX - rect.left)
    const y = Math.floor(e.clientY - rect.top)

    // Get pixel color
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')

    setColor(hex)
    setPosition({ x: e.clientX, y: e.clientY })
    setMagnifierVisible(true)

    // Update magnifier
    if (magnifierRef.current) {
      magnifierRef.current.style.left = `${e.clientX + 16}px`
      magnifierRef.current.style.top = `${e.clientY + 16}px`
    }
  }, [canvasRef])

  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onColorPick(color, position.x, position.y)
    onClose()
  }, [color, position, onColorPick, onClose])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose()
    })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
    }
  }, [handleMouseMove, handleClick, onClose])

  return (
    <>
      {/* Crosshair cursor */}
      <style>{`* { cursor: crosshair !important; }`}</style>

      {/* Magnifier */}
      {magnifierVisible && (
        <div
          ref={magnifierRef}
          className="fixed z-[200] pointer-events-none"
          style={{ left: position.x + 16, top: position.y + 16 }}
        >
          <div className="glass-card rounded-lg p-2 shadow-lg flex items-center gap-2">
            <div
              className="w-8 h-8 rounded border-2 border-white shadow-inner"
              style={{ backgroundColor: color }}
            />
            <div>
              <div className="text-xs font-mono font-bold text-text-primary">{color}</div>
              <div className="text-2xs text-text-muted">Click to copy</div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]">
        <div className="glass-card rounded-lg px-4 py-2 shadow-lg flex items-center gap-3">
          <Pipette size={16} className="text-accent" />
          <span className="text-sm text-text-primary">Click to pick color · Esc to cancel</span>
          <div className="flex items-center gap-2 ml-4">
            <div className="w-6 h-6 rounded border border-white/20" style={{ backgroundColor: color }} />
            <span className="text-xs font-mono text-text-muted">{color}</span>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Measure Tool Overlay ──────────────────────────────────────────

interface MeasureOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onClose: () => void
}

export function MeasureOverlay({ canvasRef, onClose }: MeasureOverlayProps) {
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null)
  const [measuring, setMeasuring] = useState(false)

  const state = useStore.getState()
  const zoom = state.canvas.zoom

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0) {
      setStartPoint({ x: e.clientX, y: e.clientY })
      setEndPoint({ x: e.clientX, y: e.clientY })
      setMeasuring(true)
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (measuring) {
      setEndPoint({ x: e.clientX, y: e.clientY })
    }
  }, [measuring])

  const handleMouseUp = useCallback(() => {
    setMeasuring(false)
  }, [])

  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose()
    })

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, onClose])

  const dx = startPoint && endPoint ? (endPoint.x - startPoint.x) / zoom : 0
  const dy = startPoint && endPoint ? (endPoint.y - startPoint.y) / zoom : 0
  const distance = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)

  return (
    <>
      <style>{`* { cursor: crosshair !important; }`}</style>

      {/* Measurement line */}
      {startPoint && endPoint && (
        <svg className="fixed inset-0 z-[199] pointer-events-none" style={{ width: '100vw', height: '100vh' }}>
          <line
            x1={startPoint.x}
            y1={startPoint.y}
            x2={endPoint.x}
            y2={endPoint.y}
            stroke="#FF6B35"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
          {/* Start point */}
          <circle cx={startPoint.x} cy={startPoint.y} r="4" fill="#FF6B35" />
          {/* End point */}
          <circle cx={endPoint.x} cy={endPoint.y} r="4" fill="#FF6B35" />
        </svg>
      )}

      {/* Measurement info */}
      {startPoint && endPoint && !measuring && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{
            left: (startPoint.x + endPoint.x) / 2,
            top: (startPoint.y + endPoint.y) / 2 - 30,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="glass-card rounded-lg px-3 py-2 shadow-lg">
            <div className="text-xs font-mono font-bold text-accent">
              {distance.toFixed(1)}px
            </div>
            <div className="text-2xs text-text-muted">
              {Math.abs(dx).toFixed(0)} × {Math.abs(dy).toFixed(0)}
              {angle !== 0 && ` · ${angle.toFixed(1)}°`}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]">
        <div className="glass-card rounded-lg px-4 py-2 shadow-lg flex items-center gap-3">
          <Ruler size={16} className="text-accent" />
          <span className="text-sm text-text-primary">Click and drag to measure · Esc to cancel</span>
        </div>
      </div>
    </>
  )
}

// ─── Grab Tool (Region Select) ─────────────────────────────────────

interface GrabOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onGrab: (region: { x: number; y: number; width: number; height: number }) => void
  onClose: () => void
}

export function GrabOverlay({ canvasRef, onGrab, onClose }: GrabOverlayProps) {
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0) {
      setStartPoint({ x: e.clientX, y: e.clientY })
      setEndPoint({ x: e.clientX, y: e.clientY })
      setGrabbing(true)
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (grabbing) {
      setEndPoint({ x: e.clientX, y: e.clientY })
    }
  }, [grabbing])

  const handleMouseUp = useCallback(() => {
    if (startPoint && endPoint) {
      const x = Math.min(startPoint.x, endPoint.x)
      const y = Math.min(startPoint.y, endPoint.y)
      const width = Math.abs(endPoint.x - startPoint.x)
      const height = Math.abs(endPoint.y - startPoint.y)

      if (width > 10 && height > 10) {
        onGrab({ x, y, width, height })
      }
    }
    setGrabbing(false)
    onClose()
  }, [startPoint, endPoint, onGrab, onClose])

  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose()
    })

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, onClose])

  return (
    <>
      <style>{`* { cursor: crosshair !important; }`}</style>

      {/* Selection rectangle */}
      {startPoint && endPoint && (
        <div
          className="fixed z-[199] pointer-events-none border-2 border-accent bg-accent/10"
          style={{
            left: Math.min(startPoint.x, endPoint.x),
            top: Math.min(startPoint.y, endPoint.y),
            width: Math.abs(endPoint.x - startPoint.x),
            height: Math.abs(endPoint.y - startPoint.y),
          }}
        />
      )}

      {/* Instructions */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]">
        <div className="glass-card rounded-lg px-4 py-2 shadow-lg flex items-center gap-3">
          <Scissors size={16} className="text-accent" />
          <span className="text-sm text-text-primary">Drag to select region · Esc to cancel</span>
        </div>
      </div>
    </>
  )
}

// ─── Frame Capture Overlay ─────────────────────────────────────────

interface FrameCaptureOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onCapture: (imageData: string, region?: { x: number; y: number; width: number; height: number }) => void
  onClose: () => void
}

export function FrameCaptureOverlay({ canvasRef, onCapture, onClose }: FrameCaptureOverlayProps) {
  const [mode, setMode] = useState<'full' | 'region'>('full')
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null)
  const [capturing, setCapturing] = useState(false)

  const captureFullCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const imageData = canvas.toDataURL('image/png')
    onCapture(imageData)
    onClose()
  }, [canvasRef, onCapture, onClose])

  const captureRegion = useCallback((region: { x: number; y: number; width: number; height: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create a new canvas for the region
    const regionCanvas = document.createElement('canvas')
    regionCanvas.width = region.width
    regionCanvas.height = region.height
    const regionCtx = regionCanvas.getContext('2d')

    if (regionCtx) {
      regionCtx.drawImage(
        canvas,
        region.x, region.y, region.width, region.height,
        0, 0, region.width, region.height
      )
      const imageData = regionCanvas.toDataURL('image/png')
      onCapture(imageData, region)
    }
    onClose()
  }, [canvasRef, onCapture, onClose])

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (mode === 'region' && e.button === 0) {
      setStartPoint({ x: e.clientX, y: e.clientY })
      setEndPoint({ x: e.clientX, y: e.clientY })
      setCapturing(true)
    }
  }, [mode])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (capturing) {
      setEndPoint({ x: e.clientX, y: e.clientY })
    }
  }, [capturing])

  const handleMouseUp = useCallback(() => {
    if (startPoint && endPoint) {
      const x = Math.min(startPoint.x, endPoint.x)
      const y = Math.min(startPoint.y, endPoint.y)
      const width = Math.abs(endPoint.x - startPoint.x)
      const height = Math.abs(endPoint.y - startPoint.y)

      if (width > 10 && height > 10) {
        captureRegion({ x, y, width, height })
      }
    }
    setCapturing(false)
  }, [startPoint, endPoint, captureRegion])

  useEffect(() => {
    if (mode === 'region') {
      window.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && mode === 'full') captureFullCanvas()
    })

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [mode, handleMouseDown, handleMouseMove, handleMouseUp, onClose, captureFullCanvas])

  return (
    <>
      <style>{`* { cursor: crosshair !important; }`}</style>

      {/* Mode selection */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]">
        <div className="glass-card rounded-lg px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <Camera size={16} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">Capture Frame</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={captureFullCanvas}
              className={`px-3 py-1.5 rounded text-xs transition-all ${
                mode === 'full'
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-primary hover:bg-surface-3'
              }`}
            >
              Full Canvas
            </button>
            <button
              onClick={() => setMode('region')}
              className={`px-3 py-1.5 rounded text-xs transition-all ${
                mode === 'region'
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-text-primary hover:bg-surface-3'
              }`}
            >
              Select Region
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs bg-surface-2 text-text-muted hover:bg-surface-3"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Region selection overlay */}
      {mode === 'region' && startPoint && endPoint && (
        <div
          className="fixed z-[199] pointer-events-none border-2 border-accent bg-accent/10"
          style={{
            left: Math.min(startPoint.x, endPoint.x),
            top: Math.min(startPoint.y, endPoint.y),
            width: Math.abs(endPoint.x - startPoint.x),
            height: Math.abs(endPoint.y - startPoint.y),
          }}
        />
      )}
    </>
  )
}