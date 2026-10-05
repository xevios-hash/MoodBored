import type { Lesson, Slide, GradeLevel, QuizQuestion, Narration, LessonMetadata, BoardItem } from '@/types'
import { v4 as uuid } from 'uuid'
import { createSlide, createQuizSlide, createProjectSlide, createBranchSlide } from './lesson'

interface LessonGenerationOptions {
  topic: string
  gradeLevel: GradeLevel
  slideCount?: number
  includeQuizzes?: boolean
  includeProject?: boolean
  includeBranches?: boolean
  subject?: string
}

// Generate a lesson using AI
export async function generateLesson(options: LessonGenerationOptions): Promise<Lesson | null> {
  const {
    topic,
    gradeLevel,
    slideCount = 8,
    includeQuizzes = true,
    includeProject = false,
    includeBranches = false,
    subject = 'General',
  } = options

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'system',
            content: buildLessonSystemPrompt(gradeLevel, slideCount, includeQuizzes, includeProject, includeBranches),
          },
          {
            role: 'user',
            content: `Create a lesson about: ${topic}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })

    // Handle any non-OK response with fallback
    if (!response.ok) {
      console.warn('[LessonGen] API error:', response.status, '— using fallback lesson')
      return createFallbackLesson(topic, gradeLevel, subject, slideCount, includeQuizzes, includeProject)
    }

    const data = await response.json()
    
    // Check for error in response
    if (data.error) {
      console.warn('[LessonGen] API returned error:', data.error, '— using fallback lesson')
      return createFallbackLesson(topic, gradeLevel, subject, slideCount, includeQuizzes, includeProject)
    }
    
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      console.warn('[LessonGen] No content in response — using fallback lesson')
      return createFallbackLesson(topic, gradeLevel, subject, slideCount, includeQuizzes, includeProject)
    }

    // Parse the generated lesson from JSON
    const lessonData = parseLessonResponse(content, topic, gradeLevel, subject)
    return lessonData
  } catch (err) {
    console.warn('[LessonGen] Failed to generate lesson, using fallback:', err)
    return createFallbackLesson(topic, gradeLevel, subject, slideCount, includeQuizzes, includeProject)
  }
}

// Create a fallback lesson when AI is unavailable
function createFallbackLesson(
  topic: string,
  gradeLevel: GradeLevel,
  subject: string,
  slideCount: number,
  includeQuizzes: boolean,
  includeProject: boolean
): Lesson {
  const slides: Slide[] = []
  
  // Intro slide
  slides.push({
    id: uuid(),
    type: 'concept',
    order: 0,
    title: `Welcome to ${topic}!`,
    content: [{
      kind: 'note',
      id: uuid(),
      text: `Let's learn about ${topic}. This is a ${subject} lesson for ${gradeLevel} students.`,
      purpose: '', importance: '', tags: [],
      pos: { x: 100, y: 100 },
    }],
    narration: { script: `Welcome! Today we're going to learn about ${topic}.`, duration: 15, rate: 0.85, pitch: 1, highlights: [] },
    interactions: [],
  })

  // Content slides
  for (let i = 1; i < slideCount - 1; i++) {
    slides.push({
      id: uuid(),
      type: 'concept',
      order: i,
      title: `Key Concept ${i}`,
      content: [{
        kind: 'note',
        id: uuid(),
        text: `Important concept ${i} about ${topic}. Add your notes here.`,
        purpose: '', importance: '', tags: [],
        pos: { x: 100, y: 100 },
      }],
      narration: { script: `Here's an important concept about ${topic}.`, duration: 20, rate: 0.85, pitch: 1, highlights: [] },
      interactions: [],
    })
  }

  // Quiz slide
  if (includeQuizzes) {
    slides.push({
      id: uuid(),
      type: 'quiz',
      order: slides.length,
      title: 'Quick Check!',
      content: [],
      narration: { script: '', duration: 0, rate: 0.85, pitch: 1, highlights: [] },
      interactions: [],
      quiz: [{
        id: uuid(),
        question: `What did you learn about ${topic}?`,
        type: 'multiple-choice',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        explanation: 'Good job! Keep learning!',
        points: 10,
      }],
    })
  }

  // Project slide
  if (includeProject) {
    slides.push({
      id: uuid(),
      type: 'project',
      order: slides.length,
      title: 'Try It Yourself!',
      content: [],
      narration: { script: 'Now it\'s your turn to try!', duration: 15, rate: 0.85, pitch: 1, highlights: [] },
      interactions: [],
      project: {
        instructions: `Create something about ${topic}! Draw, write, or build to show what you learned.`,
        resources: ['Paper', 'Pencils', 'Your imagination!'],
        deliverables: ['Creative project'],
      },
    })
  }

  // Summary slide
  slides.push({
    id: uuid(),
    type: 'summary',
    order: slides.length,
    title: 'Great Job!',
    content: [{
      kind: 'note',
      id: uuid(),
      text: `You learned about ${topic}! Keep exploring and asking questions.`,
      purpose: '', importance: '', tags: [],
      pos: { x: 100, y: 100 },
    }],
    narration: { script: `Great job! You learned so much about ${topic}. Keep exploring!`, duration: 15, rate: 0.85, pitch: 1, highlights: [] },
    interactions: [],
  })

  return {
    id: uuid(),
    name: topic,
    viewports: [],
    components: [],
    settings: {
      apiKey: '', defaultModel: 'anthropic/claude-sonnet-4',
      jevThreshold: 0.2, multiAgent: false, theme: 'light',
      canvasBg: '#e0f2fe', canvasBgType: 'color', canvasBgVideo: '',
      customBgUrls: [], customBgLabels: {},
    },
    snapshots: [],
    annotations: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    metadata: {
      title: topic,
      subject,
      gradeLevel,
      estimatedTime: `${slideCount * 2} minutes`,
      learningObjectives: [`Learn about ${topic}`],
      author: 'Generated',
      created: new Date().toISOString(),
    },
    slides,
    navigation: 'linear',
  }
}

