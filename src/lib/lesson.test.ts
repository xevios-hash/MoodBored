import { describe, it, expect } from 'vitest'
import { projectToLesson, createSlide, createQuizSlide, createProjectSlide, createBranchSlide, generateNarrationScript, estimateLessonDuration, getLessonProgress } from './lesson'
import { generateImagePrompt, estimateLessonQuality } from './lessonGenerator'
import type { Project, Slide, Lesson } from '@/types'

const mockProject: Project = {
  id: 'test-project',
  name: 'Test Project',
  viewports: [{
    id: 'vp1',
    name: 'Main Board',
    items: [
      { kind: 'note', id: 'note1', text: 'Hello world', purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 } },
      { kind: 'image', id: 'img1', thumbnail: 'test.jpg', fullSource: 'test.jpg', description: 'Test image', source: '', purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 }, size: { w: 300, h: 200 } },
    ],
    connections: [],
    typedConnections: [],
    messages: [],
    camX: 0,
    camY: 0,
    zoom: 1,
  }],
  components: [],
  snapshots: [],
  annotations: [],
  settings: {
    apiKey: '', defaultModel: 'test', jevThreshold: 0.2, multiAgent: false,
    theme: 'light', canvasBg: '#fff', canvasBgType: 'color', canvasBgVideo: '',
    customBgUrls: [], customBgLabels: {},
  },
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
}

describe('projectToLesson', () => {
  it('converts a project to a lesson', () => {
    const lesson = projectToLesson(mockProject, { title: 'My Lesson', gradeLevel: '3-5' })
    expect(lesson.metadata.title).toBe('My Lesson')
    expect(lesson.metadata.gradeLevel).toBe('3-5')
    expect(lesson.slides.length).toBeGreaterThan(0)
  })

  it('creates slides from viewports', () => {
    const lesson = projectToLesson(mockProject)
    expect(lesson.slides[0].content.length).toBe(2) // 2 items in viewport
  })
})

describe('createSlide', () => {
  it('creates a basic slide', () => {
    const slide = createSlide('concept', 'Test Slide', 0)
    expect(slide.type).toBe('concept')
    expect(slide.title).toBe('Test Slide')
    expect(slide.order).toBe(0)
  })
})

describe('createQuizSlide', () => {
  it('creates a quiz slide with questions', () => {
    const slide = createQuizSlide('Quiz', [{
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      explanation: '2+2=4',
    }])
    expect(slide.type).toBe('quiz')
    expect(slide.quiz?.length).toBe(1)
    expect(slide.quiz?.[0].correctAnswer).toBe(1)
  })
})

describe('createProjectSlide', () => {
  it('creates a project slide', () => {
    const slide = createProjectSlide('Project', 'Do something', ['Resource 1'])
    expect(slide.type).toBe('project')
    expect(slide.project?.instructions).toBe('Do something')
    expect(slide.project?.resources.length).toBe(1)
  })
})

describe('createBranchSlide', () => {
  it('creates a branch slide', () => {
    const slide = createBranchSlide('Choose?', [
      { label: 'Option A', targetSlideId: 'slide-1' },
      { label: 'Option B', targetSlideId: 'slide-2' },
    ])
    expect(slide.type).toBe('branch')
    expect(slide.branch?.choices.length).toBe(2)
  })
})

describe('generateNarrationScript', () => {
  it('generates narration from slide content', () => {
    const slide: Slide = {
      id: 'test',
      type: 'concept',
      order: 0,
      title: 'Test',
      content: [
        { kind: 'note', id: 'n1', text: 'This is a test', purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 } },
      ],
      narration: { script: '', duration: 30, rate: 0.85, pitch: 1, highlights: [] },
      interactions: [],
    }
    const script = generateNarrationScript(slide)
    expect(script).toContain('Test')
    expect(script).toContain('This is a test')
  })
})

describe('estimateLessonDuration', () => {
  it('estimates duration based on slide count', () => {
    const lesson = projectToLesson(mockProject)
    const duration = estimateLessonDuration(lesson)
    expect(duration).toBeGreaterThan(0)
    expect(duration).toBe(lesson.slides.length * 60)
  })
})

