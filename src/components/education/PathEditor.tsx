import { useState, useCallback, useRef, useEffect } from 'react'
import type { Lesson, Slide, NavigationMode } from '@/types'

interface PathEditorProps {
  lesson: Lesson
  onUpdateLesson: (lesson: Lesson) => void
  onClose: () => void
}

interface SlideNode {
  id: string
  title: string
  type: string
  x: number
  y: number
  locked: boolean
}

interface SlideConnection {
  from: string
  to: string
  label?: string
  condition?: string
}

export function PathEditor({ lesson, onUpdateLesson, onClose }: PathEditorProps) {
  const [slides, setSlides] = useState<SlideNode[]>([])
  const [connections, setConnections] = useState<SlideConnection[]>([])
  const [selectedSlide, setSelectedSlide] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(lesson.navigation || 'linear')
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Initialize slides from lesson
  useEffect(() => {
    const nodes: SlideNode[] = lesson.slides.map((slide, idx) => ({
      id: slide.id,
      title: slide.title,
      type: slide.type,
      x: 100 + (idx % 3) * 280,
      y: 100 + Math.floor(idx / 3) * 180,
      locked: slide.prerequisites && slide.prerequisites.length > 0 || false,
    }))
    setSlides(nodes)

    // Extract connections from branches
    const conns: SlideConnection[] = []
    lesson.slides.forEach(slide => {
      if (slide.branch?.choices) {
        slide.branch.choices.forEach(choice => {
          conns.push({
            from: slide.id,
            to: choice.targetSlideId,
            label: choice.label,
          })
        })
      }
    })
    setConnections(conns)
  }, [lesson])

  const handleSlideMouseDown = useCallback((e: React.MouseEvent, slideId: string) => {
    e.stopPropagation()
    if (connectingFrom) {
      // Complete connection
      if (connectingFrom !== slideId) {
        setConnections(prev => [...prev, { from: connectingFrom, to: slideId }])
      }
      setConnectingFrom(null)
    } else {
      // Start drag
      const slide = slides.find(s => s.id === slideId)
      if (slide) {
        setIsDragging(true)
        setSelectedSlide(slideId)
        setDragOffset({
          x: e.clientX - slide.x,
          y: e.clientY - slide.y,
        })
      }
    }
  }, [connectingFrom, slides])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && selectedSlide) {
      setSlides(prev => prev.map(slide =>
        slide.id === selectedSlide
          ? { ...slide, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
          : slide
      ))
    }
  }, [isDragging, selectedSlide, dragOffset])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleStartConnect = useCallback((slideId: string) => {
    setConnectingFrom(slideId)
  }, [])

  const handleToggleLock = useCallback((slideId: string) => {
    setSlides(prev => prev.map(slide =>
      slide.id === slideId ? { ...slide, locked: !slide.locked } : slide
    ))
  }, [])

  const handleAddPrerequisite = useCallback((slideId: string, prereqId: string) => {
    setSlides(prev => prev.map(slide =>
      slide.id === slideId ? { ...slide, locked: true } : slide
    ))
  }, [])

  const handleSave = useCallback(() => {
    // Update lesson with new navigation data
    const updatedLesson: Lesson = {
      ...lesson,
      navigation: navigationMode,
      slides: lesson.slides.map(slide => {
        const node = slides.find(s => s.id === slide.id)
        return {
          ...slide,
          prerequisites: node?.locked ? [slides[0]?.id].filter(Boolean) : [],
        }
      }),
    }
    onUpdateLesson(updatedLesson)
    onClose()
  }, [lesson, slides, navigationMode, onUpdateLesson, onClose])

  const getSlideColor = (type: string): string => {
    switch (type) {
      case 'quiz': return '#10B981'
      case 'project': return '#F59E0B'
      case 'branch': return '#8B5CF6'
      case 'summary': return '#3B82F6'
      default: return '#6B7280'
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Path Editor</h2>
            <p className="text-sm text-gray-500">Connect slides to create learning paths</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Navigation mode selector */}
            <select
              value={navigationMode}
              onChange={(e) => setNavigationMode(e.target.value as NavigationMode)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="linear">Linear (1→2→3)</option>
              <option value="branching">Branching (choices)</option>
              <option value="free">Free Exploration</option>
              <option value="prerequisites">Prerequisites</option>
            </select>
            
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
            >
              Save Paths
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setConnectingFrom(null)}
            className={`px-3 py-1.5 rounded-lg text-sm ${connectingFrom ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}
          >
            {connectingFrom ? 'Click target slide to connect' : 'Select slide to connect'}
          </button>
          
          {connectingFrom && (
            <button
              onClick={() => setConnectingFrom(null)}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="flex-1 relative overflow-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ background: 'radial-gradient(circle, #f0f0f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      >
        {/* Connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connections.map((conn, idx) => {
            const fromSlide = slides.find(s => s.id === conn.from)
            const toSlide = slides.find(s => s.id === conn.to)
            if (!fromSlide || !toSlide) return null
            
            const x1 = fromSlide.x + 130
            const y1 = fromSlide.y + 60
            const x2 = toSlide.x + 130
            const y2 = toSlide.y + 60
            
            return (
              <g key={idx}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#8B5CF6"
                  strokeWidth="3"
                  strokeDasharray="8,4"
                  markerEnd="url(#arrowhead)"
                />
                {conn.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 8}
                    textAnchor="middle"
                    fill="#8B5CF6"
                    fontSize="12"
                    fontWeight="500"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            )
          })}
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#8B5CF6" />
            </marker>
          </defs>
        </svg>

        {/* Slide nodes */}
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute bg-white rounded-xl shadow-md border-2 cursor-move transition-shadow ${
              selectedSlide === slide.id ? 'border-purple-500 shadow-lg' : 'border-gray-200 hover:shadow-lg'
            }`}
            style={{
              left: slide.x,
              top: slide.y,
              width: 260,
            }}
            onMouseDown={(e) => handleSlideMouseDown(e, slide.id)}
          >
            {/* Slide header */}
            <div 
              className="px-4 py-2 rounded-t-xl flex items-center justify-between"
              style={{ backgroundColor: getSlideColor(slide.type) + '20', borderBottom: `2px solid ${getSlideColor(slide.type)}` }}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: getSlideColor(slide.type) }}
                >
                  {idx + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-800 text-sm">{slide.title}</div>
                  <div className="text-xs text-gray-500 capitalize">{slide.type}</div>
                </div>
              </div>
              {slide.locked && (
                <div className="text-orange-500" title="Has prerequisites">
                  🔒
                </div>
              )}
            </div>

            {/* Slide actions */}
            <div className="px-3 py-2 flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleStartConnect(slide.id) }}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium ${
                  connectingFrom === slide.id 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {connectingFrom === slide.id ? 'Click target...' : '→ Connect'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleLock(slide.id) }}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  slide.locked 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {slide.locked ? '🔒 Locked' : '🔓 Unlock'}
              </button>
            </div>
          </div>
        ))}

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-4 text-sm text-gray-600">
          <div className="font-semibold mb-2">How to use:</div>
          <ul className="space-y-1">
            <li>• <strong>Drag slides</strong> to arrange them</li>
            <li>• <strong>Click → Connect</strong> then click another slide to create a path</li>
            <li>• <strong>Click 🔒</strong> to require prerequisites</li>
            <li>• Change <strong>Navigation Mode</strong> at top</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