// Build the system prompt for lesson generation
function buildLessonSystemPrompt(
  gradeLevel: GradeLevel,
  slideCount: number,
  includeQuizzes: boolean,
  includeProject: boolean,
  includeBranches: boolean
): string {
  const gradeDescriptions: Record<GradeLevel, string> = {
    'K-2': 'Ages 5-8. Simple language, short sentences, lots of repetition. Focus on concrete concepts.',
    '3-5': 'Ages 8-11. Clear explanations, some abstract thinking. Can handle cause-and-effect.',
    '6-8': 'Ages 11-14. More complex concepts, critical thinking. Can handle multiple perspectives.',
    '9-12': 'Ages 14-18. Abstract thinking, analysis, synthesis. College-prep level.',
    'adult': 'Professional/college level. Detailed, nuanced, comprehensive.',
  }

  return `You are an expert educator creating interactive lesson content.

GRADE LEVEL: ${gradeLevel} — ${gradeDescriptions[gradeLevel]}

TASK: Create a ${slideCount}-slide lesson. Return ONLY valid JSON (no markdown, no explanation).

JSON FORMAT:
{
  "title": "Lesson title",
  "subject": "Subject area",
  "learningObjectives": ["Objective 1", "Objective 2"],
  "slides": [
    {
      "type": "concept",
      "title": "Slide title",
      "content": "Main text content (2-3 sentences)",
      "imageDescription": "What image would help illustrate this",
      "narration": "What the AI should say aloud (2-3 sentences)",
      "duration": 30
    }
  ]
}

SLIDE TYPES TO USE:
${includeQuizzes ? '- "quiz": Interactive quiz with questions and answers\n' : ''}${includeProject ? '- "project": Hands-on activity with clear instructions\n' : ''}${includeBranches ? '- "branch": Choice point where learner picks a path\n' : ''}- "concept": Core teaching slide with text + image
- "summary": Recap of key points

QUIZ FORMAT (when type is "quiz"):
{
  "type": "quiz",
  "title": "Quick Check",
  "questions": [
    {
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "Why this is correct"
    }
  ]
}

PROJECT FORMAT (when type is "project"):
{
  "type": "project",
  "title": "Try It Yourself",
  "instructions": "Step-by-step instructions...",
  "resources": ["Resource 1", "Resource 2"]
}

BRANCH FORMAT (when type is "branch"):
{
  "type": "branch",
  "title": "Choose Your Path",
  "branchPrompt": "What would you like to explore?",
  "choices": [
    { "label": "Option A", "targetSlideIndex": 3 },
    { "label": "Option B", "targetSlideIndex": 5 }
  ]
}

RULES:
1. Start with a hook slide that grabs attention
2. Build concepts progressively
3. ${includeQuizzes ? 'Include 2-3 quiz slides scattered throughout' : 'Focus on teaching content'}
4. ${includeProject ? 'Include 1 project slide for hands-on practice' : ''}
5. ${includeBranches ? 'Include 1-2 branch points for exploration' : ''}
6. End with a summary slide
7. Use age-appropriate language for ${gradeLevel}
8. Make it engaging and interactive
9. Image descriptions should be vivid and specific (for AI image generation)

Return ONLY the JSON object. No markdown fences, no explanation.`
}

