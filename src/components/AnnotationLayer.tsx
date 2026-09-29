import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '@/stores/useStore'
import type { Annotation, AnnotationTool, TextAnnotation, ArrowAnnotation, BoxAnnotation, CircleAnnotation, HighlightAnnotation } from '@/types'
import { v4 as uuid } from 'uuid'

interface AnnotationLayerProps {
  itemId?: string // For card-specific annotations
  url?: string // For page-persistent annotations
  x: number
  y: number
  width: number
  height: number
  zoom: number
  scrollTop?: number
  scrollLeft?: number
  isInteractive: boolean
}

const ANNOTATION_COLORS = [
  '#ff4444', '#ff8800', '#ffcc00', '#44cc44', '#4488ff', '#8844ff', '#ff44cc', '#000000', '#ffffff',
]

const STROKE_WIDTHS = [1, 2, 3, 5, 8]

export function AnnotationLayer({ itemId, url, x, y, width, height, zoom, scrollTop = 0, scrollLeft = 0, isInteractive }: AnnotationLayerProps) {
  const annotations = useStore((s) => s.annotations)
  const activeTool = useStore((s) => s.activeAnnotationTool)
  const selectedAnnotationId = useStore((s) => s.selectedAnnotationId)
  const addAnnotation = useStore((s) => s.addAnnotation)
  const updateAnnotation = useStore((s) => s.updateAnnotation)
  const removeAnnotation = useStore((s) => s.removeAnnotation)
  const selectAnnotation = useStore((s) => s.selectAnnotation)
  const setAnnotationTool = useStore((s) => s.setAnnotationTool)

  const layerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [color, setColor] = useState('#ff4444')
  const [strokeWidth, setStrokeWidth] = useState(2)

  // Filter annotations for this layer
  const layerAnnotations = annotations.filter(a => {
    if (itemId && a.itemId === itemId) return true
    if (url && a.url === url) return true
    if (!itemId && !url && !a.itemId && !a.url) return true // Free-floating
    return false
  })

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (e.clientX - rect.left) / zoom + scrollLeft,
      y: (e.clientY - rect.top) / zoom + scrollTop,
    }
  }, [zoom, scrollTop, scrollLeft])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isInteractive) return
    if (activeTool === 'select' || activeTool === 'pan') return

    e.stopPropagation()
    e.preventDefault()

    const pos = getRelativePos(e)
    setDrawStart(pos)
    setDrawEnd(pos)
    setIsDrawing(true)
  }, [isInteractive, activeTool, getRelativePos])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return
    const pos = getRelativePos(e)
    setDrawEnd(pos)
  }, [isDrawing, getRelativePos])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !drawStart || !drawEnd) return

    const pos = getRelativePos(e)
    const dx = Math.abs(pos.x - drawStart.x)
    const dy = Math.abs(pos.y - drawStart.y)

    // Minimum size for shapes
    if ((activeTool === 'box' || activeTool === 'circle' || activeTool === 'highlight') && (dx < 5 || dy < 5)) {
      setIsDrawing(false)
      setDrawStart(null)
      setDrawEnd(null)
      return
    }

    let newAnnotation: Annotation | null = null

    switch (activeTool) {
      case 'text': {
        newAnnotation = {
          id: uuid(),
          type: 'text',
          x: drawStart.x,
          y: drawStart.y,
          text: 'Double-click to edit',
          fontSize: 16,
          fontWeight: 500,
          color,
          strokeWidth,
          opacity: 1,
          itemId,
          url,
          scrollTop,
          scrollLeft,
          created: new Date().toISOString(),
        } as TextAnnotation
        break
      }
      case 'arrow': {
        newAnnotation = {
          id: uuid(),
          type: 'arrow',
          x: drawStart.x,
          y: drawStart.y,
          x2: pos.x,
          y2: pos.y,
          arrowHead: 'arrow',
          color,
          strokeWidth,
          opacity: 1,
          itemId,
          url,
          scrollTop,
          scrollLeft,
          created: new Date().toISOString(),
        } as ArrowAnnotation
        break
      }
      case 'box': {
        newAnnotation = {
          id: uuid(),
          type: 'box',
          x: Math.min(drawStart.x, pos.x),
          y: Math.min(drawStart.y, pos.y),
          width: dx,
          height: dy,
          fill: false,
          cornerRadius: 4,
          color,
          strokeWidth,
          opacity: 1,
          itemId,
          url,
          scrollTop,
          scrollLeft,
          created: new Date().toISOString(),
        } as BoxAnnotation
        break
      }
      case 'circle': {
        newAnnotation = {
          id: uuid(),
          type: 'circle',
          x: drawStart.x,
          y: drawStart.y,
          radiusX: dx / 2,
          radiusY: dy / 2,
          fill: false,
          color,
          strokeWidth,
          opacity: 1,
          itemId,
          url,
          scrollTop,
          scrollLeft,
          created: new Date().toISOString(),
        } as CircleAnnotation
        break
      }
      case 'highlight': {
        newAnnotation = {
          id: uuid(),
          type: 'highlight',
          x: Math.min(drawStart.x, pos.x),
          y: Math.min(drawStart.y, pos.y),
          width: dx,
          height: dy,
          color: '#ffff00',
          strokeWidth: 0,
          opacity: 0.3,
          itemId,
          url,
          scrollTop,
          scrollLeft,
          created: new Date().toISOString(),
        } as HighlightAnnotation
        break
      }
    }

    if (newAnnotation) {
      addAnnotation(newAnnotation)
      // Switch back to select after drawing
      setAnnotationTool('select')
    }

    setIsDrawing(false)
    setDrawStart(null)
    setDrawEnd(null)
  }, [isDrawing, drawStart, drawEnd, activeTool, color, strokeWidth, itemId, url, scrollTop, scrollLeft, addAnnotation, setAnnotationTool, getRelativePos])

  const handleAnnotationClick = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    e.stopPropagation()
    if (activeTool === 'select') {
      selectAnnotation(annotation.id)
    }
  }, [activeTool, selectAnnotation])

  const handleAnnotationDoubleClick = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    e.stopPropagation()
    if (annotation.type === 'text') {
      setEditingTextId(annotation.id)
    }
  }, [])

  const handleAnnotationDrag = useCallback((e: React.MouseEvent, annotation: Annotation) => {
    if (activeTool !== 'select') return
    e.stopPropagation()
    e.preventDefault()

    const startX = e.clientX
    const startY = e.clientY
    const startPos = { x: annotation.x, y: annotation.y }

    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - startX) / zoom
      const dy = (e.clientY - startY) / zoom
      updateAnnotation(annotation.id, {
        x: startPos.x + dx,
        y: startPos.y + dy,
      })
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [activeTool, zoom, updateAnnotation])

  const renderAnnotation = (annotation: Annotation) => {
    const isSelected = selectedAnnotationId === annotation.id
    const isEditing = editingTextId === annotation.id

    // Adjust position for scroll
    const adjX = (annotation.x - (annotation.scrollLeft || 0)) * zoom
    const adjY = (annotation.y - (annotation.scrollTop || 0)) * zoom

    switch (annotation.type) {
      case 'text': {
        const text = annotation as TextAnnotation
        return (
          <div
            key={annotation.id}
            style={{
              position: 'absolute',
              left: adjX,
              top: adjY,
              cursor: activeTool === 'select' ? 'move' : 'default',
              userSelect: 'none',
              outline: isSelected ? '2px dashed #6a5aae' : 'none',
              outlineOffset: 2,
            }}
            onClick={(e) => handleAnnotationClick(e, annotation)}
            onDoubleClick={(e) => handleAnnotationDoubleClick(e, annotation)}
            onMouseDown={(e) => handleAnnotationDrag(e, annotation)}
          >
            {isEditing ? (
              <textarea
                autoFocus
                defaultValue={text.text}
                onBlur={(e) => {
                  updateAnnotation(annotation.id, { text: e.target.value } as any)
                  setEditingTextId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                    e.preventDefault()
                    e.stopPropagation()
                    updateAnnotation(annotation.id, { text: (e.target as HTMLTextAreaElement).value } as any)
                    setEditingTextId(null)
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  border: `2px solid ${annotation.color}`,
                  borderRadius: 4,
                  padding: 4,
                  fontSize: text.fontSize * zoom,
                  fontWeight: text.fontWeight,
                  color: annotation.color,
                  minWidth: 100,
                  minHeight: 30,
                  resize: 'both',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: text.fontSize * zoom,
                  fontWeight: text.fontWeight,
                  color: annotation.color,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Inter, sans-serif',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                {text.text}
              </div>
            )}
          </div>
        )
      }
      case 'arrow': {
        const arrow = annotation as ArrowAnnotation
        const x2 = (arrow.x2 - (arrow.scrollLeft || 0)) * zoom
        const y2 = (arrow.y2 - (arrow.scrollTop || 0)) * zoom
        return (
          <svg
            key={annotation.id}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: activeTool === 'select' ? 'auto' : 'none',
            }}
            onClick={(e) => handleAnnotationClick(e, annotation)}
          >
            <defs>
              <marker
                id={`arrowhead-${annotation.id}`}
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={annotation.color}
                />
              </marker>
            </defs>
            <line
              x1={adjX}
              y1={adjY}
              x2={x2}
              y2={y2}
              stroke={annotation.color}
              strokeWidth={annotation.strokeWidth * zoom}
              markerEnd={arrow.arrowHead === 'arrow' ? `url(#arrowhead-${annotation.id})` : undefined}
              opacity={annotation.opacity}
              style={{ cursor: 'pointer' }}
            />
            {isSelected && (
              <>
                <circle cx={adjX} cy={adjY} r={5} fill="#6a5aae" />
                <circle cx={x2} cy={y2} r={5} fill="#6a5aae" />
              </>
            )}
          </svg>
        )
      }
      case 'box': {
        const box = annotation as BoxAnnotation
        return (
          <svg
            key={annotation.id}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: activeTool === 'select' ? 'auto' : 'none',
            }}
            onClick={(e) => handleAnnotationClick(e, annotation)}
          >
            <rect
              x={adjX}
              y={adjY}
              width={box.width * zoom}
              height={box.height * zoom}
              fill={box.fill ? (box.fillColor || annotation.color) : 'none'}
              fillOpacity={box.fill ? 0.2 : 0}
              stroke={annotation.color}
              strokeWidth={annotation.strokeWidth * zoom}
              rx={box.cornerRadius * zoom}
              opacity={annotation.opacity}
              style={{ cursor: 'pointer' }}
            />
          </svg>
        )
      }
      case 'circle': {
        const circle = annotation as CircleAnnotation
        return (
          <svg
            key={annotation.id}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: activeTool === 'select' ? 'auto' : 'none',
            }}
            onClick={(e) => handleAnnotationClick(e, annotation)}
          >
            <ellipse
              cx={adjX + circle.radiusX * zoom}
              cy={adjY + circle.radiusY * zoom}
              rx={circle.radiusX * zoom}
              ry={circle.radiusY * zoom}
              fill={circle.fill ? (circle.fillColor || annotation.color) : 'none'}
              fillOpacity={circle.fill ? 0.2 : 0}
              stroke={annotation.color}
              strokeWidth={annotation.strokeWidth * zoom}
              opacity={annotation.opacity}
              style={{ cursor: 'pointer' }}
            />
          </svg>
        )
      }
      case 'highlight': {
        const highlight = annotation as HighlightAnnotation
        return (
          <div
            key={annotation.id}
            style={{
              position: 'absolute',
              left: adjX,
              top: adjY,
              width: highlight.width * zoom,
              height: highlight.height * zoom,
              background: annotation.color,
              opacity: annotation.opacity,
              cursor: activeTool === 'select' ? 'move' : 'default',
              borderRadius: 2,
            }}
            onClick={(e) => handleAnnotationClick(e, annotation)}
            onMouseDown={(e) => handleAnnotationDrag(e, annotation)}
          />
        )
      }
      default:
        return null
    }
  }

  return (
    <>
      {/* Annotation layer - captures drawing events */}
      <div
        ref={layerRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: isInteractive && activeTool !== 'select' && activeTool !== 'pan' ? 'auto' : 'none',
          cursor: activeTool !== 'select' && activeTool !== 'pan' ? 'crosshair' : 'default',
          zIndex: 100,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Render all annotations */}
        {layerAnnotations.map(renderAnnotation)}

        {/* Drawing preview */}
        {isDrawing && drawStart && drawEnd && (
          <svg
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            {activeTool === 'arrow' && (
              <line
                x1={drawStart.x * zoom - scrollLeft * zoom}
                y1={drawStart.y * zoom - scrollTop * zoom}
                x2={drawEnd.x * zoom - scrollLeft * zoom}
                y2={drawEnd.y * zoom - scrollTop * zoom}
                stroke={color}
                strokeWidth={strokeWidth * zoom}
                strokeDasharray="5,5"
                opacity={0.7}
              />
            )}
            {activeTool === 'box' && (
              <rect
                x={Math.min(drawStart.x, drawEnd.x) * zoom - scrollLeft * zoom}
                y={Math.min(drawStart.y, drawEnd.y) * zoom - scrollTop * zoom}
                width={Math.abs(drawEnd.x - drawStart.x) * zoom}
                height={Math.abs(drawEnd.y - drawStart.y) * zoom}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth * zoom}
                strokeDasharray="5,5"
                opacity={0.7}
              />
            )}
            {activeTool === 'circle' && (
              <ellipse
                cx={(drawStart.x + drawEnd.x) / 2 * zoom - scrollLeft * zoom}
                cy={(drawStart.y + drawEnd.y) / 2 * zoom - scrollTop * zoom}
                rx={Math.abs(drawEnd.x - drawStart.x) / 2 * zoom}
                ry={Math.abs(drawEnd.y - drawStart.y) / 2 * zoom}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth * zoom}
                strokeDasharray="5,5"
                opacity={0.7}
              />
            )}
            {activeTool === 'highlight' && (
              <rect
                x={Math.min(drawStart.x, drawEnd.x) * zoom - scrollLeft * zoom}
                y={Math.min(drawStart.y, drawEnd.y) * zoom - scrollTop * zoom}
                width={Math.abs(drawEnd.x - drawStart.x) * zoom}
                height={Math.abs(drawEnd.y - drawStart.y) * zoom}
                fill="#ffff00"
                opacity={0.3}
              />
            )}
          </svg>
        )}
      </div>

      {/* Annotation toolbar - floating at bottom center */}
      {isInteractive && (
        <AnnotationToolbar
          activeTool={activeTool}
          color={color}
          strokeWidth={strokeWidth}
          onToolChange={setAnnotationTool}
          onColorChange={setColor}
          onStrokeWidthChange={setStrokeWidth}
          onDelete={() => {
            if (selectedAnnotationId) {
              removeAnnotation(selectedAnnotationId)
            }
          }}
          hasSelection={!!selectedAnnotationId}
        />
      )}
    </>
  )
}

