import { useState, useEffect, useCallback, useRef } from 'react'
import type { Lesson, Slide, BoardItem, GradeLevel } from '@/types'
import { SlideRenderer } from './SlideRenderer'
import { NarrationEngine, useSpeech } from './NarrationEngine'

interface LessonPlayerProps {
  lesson: Lesson
  onClose: () => void
  onProgressUpdate?: (progress: { currentSlide: string; completedSlides: string[] }) => void
}

export function LessonPlayer({ lesson, onClose, onProgressUpdate }: LessonPlayerProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [completedSlides, setCompletedSlides] = useState<Set<string>>(new Set())
  const [autoPlay, setAutoPlay] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<BoardItem | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { speak, stop } = useSpeech()
  const containerRef = useRef<HTMLDivElement>(null)

  const slides = lesson.slides || []
  const currentSlide = slides[currentSlideIndex]
  const progress = slides.length > 0 ? (completedSlides.size / slides.length) * 100 : 0

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          handleNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrev()
          break
        case 'Escape':
          if (zoomedImage) {
            setZoomedImage(null)
          } else if (isFullscreen) {
            setIsFullscreen(false)
          } else {
            onClose()
          }
          break
        case 'f':
        case 'F':
          setIsFullscreen(!isFullscreen)
          break
        case 't':
        case 'T':
          setShowThumbnails(!showThumbnails)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlideIndex, zoomedImage, isFullscreen, showThumbnails])

  const handleNext = useCallback(() => {
    if (currentSlideIndex < slides.length - 1) {
      // Mark current as complete
      if (currentSlide) {
        setCompletedSlides(prev => new Set([...prev, currentSlide.id]))
      }
      setCurrentSlideIndex(prev => prev + 1)
      stop() // Stop narration when navigating
    } else {
      // Lesson complete
      if (currentSlide) {
        setCompletedSlides(prev => new Set([...prev, currentSlide.id]))
      }
      onProgressUpdate?.({ currentSlide: 'completed', completedSlides: Array.from(completedSlides) })
    }
  }, [currentSlideIndex, slides.length, currentSlide, completedSlides, stop])

  const handlePrev = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1)
      stop()
    }
  }, [currentSlideIndex, stop])

  const handleNavigate = useCallback((slideId: string) => {
    const index = slides.findIndex(s => s.id === slideId)
    if (index >= 0) {
      setCurrentSlideIndex(index)
      stop()
    }
  }, [slides, stop])

  const handleSlideComplete = useCallback(() => {
    if (currentSlide) {
      setCompletedSlides(prev => new Set([...prev, currentSlide.id]))
    }
    if (autoPlay) {
      setTimeout(() => handleNext(), 1000)
    }
  }, [currentSlide, autoPlay, handleNext])

  const handleZoomImage = useCallback((item: BoardItem) => {
    setZoomedImage(item)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  if (!currentSlide) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800 mb-4">Lesson Complete! 🎉</div>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
          >
            Back to Board
          </button>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-b from-blue-50 to-white z-[200] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back</span>
        </button>

        <div className="text-center">
          <div className="font-bold text-gray-800">{lesson.metadata?.title || 'Lesson'}</div>
          <div className="text-sm text-gray-500">
            Slide {currentSlideIndex + 1} of {slides.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-play toggle */}
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoPlay ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {autoPlay ? '⏸ Auto' : '▶ Auto'}
          </button>

          {/* Thumbnails toggle */}
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Slide thumbnails (T)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Fullscreen (F)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <SlideRenderer
          slide={currentSlide}
          gradeLevel={lesson.metadata?.gradeLevel || '3-5'}
          onNavigate={handleNavigate}
          onComplete={handleSlideComplete}
          onZoomImage={handleZoomImage}
        />
      </div>

      {/* Navigation footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white/80 backdrop-blur">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentSlideIndex === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          <div className="text-sm text-gray-500">
            {currentSlideIndex + 1} / {slides.length}
          </div>

          <button
            onClick={handleNext}
            disabled={currentSlideIndex === slides.length - 1}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Thumbnails sidebar */}
      {showThumbnails && (
        <div className="absolute right-0 top-[72px] bottom-[120px] w-64 bg-white border-l border-gray-200 shadow-lg overflow-y-auto">
          <div className="p-4">
            <div className="font-semibold text-gray-800 mb-4">Slides</div>
            <div className="space-y-2">
              {slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => handleNavigate(slide.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    idx === currentSlideIndex 
                      ? 'border-purple-500 bg-purple-50' 
                      : completedSlides.has(slide.id)
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">{idx + 1}</span>
                    <div className="flex-1 truncate text-sm">{slide.title}</div>
                    {completedSlides.has(slide.id) && <span className="text-green-500">✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-400">
        ← → Navigate · F Fullscreen · T Slides · Esc Close
      </div>
    </div>
  )
}
