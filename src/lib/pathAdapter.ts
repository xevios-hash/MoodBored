import type { Lesson, Slide, StudentProgress, QuizQuestion } from '@/types'

interface PathRecommendation {
  type: 'review' | 'skip' | 'advance' | 'remediate' | 'challenge'
  slideId: string
  reason: string
  confidence: number
}

interface AdaptedPath {
  slides: Slide[]
  recommendations: PathRecommendation[]
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedTime: number
}

// Analyze student performance and adapt the learning path
export function adaptPath(
  lesson: Lesson,
  progress: StudentProgress
): AdaptedPath {
  const recommendations: PathRecommendation[] = []
  const quizScores = progress.quizScores || {}
  const completedSlides = new Set(progress.completedSlides || [])
  
  // Calculate performance metrics
  const quizSlides = lesson.slides.filter(s => s.type === 'quiz')
  const totalQuestions = quizSlides.reduce((sum, s) => sum + (s.quiz?.length || 0), 0)
  const correctAnswers = Object.values(quizScores).filter(score => score > 0).length
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0

  // Determine difficulty level
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  if (accuracy >= 0.8) difficulty = 'hard'
  else if (accuracy >= 0.6) difficulty = 'medium'
  else difficulty = 'easy'

  // Generate recommendations for each slide
  lesson.slides.forEach(slide => {
    const isCompleted = completedSlides.has(slide.id)
    const slideQuizScores = slide.quiz?.map(q => quizScores[q.id]).filter(Boolean) || []
    const slideAccuracy = slideQuizScores.length > 0 
      ? slideQuizScores.filter(s => s > 0).length / slideQuizScores.length 
      : 1

    if (slide.type === 'quiz') {
      if (slideAccuracy < 0.5) {
        recommendations.push({
          type: 'review',
          slideId: slide.id,
          reason: 'You missed several questions here — review the material',
          confidence: 0.9,
        })
      } else if (slideAccuracy >= 0.8 && isCompleted) {
        recommendations.push({
          type: 'advance',
          slideId: slide.id,
          reason: 'Great job! You can move on to more advanced topics',
          confidence: 0.85,
        })
      }
    }

    if (slide.type === 'concept' && !isCompleted) {
      if (difficulty === 'easy') {
        recommendations.push({
          type: 'advance',
          slideId: slide.id,
          reason: 'Start here for a gentle introduction',
          confidence: 0.7,
        })
      }
    }

    if (slide.type === 'project') {
      if (accuracy < 0.6) {
        recommendations.push({
          type: 'remediate',
          slideId: slide.id,
          reason: 'Practice more before attempting this project',
          confidence: 0.8,
        })
      }
    }
  })

  // Reorder slides based on difficulty and performance
  let adaptedSlides = [...lesson.slides]
  
  if (difficulty === 'easy') {
    // Put concept slides first, quizzes later
    adaptedSlides.sort((a, b) => {
      const typeOrder = { concept: 0, detail: 1, quiz: 2, project: 3, summary: 4, branch: 5 }
      return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0)
    })
  } else if (difficulty === 'hard') {
    // Mix quizzes early to test understanding
    adaptedSlides.sort((a, b) => {
      const typeOrder = { quiz: 0, concept: 1, detail: 2, project: 3, branch: 4, summary: 5 }
      return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0)
    })
  }

  // Estimate time based on difficulty
  const baseTimePerSlide = difficulty === 'easy' ? 120 : difficulty === 'medium' ? 90 : 60
  const estimatedTime = adaptedSlides.length * baseTimePerSlide

  return {
    slides: adaptedSlides,
    recommendations,
    difficulty,
    estimatedTime,
  }
}

// Get next recommended slide
export function getNextRecommendedSlide(
  lesson: Lesson,
  progress: StudentProgress,
  currentSlideId: string
): Slide | null {
  const adapted = adaptPath(lesson, progress)
  const currentIndex = adapted.slides.findIndex(s => s.id === currentSlideId)
  
  if (currentIndex === -1) return null
  
  // Find next slide that's not completed and has no unmet prerequisites
  for (let i = currentIndex + 1; i < adapted.slides.length; i++) {
    const slide = adapted.slides[i]
    const isCompleted = progress.completedSlides?.includes(slide.id)
    const prereqs = slide.prerequisites || []
    const prereqsMet = prereqs.every(p => progress.completedSlides?.includes(p))
    
    if (!isCompleted && prereqsMet) {
      return slide
    }
  }
  
  return null
}

// Check if a slide is unlocked
export function isSlideUnlocked(
  slide: Slide,
  progress: StudentProgress
): boolean {
  const prereqs = slide.prerequisites || []
  return prereqs.every(p => progress.completedSlides?.includes(p))
}

// Get learning path visualization
export function getPathVisualization(lesson: Lesson): {
  nodes: { id: string; label: string; type: string }[]
  edges: { from: string; to: string; label?: string }[]
} {
  const nodes = lesson.slides.map(slide => ({
    id: slide.id,
    label: slide.title,
    type: slide.type,
  }))

  const edges: { from: string; to: string; label?: string }[] = []
  
  // Linear connections
  for (let i = 0; i < lesson.slides.length - 1; i++) {
    if (lesson.navigation === 'linear') {
      edges.push({
        from: lesson.slides[i].id,
        to: lesson.slides[i + 1].id,
      })
    }
  }

  // Branch connections
  lesson.slides.forEach(slide => {
    if (slide.branch?.choices) {
      slide.branch.choices.forEach(choice => {
        edges.push({
          from: slide.id,
          to: choice.targetSlideId,
          label: choice.label,
        })
      })
    }
  })

  return { nodes, edges }
}

// Calculate learning effectiveness score
export function calculateLearningEffectiveness(
  lesson: Lesson,
  progress: StudentProgress
): {
  score: number
  strengths: string[]
  improvements: string[]
} {
  const strengths: string[] = []
  const improvements: string[] = []
  
  const quizScores = progress.quizScores || {}
  const totalQuestions = lesson.slides
    .filter(s => s.type === 'quiz')
    .reduce((sum, s) => sum + (s.quiz?.length || 0), 0)
  const correctAnswers = Object.values(quizScores).filter(s => s > 0).length
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0

  // Analyze strengths
  if (accuracy >= 0.8) {
    strengths.push('Excellent quiz performance')
  }
  if (progress.completedSlides?.length >= lesson.slides.length * 0.8) {
    strengths.push('High completion rate')
  }
  if (progress.timeSpent > lesson.slides.length * 60) {
    strengths.push('Thorough engagement with material')
  }

  // Analyze improvements
  if (accuracy < 0.6) {
    improvements.push('Review quiz material more carefully')
  }
  if (progress.completedSlides?.length < lesson.slides.length * 0.5) {
    improvements.push('Try to complete more slides')
  }
  if (lesson.slides.some(s => s.type === 'project') && !Object.keys(progress.projectSubmissions || {}).length) {
    improvements.push('Try the hands-on project for deeper learning')
  }

  const score = Math.round(accuracy * 50 + 
    (progress.completedSlides?.length || 0) / lesson.slides.length * 50)

  return {
    score: Math.min(100, Math.max(0, score)),
    strengths,
    improvements,
  }
}
