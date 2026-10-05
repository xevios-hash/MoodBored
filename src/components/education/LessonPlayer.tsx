import { useState, useEffect, useCallback, useRef } from 'react'
import type { Lesson, Slide, BoardItem, GradeLevel } from '@/types'
import { SlideRenderer } from './SlideRenderer'
import { NarrationEngine, useSpeech } from './NarrationEngine'
import { ScoreTracker, useStudentProgress } from './ScoreTracker'
import { FreeExploration } from './FreeExploration'
import { PathEditor } from './PathEditor'

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
  const [showScore, setShowScore] = useState(false)
  const [showExploration, setShowExploration] = useState(false)
  const [showPathEditor, setShowPathEditor] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<BoardItem | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { speak, stop } = useSpeech()
  const { progress: studentProgress, markSlideComplete, recordQuizScore } = useStudentProgress(lesson.id)
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
          setShowScore(false)
          break
        case 's':
        case 'S':
          setShowScore(!showScore)
          setShowThumbnails(false)
          break
        case 'e':
        case 'E':
          setShowExploration(true)
          break
        case 'p':
        case 'P':
          setShowPathEditor(true)
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
            onClick={() => { setShowThumbnails(!showThumbnails); setShowScore(false) }}
            className={`p-2 rounded-lg transition-colors ${showThumbnails ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}
            title="Slide thumbnails (T)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>

          {/* Free Exploration toggle */}
          <button
            onClick={() => setShowExploration(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Free Exploration (E)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          {/* Path Editor toggle */}
          <button
            onClick={() => setShowPathEditor(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Edit Paths (P)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>

          {/* Score tracker toggle */}
          <button
            onClick={() => { setShowScore(!showScore); setShowThumbnails(false) }}
            className={`p-2 rounded-lg transition-colors ${showScore ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}
            title="Progress & Score (S)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6" />
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
          onScoreUpdate={(questionId, score) => {
            recordQuizScore(questionId, score)
          }}
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

      {/* Score tracker sidebar */}
      {showScore && (
        <div className="absolute right-0 top-[72px] bottom-[120px] w-80 bg-white border-l border-gray-200 shadow-lg overflow-y-auto">
          <div className="p-4">
            <ScoreTracker
              lesson={lesson}
              studentProgress={studentProgress}
            />
          </div>
        </div>
      )}

      {/* Free Exploration mode */}
      {showExploration && (
        <FreeExploration
          lesson={lesson}
          onClose={() => setShowExploration(false)}
          onScoreUpdate={(questionId, score) => recordQuizScore(questionId, score)}
        />
      )}

      {/* Path Editor */}
      {showPathEditor && (
        <PathEditor
          lesson={lesson}
          onUpdateLesson={() => {}}
          onClose={() => setShowPathEditor(false)}
        />
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
