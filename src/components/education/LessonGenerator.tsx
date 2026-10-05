import { useState } from 'react'
import type { GradeLevel, Lesson } from '@/types'
import { generateLesson } from '@/lib/lessonGenerator'
import { useStore } from '@/stores/useStore'

interface LessonGeneratorProps {
  onClose: () => void
  onGenerated?: (lesson: Lesson) => void
}

const GRADE_LEVELS: { value: GradeLevel; label: string; ages: string }[] = [
  { value: 'K-2', label: 'Kindergarten - 2nd Grade', ages: 'Ages 5-8' },
  { value: '3-5', label: '3rd - 5th Grade', ages: 'Ages 8-11' },
  { value: '6-8', label: '6th - 8th Grade', ages: 'Ages 11-14' },
  { value: '9-12', label: '9th - 12th Grade', ages: 'Ages 14-18' },
  { value: 'adult', label: 'College / Adult', ages: 'Professional level' },
]

const SUBJECTS = [
  'Science', 'Math', 'History', 'English', 'Geography', 'Art', 'Music', 'Technology', 'Other'
]

export function LessonGenerator({ onClose, onGenerated }: LessonGeneratorProps) {
  const [topic, setTopic] = useState('')
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('3-5')
  const [subject, setSubject] = useState('Science')
  const [slideCount, setSlideCount] = useState(8)
  const [includeQuizzes, setIncludeQuizzes] = useState(true)
  const [includeProject, setIncludeProject] = useState(false)
  const [includeBranches, setIncludeBranches] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enterLessonMode = useStore((s) => s.enterLessonMode)

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const lesson = await generateLesson({
        topic: topic.trim(),
        gradeLevel,
        slideCount,
        includeQuizzes,
        includeProject,
        includeBranches,
        subject,
      })

      if (lesson) {
        enterLessonMode(lesson)
        onGenerated?.(lesson)
        onClose()
      } else {
        setError('Failed to generate lesson. Please try again.')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Create a Lesson</h2>
            <p className="text-xs text-text-muted mt-0.5">AI will generate interactive slides with narration</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-2 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              What should we learn about?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The Solar System, Photosynthesis, Ancient Egypt..."
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-surface-0 text-text-primary focus:border-accent focus:outline-none"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
            />
          </div>

          {/* Grade Level */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Grade Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GRADE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setGradeLevel(level.value)}
                  className={`px-3 py-2 rounded-lg border-2 text-left transition-colors ${
                    gradeLevel === level.value
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  <div className="text-sm font-medium text-text-primary">{level.label}</div>
                  <div className="text-xs text-text-muted">{level.ages}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Subject
            </label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    subject === s
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Slide Count */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Number of Slides: {slideCount}
            </label>
            <input
              type="range"
              min={4}
              max={15}
              value={slideCount}
              onChange={(e) => setSlideCount(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-text-muted">
              <span>4 (Quick)</span>
              <span>15 (Detailed)</span>
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Lesson Features
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeQuizzes}
                  onChange={(e) => setIncludeQuizzes(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <div>
                  <div className="text-sm text-text-primary">Include quizzes</div>
                  <div className="text-xs text-text-muted">Interactive questions to check understanding</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProject}
                  onChange={(e) => setIncludeProject(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <div>
                  <div className="text-sm text-text-primary">Include project</div>
                  <div className="text-xs text-text-muted">Hands-on activity for practice</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBranches}
                  onChange={(e) => setIncludeBranches(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <div>
                  <div className="text-sm text-text-primary">Include branching paths</div>
                  <div className="text-xs text-text-muted">Let learners choose what to explore</div>
                </div>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className="w-full py-3 rounded-xl font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating lesson...
              </span>
            ) : (
              'Generate Lesson'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
