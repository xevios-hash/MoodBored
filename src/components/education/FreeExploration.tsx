import { useState, useCallback } from 'react'
import type { Lesson, Slide, BoardItem } from '@/types'
import { SlideRenderer } from './SlideRenderer'

interface FreeExplorationProps {
  lesson: Lesson
  onClose: () => void
  onScoreUpdate?: (questionId: string, score: number) => void
}

export function FreeExploration({ lesson, onClose, onScoreUpdate }: FreeExplorationProps) {
  const [currentSlideId, setCurrentSlideId] = useState<string>(lesson.slides[0]?.id || '')
  const [visitedSlides, setVisitedSlides] = useState<Set<string>>(new Set())
  const [zoomedImage, setZoomedImage] = useState<BoardItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const currentSlide = lesson.slides.find(s => s.id === currentSlideId)
  const visitedCount = visitedSlides.size
  const totalCount = lesson.slides.length

  const handleNavigate = useCallback((slideId: string) => {
    setCurrentSlideId(slideId)
    setVisitedSlides(prev => new Set([...prev, slideId]))
  }, [])

  const handleComplete = useCallback(() => {
    setVisitedSlides(prev => new Set([...prev, currentSlideId]))
  }, [currentSlideId])

  const handleZoomImage = useCallback((item: BoardItem) => {
    setZoomedImage(item)
  }, [])

  // Filter slides based on search
  const filteredSlides = lesson.slides.filter(slide => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      slide.title.toLowerCase().includes(query) ||
      slide.content.some(item => {
        const text = 'text' in item ? item.text : 'raw' in item ? item.raw : ''
        return text.toLowerCase().includes(query)
      })
    )
  })

  // Get related slides (slides connected via branches)
  const getRelatedSlides = (slideId: string): Slide[] => {
    const slide = lesson.slides.find(s => s.id === slideId)
    if (!slide?.branch?.choices) return []
    
    return slide.branch.choices
      .map(choice => lesson.slides.find(s => s.id === choice.targetSlideId))
      .filter((s): s is Slide => s !== undefined)
  }

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-b from-indigo-50 to-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">🔍 Explore: {lesson.metadata?.title}</h2>
            <p className="text-sm text-gray-500">Click any topic to learn more • {visitedCount} of {totalCount} explored</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Exit Exploration
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-72px)]">
        {/* Sidebar - Slide list */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-gray-200 focus:border-purple-500 focus:outline-none"
              />
              <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Exploration Progress</span>
                <span>{Math.round((visitedCount / totalCount) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                  style={{ width: `${(visitedCount / totalCount) * 100}%` }}
                />
              </div>
            </div>

            {/* Slide list */}
            <div className="space-y-2">
              {filteredSlides.map(slide => {
                const isVisited = visitedSlides.has(slide.id)
                const isCurrent = slide.id === currentSlideId
                
                return (
                  <button
                    key={slide.id}
                    onClick={() => handleNavigate(slide.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                      isCurrent
                        ? 'border-purple-500 bg-purple-50'
                        : isVisited
                          ? 'border-green-200 bg-green-50 hover:border-green-300'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                        isVisited ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {isVisited ? '✓' : lesson.slides.indexOf(slide) + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm truncate">{slide.title}</div>
                        <div className="text-xs text-gray-500 capitalize">{slide.type}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {currentSlide ? (
            <div className="max-w-4xl mx-auto p-8">
              <SlideRenderer
                slide={currentSlide}
                gradeLevel={lesson.metadata?.gradeLevel || '3-5'}
                onNavigate={handleNavigate}
                onComplete={handleComplete}
                onZoomImage={handleZoomImage}
                onScoreUpdate={onScoreUpdate}
              />

              {/* Related slides */}
              {getRelatedSlides(currentSlide.id).length > 0 && (
                <div className="mt-8">
                  <h3 className="font-semibold text-gray-800 mb-3">Related Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {getRelatedSlides(currentSlide.id).map(slide => (
                      <button
                        key={slide.id}
                        onClick={() => handleNavigate(slide.id)}
                        className="px-4 py-2 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        {slide.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Start Exploring!</h3>
                <p className="text-gray-600">Choose a topic from the sidebar to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoomed image modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-8"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-5xl max-h-full">
            <img 
              src={((zoomedImage as any).thumbnail || (zoomedImage as any).fullSource) as string}
              alt={((zoomedImage as any).description || 'Zoomed image') as string}
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