// Parse the AI response into a Lesson
function parseLessonResponse(content: string, topic: string, gradeLevel: GradeLevel, subject: string): Lesson | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    const data = JSON.parse(jsonStr)
    
    if (!data.slides || !Array.isArray(data.slides)) {
      console.error('[LessonGen] No slides in response')
      return null
    }

    const slides: Slide[] = []
    
    data.slides.forEach((slideData: any, idx: number) => {
      const slide = parseSlide(slideData, idx, gradeLevel)
      if (slide) slides.push(slide)
    })

    if (slides.length === 0) return null

    const metadata: LessonMetadata = {
      title: data.title || topic,
      subject: data.subject || subject,
      gradeLevel,
      estimatedTime: `${slides.length * 2} minutes`,
      learningObjectives: data.learningObjectives || [],
      author: 'AI Generated',
      created: new Date().toISOString(),
    }

    return {
      id: uuid(),
      name: metadata.title,
      viewports: [],
      components: [],
      settings: {
        apiKey: '',
        defaultModel: 'anthropic/claude-sonnet-4',
        jevThreshold: 0.2,
        multiAgent: false,
        theme: 'light',
        canvasBg: '#e0f2fe',
        canvasBgType: 'color',
        canvasBgVideo: '',
        customBgUrls: [],
        customBgLabels: {},
      },
      snapshots: [],
      annotations: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      metadata,
      slides,
      navigation: 'linear',
    }
  } catch (err) {
    console.error('[LessonGen] Failed to parse lesson response:', err)
    return null
  }
}

// Parse a single slide from AI data
function parseSlide(data: any, order: number, gradeLevel: GradeLevel): Slide | null {
  const type = data.type || 'concept'
  const id = uuid()

  switch (type) {
    case 'quiz': {
      const questions: QuizQuestion[] = (data.questions || []).map((q: any) => ({
        id: uuid(),
        question: q.question || '',
        type: 'multiple-choice' as const,
        options: q.options || [],
        correctAnswer: q.correctAnswer ?? 0,
        explanation: q.explanation || '',
        points: 10,
      }))
      
      return {
        id,
        type: 'quiz',
        order,
        title: data.title || 'Quiz',
        content: [],
        narration: { script: '', duration: 0, rate: 0.85, pitch: 1.0, highlights: [] },
        interactions: [],
        quiz: questions,
      }
    }

    case 'project': {
      return {
        id,
        type: 'project',
        order,
        title: data.title || 'Project',
        content: [],
        narration: { script: '', duration: 0, rate: 0.85, pitch: 1.0, highlights: [] },
        interactions: [],
        project: {
          instructions: data.instructions || '',
          resources: data.resources || [],
          deliverables: [],
        },
      }
    }

    case 'branch': {
      const choices = (data.choices || []).map((c: any) => ({
        label: c.label || 'Option',
        targetSlideId: `slide-${c.targetSlideIndex ?? 0}`, // Will be resolved later
      }))
      
      return {
        id,
        type: 'branch',
        order,
        title: data.title || 'Choose',
        content: [],
        narration: { script: '', duration: 0, rate: 0.85, pitch: 1.0, highlights: [] },
        interactions: [],
        branch: {
          prompt: data.branchPrompt || 'What would you like to explore?',
          choices,
        },
      }
    }

    case 'summary':
    case 'concept':
    default: {
      // Create content items from text
      const contentItems: BoardItem[] = []
      
      if (data.content) {
        contentItems.push({
          kind: 'note',
          id: uuid(),
          text: data.content,
          purpose: '',
          importance: '',
          tags: [],
          pos: { x: 100, y: 100 },
        })
      }

      return {
        id,
        type: type as any,
        order,
        title: data.title || `Slide ${order + 1}`,
        content: contentItems,
        narration: {
          script: data.narration || data.content || '',
          duration: data.duration || 30,
          rate: 0.85,
          pitch: 1.0,
          highlights: [],
        },
        interactions: [],
      }
    }
  }
}

// Generate image prompt from slide content
export function generateImagePrompt(slide: Slide): string {
  for (const item of slide.content) {
    if ('description' in item && item.description) {
      return item.description
    }
    if ('text' in item && item.text) {
      return `Illustration for: ${item.text.slice(0, 100)}`
    }
  }
  return slide.title
}

// Estimate lesson quality score
export function estimateLessonQuality(lesson: Lesson): number {
  let score = 0
  const maxScore = 100

  // Has title
  if (lesson.metadata?.title) score += 10

  // Has learning objectives
  if (lesson.metadata?.learningObjectives?.length > 0) score += 15

  // Has slides
  if (lesson.slides.length > 0) score += 10
  if (lesson.slides.length >= 5) score += 10

  // Has narration
  const withNarration = lesson.slides.filter(s => s.narration?.script).length
  score += Math.min(20, (withNarration / lesson.slides.length) * 20)

  // Has quizzes
  const quizCount = lesson.slides.filter(s => s.type === 'quiz').length
  score += Math.min(15, quizCount * 5)

  // Has project
  if (lesson.slides.some(s => s.type === 'project')) score += 10

  // Has variety of slide types
  const types = new Set(lesson.slides.map(s => s.type))
  score += Math.min(10, types.size * 2)

  return Math.min(maxScore, score)
}
