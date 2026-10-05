import { useState, useEffect, useCallback } from 'react'
import type { Lesson, StudentProgress, GradeLevel } from '@/types'
import { useStudentProgress } from './ScoreTracker'

interface StudentDashboardProps {
  lessons: Lesson[]
  onOpenLesson: (lesson: Lesson) => void
  onClose: () => void
}

interface LessonStats {
  lesson: Lesson
  progress: StudentProgress
  score: number
  completion: number
  lastAccessed: string
}

export function StudentDashboard({ lessons, onOpenLesson, onClose }: StudentDashboardProps) {
  const [lessonStats, setLessonStats] = useState<LessonStats[]>([])
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed' | 'not-started'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'score' | 'completion'>('recent')

  // Load progress for all lessons
  useEffect(() => {
    const stats = lessons.map(lesson => {
      try {
        const saved = localStorage.getItem(`lesson-progress-${lesson.id}`)
        const progress: StudentProgress = saved ? JSON.parse(saved) : {
          lessonId: lesson.id,
          completedSlides: [],
          quizScores: {},
          currentSlide: '',
          timeSpent: 0,
          lastAccessed: new Date().toISOString(),
          projectSubmissions: {},
        }

        // Calculate score
        const quizSlides = lesson.slides.filter(s => s.type === 'quiz')
        const totalPoints = quizSlides.reduce((sum, s) => sum + (s.quiz?.reduce((qsum, q) => qsum + q.points, 0) || 0), 0)
        const earnedPoints = Object.values(progress.quizScores || {}).reduce((sum, s) => sum + (s > 0 ? 10 : 0), 0)
        const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

        // Calculate completion
        const completion = lesson.slides.length > 0
          ? Math.round((progress.completedSlides.length / lesson.slides.length) * 100)
          : 0

        return {
          lesson,
          progress,
          score,
          completion,
          lastAccessed: progress.lastAccessed,
        }
      } catch {
        return {
          lesson,
          progress: {
            lessonId: lesson.id,
            completedSlides: [],
            quizScores: {},
            currentSlide: '',
            timeSpent: 0,
            lastAccessed: new Date().toISOString(),
            projectSubmissions: {},
          },
          score: 0,
          completion: 0,
          lastAccessed: new Date().toISOString(),
        }
      }
    })
    setLessonStats(stats)
  }, [lessons])

  // Filter lessons
  const filteredStats = lessonStats.filter(stat => {
    switch (filter) {
      case 'in-progress':
        return stat.completion > 0 && stat.completion < 100
      case 'completed':
        return stat.completion === 100
      case 'not-started':
        return stat.completion === 0
      default:
        return true
    }
  })

  // Sort lessons
  const sortedStats = [...filteredStats].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return b.score - a.score
      case 'completion':
        return b.completion - a.completion
      case 'recent':
      default:
        return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    }
  })

  // Calculate overall stats
  const totalLessons = lessons.length
  const completedLessons = lessonStats.filter(s => s.completion === 100).length
  const inProgressLessons = lessonStats.filter(s => s.completion > 0 && s.completion < 100).length
  const averageScore = lessonStats.length > 0
    ? Math.round(lessonStats.reduce((sum, s) => sum + s.score, 0) / lessonStats.length)
    : 0

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getGradeLetter = (score: number): string => {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  return (
    <div className="fixed inset-0 z-[150] bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">📊 Learning Dashboard</h1>
              <p className="text-gray-500 mt-1">Track your progress and continue learning</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Overall Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-bold text-gray-800">{totalLessons}</div>
            <div className="text-gray-500 mt-1">Total Lessons</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-bold text-green-600">{completedLessons}</div>
            <div className="text-gray-500 mt-1">Completed</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-bold text-blue-600">{inProgressLessons}</div>
            <div className="text-gray-500 mt-1">In Progress</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className={`text-3xl font-bold ${getScoreColor(averageScore)}`}>
              {averageScore}%
            </div>
            <div className="text-gray-500 mt-1">Average Score</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(['all', 'in-progress', 'completed', 'not-started'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? 'All' : f === 'in-progress' ? 'In Progress' : f === 'completed' ? 'Completed' : 'Not Started'}
              </button>
            ))}
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="recent">Recently Accessed</option>
            <option value="score">Highest Score</option>
            <option value="completion">Most Complete</option>
          </select>
        </div>

        {/* Lesson Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedStats.map((stat) => (
            <div
              key={stat.lesson.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onOpenLesson(stat.lesson)}
            >
              {/* Lesson header */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white truncate">
                      {stat.lesson.metadata?.title || 'Untitled Lesson'}
                    </h3>
                    <p className="text-purple-100 text-sm">
                      {stat.lesson.metadata?.subject || 'General'} • {stat.lesson.metadata?.gradeLevel || 'All'}
                    </p>
                  </div>
                  <div className="text-3xl">
                    {stat.completion === 100 ? '🌟' : stat.completion > 0 ? '📚' : '🎯'}
                  </div>
                </div>
              </div>

              {/* Lesson body */}
              <div className="p-6">
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{stat.completion}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                      style={{ width: `${stat.completion}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getScoreColor(stat.score)}`}>
                      {stat.score}%
                    </div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">
                      {stat.progress.completedSlides.length}
                    </div>
                    <div className="text-xs text-gray-500">Slides</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">
                      {getGradeLetter(stat.score)}
                    </div>
                    <div className="text-xs text-gray-500">Grade</div>
                  </div>
                </div>

                {/* Action button */}
                <button
                  className="w-full py-3 rounded-xl font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenLesson(stat.lesson)
                  }}
                >
                  {stat.completion === 100 ? 'Review Lesson' : stat.completion > 0 ? 'Continue' : 'Start Lesson'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {sortedStats.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No lessons found</h3>
            <p className="text-gray-500">
              {filter === 'all' ? 'Create your first lesson to get started' : `No ${filter.replace('-', ' ')} lessons`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for managing student dashboard
export function useStudentDashboard() {
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load recent lessons from localStorage
    try {
      const saved = localStorage.getItem('moodbored-recent-lessons')
      if (saved) {
        setRecentLessons(JSON.parse(saved))
      }
    } catch (err) {
      console.warn('[useStudentDashboard] Failed to load recent lessons:', err)
    }
    setLoading(false)
  }, [])

  const addRecentLesson = useCallback((lesson: Lesson) => {
    setRecentLessons(prev => {
      const filtered = prev.filter(l => l.id !== lesson.id)
      const next = [lesson, ...filtered].slice(0, 10) // Keep last 10
      try {
        localStorage.setItem('moodbored-recent-lessons', JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  return {
    recentLessons,
    loading,
    addRecentLesson,
  }
}
