import type { Lesson, Slide, Project, Viewport, BoardItem, LessonMetadata, GradeLevel, SlideType } from '@/types'
import { v4 as uuid } from 'uuid'

// Convert a project's viewports into a lesson with slides
export function projectToLesson(
  project: Project,
  metadata: Partial<LessonMetadata> = {}
): Lesson {
  const slides: Slide[] = []
  
  // Convert each viewport to a slide
  project.viewports.forEach((viewport, idx) => {
    slides.push(viewportToSlide(viewport, idx))
  })

  // If no viewports, create slides from items grouped by position
  if (slides.length === 0 && project.viewports[0]?.items.length) {
    const items = project.viewports[0].items
    const grouped = groupItemsIntoSlides(items)
    grouped.forEach((group, idx) => {
      slides.push({
        id: uuid(),
        type: 'concept',
        order: idx,
        title: `Slide ${idx + 1}`,
        content: group,
        narration: {
          script: '',
          duration: 30,
          rate: 0.85,
          pitch: 1.0,
          highlights: [],
        },
        interactions: [],
      })
    })
  }

  return {
    ...project,
    metadata: {
      title: metadata.title || project.name || 'Untitled Lesson',
      subject: metadata.subject || 'General',
      gradeLevel: metadata.gradeLevel || '3-5',
      estimatedTime: metadata.estimatedTime || `${slides.length * 2} minutes`,
      learningObjectives: metadata.learningObjectives || [],
      author: metadata.author || 'User',
      created: new Date().toISOString(),
    },
    slides,
    navigation: 'linear',
  }
}

// Convert a viewport to a slide
function viewportToSlide(viewport: Viewport, order: number): Slide {
  return {
    id: viewport.id,
    type: 'concept',
    order,
    title: viewport.name || `Slide ${order + 1}`,
    content: viewport.items,
    narration: {
      script: '',
      duration: 30,
      rate: 0.85,
      pitch: 1.0,
      highlights: [],
    },
    interactions: [],
  }
}

// Group items into slides based on proximity
function groupItemsIntoSlides(items: BoardItem[]): BoardItem[][] {
  const groups: BoardItem[][] = []
  const itemsPerSlide = 3 // Average items per slide
  
  for (let i = 0; i < items.length; i += itemsPerSlide) {
    groups.push(items.slice(i, i + itemsPerSlide))
  }
  
  return groups.length > 0 ? groups : [[]]
}

// Create a blank slide
export function createSlide(
  type: SlideType = 'concept',
  title: string = 'New Slide',
  order: number = 0
): Slide {
  return {
    id: uuid(),
    type,
    order,
    title,
    content: [],
    narration: {
      script: '',
      duration: 30,
      rate: 0.85,
      pitch: 1.0,
      highlights: [],
    },
    interactions: [],
  }
}

// Create a quiz slide
export function createQuizSlide(
  title: string,
  questions: { question: string; options: string[]; correctAnswer: number; explanation: string }[],
  order: number = 0
): Slide {
  return {
    id: uuid(),
    type: 'quiz',
    order,
    title,
    content: [],
    narration: {
      script: '',
      duration: 0,
      rate: 0.85,
      pitch: 1.0,
      highlights: [],
    },
    interactions: [],
    quiz: questions.map(q => ({
      id: uuid(),
      question: q.question,
      type: 'multiple-choice' as const,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      points: 10,
    })),
  }
}

// Create a branch slide
export function createBranchSlide(
  prompt: string,
  choices: { label: string; targetSlideId: string }[],
  order: number = 0
): Slide {
  return {
    id: uuid(),
    type: 'branch',
    order,
    title: 'Choose Your Path',
    content: [],
    narration: {
      script: '',
      duration: 0,
      rate: 0.85,
      pitch: 1.0,
      highlights: [],
    },
    interactions: [],
    branch: { prompt, choices },
  }
}

// Create a project slide
export function createProjectSlide(
  title: string,
  instructions: string,
  resources: string[] = [],
  order: number = 0
): Slide {
  return {
    id: uuid(),
    type: 'project',
    order,
    title,
    content: [],
    narration: {
      script: '',
      duration: 0,
      rate: 0.85,
      pitch: 1.0,
      highlights: [],
    },
    interactions: [],
    project: {
      instructions,
      resources,
      deliverables: [],
    },
  }
}

// Generate narration script from slide content
export function generateNarrationScript(slide: Slide): string {
  const parts: string[] = []
  
  if (slide.title) {
    parts.push(slide.title)
  }
  
  for (const item of slide.content) {
    if ('text' in item && item.text) {
      parts.push(item.text)
    } else if ('raw' in item && item.raw) {
      parts.push(item.raw)
    } else if ('description' in item && item.description) {
      parts.push(`Image: ${item.description}`)
    }
  }
  
  return parts.join('. ')
}

// Calculate lesson duration estimate
export function estimateLessonDuration(lesson: Lesson): number {
  const slideCount = lesson.slides.length
  const avgTimePerSlide = 60 // seconds
  return slideCount * avgTimePerSlide
}

// Get lesson progress
export function getLessonProgress(
  lesson: Lesson,
  completedSlides: string[]
): { completed: number; total: number; percentage: number } {
  const completed = completedSlides.filter(id => 
    lesson.slides.some(s => s.id === id)
  ).length
  const total = lesson.slides.length
  return {
    completed,
    total,
    percentage: total > 0 ? (completed / total) * 100 : 0,
  }
}

// Turn placeholder branch targets (slide-3) into real slide ids after slides exist.
export function resolveBranchTargets(slides: Slide[]): Slide[] {
  return slides.map((slide) => {
    if (slide.type !== 'branch' || !slide.branch) return slide
    return {
      ...slide,
      branch: {
        ...slide.branch,
        choices: slide.branch.choices.map((choice) => {
          const match = /^slide-(\d+)$/.exec(choice.targetSlideId)
          if (!match) return choice
          const target = slides[Number(match[1])]
          if (!target) return choice
          return { ...choice, targetSlideId: target.id }
        }),
      },
    }
  })
}
