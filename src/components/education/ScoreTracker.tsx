import { useState, useEffect, useCallback } from 'react'
import type { Lesson, StudentProgress, QuizQuestion } from '@/types'

interface ScoreTrackerProps {
  lesson: Lesson
  studentProgress: StudentProgress
  onProgressUpdate?: (progress: Partial<StudentProgress>) => void
}

export function ScoreTracker({ lesson, studentProgress, onProgressUpdate }: ScoreTrackerProps) {
  const [quizScores, setQuizScores] = useState<Record<string, number>>(studentProgress.quizScores || {})
  const [completedSlides, setCompletedSlides] = useState<Set<string>>(
    new Set(studentProgress.completedSlides || [])
  )

  // Calculate overall score
  const calculateOverallScore = useCallback(() => {
    const quizSlides = lesson.slides.filter(s => s.type === 'quiz')
    if (quizSlides.length === 0) return 0

    let totalPoints = 0
    let earnedPoints = 0

    quizSlides.forEach(slide => {
      slide.quiz?.forEach(q => {
        totalPoints += q.points
        earnedPoints += quizScores[q.id] || 0
      })
    })

    return totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  }, [lesson.slides, quizScores])

  // Calculate completion percentage
  const calculateCompletion = useCallback(() => {
    return lesson.slides.length > 0 
      ? Math.round((completedSlides.size / lesson.slides.length) * 100)
      : 0
  }, [completedSlides, lesson.slides.length])

  // Get grade letter
  const getGradeLetter = (score: number): string => {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  // Get color for score
  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const overallScore = calculateOverallScore()
  const completion = calculateCompletion()
  const gradeLetter = getGradeLetter(overallScore)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
          <span className="text-2xl">📊</span>
        </div>
        <div>
          <div className="font-bold text-gray-800">Progress & Score</div>
          <div className="text-sm text-gray-500">{lesson.metadata?.title}</div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Completion */}
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className="text-3xl font-bold text-gray-800">{completion}%</div>
          <div className="text-sm text-gray-500">Complete</div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Score */}
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}%
          </div>
          <div className="text-sm text-gray-500">Quiz Score</div>
          <div className="mt-2 text-2xl">{gradeLetter}</div>
        </div>

        {/* Slides */}
        <div className="text-center p-4 bg-gray-50 rounded-xl">
          <div className="text-3xl font-bold text-gray-800">
            {completedSlides.size}/{lesson.slides.length}
          </div>
          <div className="text-sm text-gray-500">Slides</div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="space-y-3">
        <div className="font-semibold text-gray-700 mb-2">Quiz Breakdown</div>
        
        {lesson.slides
          .filter(s => s.type === 'quiz')
          .map((slide, idx) => (
            <div key={slide.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium text-gray-700">{slide.title}</div>
                <div className="text-sm text-gray-500">
                  {slide.quiz?.filter(q => quizScores[q.id] > 0).length || 0} / {slide.quiz?.length || 0}
                </div>
              </div>
              <div className="flex gap-1">
                {slide.quiz?.map(q => (
                  <div
                    key={q.id}
                    className={`h-2 flex-1 rounded-full ${
                      quizScores[q.id] > 0 ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={quizScores[q.id] > 0 ? 'Correct' : 'Not answered'}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Recommendations */}
      {overallScore < 70 && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
          <div className="flex items-start gap-2">
            <span className="text-xl">💡</span>
            <div>
              <div className="font-medium text-yellow-800">Keep practicing!</div>
              <div className="text-sm text-yellow-700 mt-1">
                Review the slides where you missed questions to improve your score.
              </div>
            </div>
          </div>
        </div>
      )}

      {overallScore >= 90 && (
        <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-start gap-2">
            <span className="text-xl">🌟</span>
            <div>
              <div className="font-medium text-green-800">Excellent work!</div>
              <div className="text-sm text-green-700 mt-1">
                You've mastered this lesson. Try a more challenging topic next!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for managing student progress
export function useStudentProgress(lessonId: string) {
  const [progress, setProgress] = useState<StudentProgress>({
    lessonId,
    completedSlides: [],
    quizScores: {},
    currentSlide: '',
    timeSpent: 0,
    lastAccessed: new Date().toISOString(),
    projectSubmissions: {},
  })

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lesson-progress-${lessonId}`)
      if (saved) {
        setProgress(JSON.parse(saved))
      }
    } catch (err) {
      console.warn('[useStudentProgress] Failed to load progress:', err)
    }
  }, [lessonId])

  // Save to localStorage
  const saveProgress = useCallback((updates: Partial<StudentProgress>) => {
    setProgress(prev => {
      const next = { ...prev, ...updates, lastAccessed: new Date().toISOString() }
      try {
        localStorage.setItem(`lesson-progress-${lessonId}`, JSON.stringify(next))
      } catch (err) {
        console.warn('[useStudentProgress] Failed to save progress:', err)
      }
      return next
    })
  }, [lessonId])

  const markSlideComplete = useCallback((slideId: string) => {
    setProgress(prev => {
      const completed = new Set(prev.completedSlides)
      completed.add(slideId)
      const next = { ...prev, completedSlides: Array.from(completed), lastAccessed: new Date().toISOString() }
      try {
        localStorage.setItem(`lesson-progress-${lessonId}`, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [lessonId])

  const recordQuizScore = useCallback((questionId: string, score: number) => {
    setProgress(prev => {
      const next = { 
        ...prev, 
        quizScores: { ...prev.quizScores, [questionId]: score },
        lastAccessed: new Date().toISOString() 
      }
      try {
        localStorage.setItem(`lesson-progress-${lessonId}`, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [lessonId])

  return {
    progress,
    saveProgress,
    markSlideComplete,
    recordQuizScore,
  }
}