describe('getLessonProgress', () => {
  it('calculates lesson progress', () => {
    const lesson = projectToLesson(mockProject)
    const progress = getLessonProgress(lesson, [lesson.slides[0].id])
    expect(progress.completed).toBe(1)
    expect(progress.total).toBe(lesson.slides.length)
    expect(progress.percentage).toBeCloseTo(100 / lesson.slides.length, 1)
  })
})

describe('generateImagePrompt', () => {
  it('generates image prompt from slide content', () => {
    const slide: Slide = {
      id: 'test',
      type: 'concept',
      order: 0,
      title: 'The Solar System',
      content: [],
      narration: { script: '', duration: 30, rate: 0.85, pitch: 1, highlights: [] },
      interactions: [],
    }
    const prompt = generateImagePrompt(slide)
    expect(prompt).toContain('Solar System')
  })
})

describe('estimateLessonQuality', () => {
  it('scores lesson quality', () => {
    const lesson = projectToLesson(mockProject, {
      title: 'Test',
      learningObjectives: ['Learn something'],
    })
    const score = estimateLessonQuality(lesson)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('gives higher score to more complete lessons', () => {
    const basicLesson = projectToLesson(mockProject)
    const fullLesson = projectToLesson(mockProject, {
      title: 'Full Lesson',
      learningObjectives: ['Obj 1', 'Obj 2'],
    })
    // Add quizzes and projects to full lesson
    fullLesson.slides.push(createQuizSlide('Quiz', [{ question: 'Q?', options: ['A', 'B'], correctAnswer: 0, explanation: '' }]))
    fullLesson.slides.push(createProjectSlide('Project', 'Do it'))
    
    const basicScore = estimateLessonQuality(basicLesson)
    const fullScore = estimateLessonQuality(fullLesson)
    expect(fullScore).toBeGreaterThan(basicScore)
  })
})

describe('Interactive Elements', () => {
  it('quiz slide has questions with correct answers', () => {
    const slide = createQuizSlide('Test Quiz', [
      { question: 'What is 2+2?', options: ['3', '4', '5', '6'], correctAnswer: 1, explanation: 'Basic math' },
    ])
    expect(slide.quiz?.length).toBe(1)
    expect(slide.quiz?.[0].correctAnswer).toBe(1)
    expect(slide.quiz?.[0].explanation).toBe('Basic math')
  })

  it('branch slide has choices with target slides', () => {
    const slide = createBranchSlide('Choose path', [
      { label: 'Easy', targetSlideId: 'slide-1' },
      { label: 'Hard', targetSlideId: 'slide-2' },
    ])
    expect(slide.branch?.choices.length).toBe(2)
    expect(slide.branch?.choices[0].targetSlideId).toBe('slide-1')
    expect(slide.branch?.choices[1].targetSlideId).toBe('slide-2')
  })

  it('project slide has instructions and resources', () => {
    const slide = createProjectSlide('Build it', 'Step 1...\nStep 2...', ['Resource A', 'Resource B'])
    expect(slide.project?.instructions).toContain('Step 1')
    expect(slide.project?.resources.length).toBe(2)
    expect(slide.type).toBe('project')
  })

  it('lesson with mixed slide types scores higher', () => {
    const baseLesson = projectToLesson(mockProject)
    
    const mixedLesson = projectToLesson(mockProject, {
      title: 'Mixed',
      learningObjectives: ['Learn A', 'Learn B'],
    })
    mixedLesson.slides.push(createQuizSlide('Quiz', [{ question: 'Q?', options: ['A', 'B'], correctAnswer: 0, explanation: '' }]))
    mixedLesson.slides.push(createProjectSlide('Project', 'Do it'))
    mixedLesson.slides.push(createBranchSlide('Choose?', [{ label: 'A', targetSlideId: '1' }]))
    
    const baseScore = estimateLessonQuality(baseLesson)
    const mixedScore = estimateLessonQuality(mixedLesson)
    expect(mixedScore).toBeGreaterThan(baseScore)
  })
})