// ─── Annotation Toolbar ──────────────────────────────────────────────

interface AnnotationToolbarProps {
  activeTool: AnnotationTool
  color: string
  strokeWidth: number
  onToolChange: (tool: AnnotationTool) => void
  onColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onDelete: () => void
  hasSelection: boolean
}

function AnnotationToolbar({ activeTool, color, strokeWidth, onToolChange, onColorChange, onStrokeWidthChange, onDelete, hasSelection }: AnnotationToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)

  const tools: { tool: AnnotationTool; icon: string; label: string }[] = [
    { tool: 'select', icon: '⊹', label: 'Select' },
    { tool: 'text', icon: 'T', label: 'Text' },
    { tool: 'arrow', icon: '→', label: 'Arrow' },
    { tool: 'box', icon: '□', label: 'Box' },
    { tool: 'circle', icon: '○', label: 'Circle' },
    { tool: 'highlight', icon: '▭', label: 'Highlight' },
  ]

  return (
    <div
      className="absolute"
      style={{
        bottom: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.95)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: '1px solid rgba(0,0,0,0.1)',
        zIndex: 200,
      }}
    >
      {tools.map(({ tool, icon, label }) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          title={label}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: 'none',
            background: activeTool === tool ? '#6a5aae' : 'transparent',
            color: activeTool === tool ? 'white' : '#333',
            cursor: 'pointer',
            fontSize: tool === 'text' ? 14 : 16,
            fontWeight: tool === 'text' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {icon}
        </button>
      ))}

      <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

      {/* Color picker */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '2px solid rgba(0,0,0,0.1)',
            background: color,
            cursor: 'pointer',
          }}
        />
        {showColorPicker && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 8,
              padding: 8,
              borderRadius: 8,
              background: 'white',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              width: 120,
            }}
          >
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onColorChange(c)
                  setShowColorPicker(false)
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: c === color ? '2px solid #6a5aae' : '1px solid rgba(0,0,0,0.1)',
                  background: c,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stroke width */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => onStrokeWidthChange(w)}
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: 'none',
              background: strokeWidth === w ? 'rgba(106,90,174,0.2)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: Math.min(w * 2, 14),
                height: Math.min(w * 2, 14),
                borderRadius: '50%',
                background: '#333',
              }}
            />
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={!hasSelection}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: 'none',
          background: hasSelection ? 'rgba(255,68,68,0.1)' : 'transparent',
          color: hasSelection ? '#ff4444' : '#ccc',
          cursor: hasSelection ? 'pointer' : 'default',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🗑
      </button>
    </div>
  )
}