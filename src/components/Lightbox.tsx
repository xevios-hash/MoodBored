import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import type { BoardItem } from '@/types'

interface LightboxProps {
  item: BoardItem
  onClose: () => void
}

export function Lightbox({ item, onClose }: LightboxProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const imageUrl = item.kind === 'image' ? (item.fullSource || item.thumbnail) : ''

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.max(0.1, Math.min(10, z * delta)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true)
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
    }
  }

  const handleMouseUp = () => setDragging(false)

  if (!imageUrl) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.9)', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 10 }}>
        <button onClick={() => setZoom((z) => Math.min(10, z * 1.25))} style={ctrlBtn}><ZoomIn size={18} /></button>
        <button onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))} style={ctrlBtn}><ZoomOut size={18} /></button>
        <button onClick={onClose} style={ctrlBtn}><X size={18} /></button>
      </div>

      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', width: '100%' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt={item.kind === 'image' ? item.description : ''}
          style={{
            maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: dragging ? 'none' : 'transform 150ms ease',
          }}
          draggable={false}
        />
      </div>

      {item.kind === 'image' && (
        <div style={{ padding: '12px 24px', background: 'rgba(0,0,0,0.5)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>{item.description}</span>
          {item.tags?.length > 0 && <span style={{ color: '#6b7280', fontSize: 12 }}>{item.tags.slice(0, 5).join(', ')}</span>}
          <span style={{ color: '#6b7280', fontSize: 12 }}>{Math.round(zoom * 100)}%</span>
        </div>
      )}
    </div>
  )
}

const ctrlBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff',
  padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex',
}
