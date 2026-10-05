import type { GradeLevel, Slide } from '@/types'
import { v4 as uuid } from 'uuid'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  icon: string
  gradeLevel: GradeLevel
  estimatedTime: string
  materials: string[]
  instructions: string
  deliverables: string[]
  rubric: RubricCriteria[]
}

export interface RubricCriteria {
  id: string
  name: string
  description: string
  maxPoints: number
  levels: {
    label: string
    points: number
    description: string
  }[]
}

// Project templates for different subjects and grade levels
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // K-2 Projects
  {
    id: 'k2-drawing',
    name: 'Draw & Label',
    description: 'Create a drawing and label the parts',
    icon: '🎨',
    gradeLevel: 'K-2',
    estimatedTime: '20-30 minutes',
    materials: ['Paper', 'Crayons/Markers', 'Pencil'],
    instructions: `1. Draw a picture of what you learned
2. Label 3 important parts
3. Color your drawing
4. Share with the class!`,
    deliverables: ['Drawing with labels'],
    rubric: [
      {
        id: 'creativity',
        name: 'Creativity',
        description: 'How creative and unique is your drawing?',
        maxPoints: 10,
        levels: [
          { label: 'Excellent', points: 10, description: 'Very creative and unique' },
          { label: 'Good', points: 7, description: 'Some creative elements' },
          { label: 'Needs Work', points: 4, description: 'Basic drawing' },
        ],
      },
      {
        id: 'accuracy',
        name: 'Accuracy',
        description: 'Are the labels correct?',
        maxPoints: 10,
        levels: [
          { label: 'Excellent', points: 10, description: 'All labels correct' },
          { label: 'Good', points: 7, description: 'Most labels correct' },
          { label: 'Needs Work', points: 4, description: 'Some labels incorrect' },
        ],
      },
    ],
  },
  {
    id: 'k2-story',
    name: 'Tell a Story',
    description: 'Create a simple story about what you learned',
    icon: '📖',
    gradeLevel: 'K-2',
    estimatedTime: '25-35 minutes',
    materials: ['Paper', 'Pencil', 'Drawing supplies'],
    instructions: `1. Draw 4 pictures that tell a story
2. Write 1-2 sentences under each picture
3. Give your story a title
4. Read it out loud!`,
    deliverables: ['4-panel story with captions'],
    rubric: [
      {
        id: 'story',
        name: 'Story Flow',
        description: 'Does the story make sense?',
        maxPoints: 10,
        levels: [
          { label: 'Excellent', points: 10, description: 'Clear beginning, middle, end' },
          { label: 'Good', points: 7, description: 'Story makes sense' },
          { label: 'Needs Work', points: 4, description: 'Story is confusing' },
        ],
      },
    ],
  },

  // 3-5 Projects
  {
    id: '35-poster',
    name: 'Educational Poster',
    description: 'Create an informative poster about a topic',
    icon: '📋',
    gradeLevel: '3-5',
    estimatedTime: '30-45 minutes',
    materials: ['Poster board', 'Markers', 'Magazines/Printouts', 'Glue'],
    instructions: `1. Choose a topic from the lesson
2. Create a poster with:
   - A catchy title
   - 3-5 key facts
   - At least 2 images or diagrams
   - Color and decoration
3. Be ready to present your poster`,
    deliverables: ['Educational poster'],
    rubric: [
      {
        id: 'content',
        name: 'Content Accuracy',
        description: 'Are the facts correct and relevant?',
        maxPoints: 20,
        levels: [
          { label: 'Excellent', points: 20, description: 'All facts correct and relevant' },
          { label: 'Good', points: 15, description: 'Mostly correct' },
          { label: 'Needs Work', points: 10, description: 'Some inaccuracies' },
        ],
      },
      {
        id: 'design',
        name: 'Design & Layout',
        description: 'Is the poster well-designed and organized?',
        maxPoints: 15,
        levels: [
          { label: 'Excellent', points: 15, description: 'Professional design' },
          { label: 'Good', points: 10, description: 'Neat and organized' },
          { label: 'Needs Work', points: 5, description: 'Messy or disorganized' },
        ],
      },
    ],
  },
  {
    id: '35-research',
    name: 'Mini Research Report',
    description: 'Research and write a short report',
    icon: '📝',
    gradeLevel: '3-5',
    estimatedTime: '45-60 minutes',
    materials: ['Paper/Computer', 'Books/Internet', 'Pencil'],
    instructions: `1. Choose a question to research
2. Find 3-5 reliable sources
3. Write a report with:
   - Introduction (what you're researching)
   - 3 key findings
   - Conclusion (what you learned)
   - Sources/bibliography
4. Include at least 2 images`,
    deliverables: ['Research report (1-2 pages)'],
    rubric: [
      {
        id: 'research',
        name: 'Research Quality',
        description: 'Did you use reliable sources?',
        maxPoints: 20,
        levels: [
          { label: 'Excellent', points: 20, description: 'Multiple reliable sources' },
          { label: 'Good', points: 15, description: 'Some reliable sources' },
          { label: 'Needs Work', points: 10, description: 'Limited research' },
        ],
      },
      {
        id: 'writing',
        name: 'Writing Quality',
        description: 'Is the writing clear and well-organized?',
        maxPoints: 15,
        levels: [
          { label: 'Excellent', points: 15, description: 'Clear, organized, no errors' },
          { label: 'Good', points: 10, description: 'Generally clear' },
          { label: 'Needs Work', points: 5, description: 'Needs improvement' },
        ],
      },
    ],
  },

  // 6-8 Projects
  {
    id: '68-presentation',
    name: 'Slide Presentation',
    description: 'Create and deliver a presentation',
    icon: '💻',
    gradeLevel: '6-8',
    estimatedTime: '60-90 minutes',
    materials: ['Computer', 'Presentation software', 'Images'],
    instructions: `1. Choose a topic to present
2. Create 8-10 slides:
   - Title slide
   - Introduction
   - 4-6 content slides
   - Conclusion
   - Sources
3. Add images, charts, or diagrams
4. Practice your delivery
5. Present to the class (5-7 minutes)`,
    deliverables: ['Slide presentation', 'Oral presentation'],
    rubric: [
      {
        id: 'content',
        name: 'Content & Research',
        description: 'Is the content accurate and well-researched?',
        maxPoints: 25,
        levels: [
          { label: 'Excellent', points: 25, description: 'Thorough, accurate research' },
          { label: 'Good', points: 18, description: 'Good research' },
          { label: 'Needs Work', points: 12, description: 'Limited research' },
        ],
      },
      {
        id: 'delivery',
        name: 'Presentation Delivery',
        description: 'How well did you present?',
        maxPoints: 20,
        levels: [
          { label: 'Excellent', points: 20, description: 'Confident, clear, engaging' },
          { label: 'Good', points: 15, description: 'Clear and organized' },
          { label: 'Needs Work', points: 10, description: 'Nervous or unclear' },
        ],
      },
      {
        id: 'visuals',
        name: 'Visual Design',
        description: 'Are the slides well-designed?',
        maxPoints: 15,
        levels: [
          { label: 'Excellent', points: 15, description: 'Professional, consistent design' },
          { label: 'Good', points: 10, description: 'Neat and organized' },
          { label: 'Needs Work', points: 5, description: 'Messy or inconsistent' },
        ],
      },
    ],
  },
  {
    id: '68-experiment',
    name: 'Science Experiment',
    description: 'Design and conduct an experiment',
    icon: '🔬',
    gradeLevel: '6-8',
    estimatedTime: '90-120 minutes',
    materials: ['Lab materials', 'Notebook', 'Safety equipment'],
    instructions: `1. Form a hypothesis
2. Design your experiment:
   - Variables (independent, dependent, controlled)
   - Procedure (step-by-step)
   - Materials list
3. Conduct the experiment
4. Record data in a table
5. Analyze results
6. Write a conclusion
7. Present findings`,
    deliverables: ['Lab report', 'Data tables', 'Conclusion'],
    rubric: [
      {
        id: 'method',
        name: 'Scientific Method',
        description: 'Did you follow the scientific method?',
        maxPoints: 25,
        levels: [
          { label: 'Excellent', points: 25, description: 'Complete scientific method' },
          { label: 'Good', points: 18, description: 'Most steps completed' },
          { label: 'Needs Work', points: 12, description: 'Missing key steps' },
        ],
      },
      {
        id: 'data',
        name: 'Data Collection',
        description: 'Is your data accurate and well-recorded?',
        maxPoints: 20,
        levels: [
          { label: 'Excellent', points: 20, description: 'Accurate, organized data' },
          { label: 'Good', points: 15, description: 'Generally accurate' },
          { label: 'Needs Work', points: 10, description: 'Incomplete data' },
        ],
      },
    ],
  },

  // 9-12 Projects
  {
    id: '912-essay',
    name: 'Research Essay',
    description: 'Write a research-based argumentative essay',
    icon: '📚',
    gradeLevel: '9-12',
    estimatedTime: '2-3 hours',
    materials: ['Computer', 'Research databases', 'Word processor'],
    instructions: `1. Choose a debatable topic
2. Research both sides
3. Write a 5-paragraph essay:
   - Introduction with thesis
   - 3 body paragraphs with evidence
   - Counterargument & rebuttal
   - Conclusion
4. Cite 5+ sources (MLA/APA)
5. Edit and revise`,
    deliverables: ['Argumentative essay (800-1200 words)', 'Bibliography'],
    rubric: [
      {
        id: 'thesis',
        name: 'Thesis & Argument',
        description: 'Is the thesis clear and well-argued?',
        maxPoints: 25,
        levels: [
          { label: 'Excellent', points: 25, description: 'Clear thesis, strong argument' },
          { label: 'Good', points: 18, description: 'Good thesis, decent argument' },
          { label: 'Needs Work', points: 12, description: 'Unclear thesis' },
        ],
      },
      {
        id: 'evidence',
        name: 'Evidence & Research',
        description: 'Is the evidence credible and relevant?',
        maxPoints: 25,
        levels: [
          { label: 'Excellent', points: 25, description: 'Strong, credible sources' },
          { label: 'Good', points: 18, description: 'Adequate sources' },
          { label: 'Needs Work', points: 12, description: 'Weak or few sources' },
        ],
      },
      {
        id: 'writing',
        name: 'Writing Quality',
        description: 'Is the writing clear, organized, error-free?',
        maxPoints: 20,
        levels: [
          { label: 'Excellent', points: 20, description: 'Polished, professional' },
          { label: 'Good', points: 15, description: 'Generally well-written' },
          { label: 'Needs Work', points: 10, description: 'Needs significant revision' },
        ],
      },
    ],
  },
  {
    id: '912-project-management',
    name: 'Project Management',
    description: 'Plan and execute a complex project',
    icon: '📊',
    gradeLevel: '9-12',
    estimatedTime: '3-4 hours',
    materials: ['Computer', 'Project management tools', 'Collaboration software'],
    instructions: `1. Define project scope and goals
2. Create a project plan:
   - Timeline with milestones
   - Resource allocation
   - Risk assessment
3. Execute the project
4. Track progress
5. Present results with:
   - Executive summary
   - Timeline vs actual
   - Lessons learned
   - Recommendations`,
    deliverables: ['Project plan', 'Progress report', 'Final presentation'],
    rubric: [
      {
        id: 'planning',
        name: 'Project Planning',
        description: 'How thorough is the project plan?',
        maxPoints: 30,
        levels: [
          { label: 'Excellent', points: 30, description: 'Comprehensive plan' },
          { label: 'Good', points: 20, description: 'Good plan' },
          { label: 'Needs Work', points: 10, description: 'Incomplete plan' },
        ],
      },
      {
        id: 'execution',
        name: 'Execution & Management',
        description: 'How well was the project executed?',
        maxPoints: 25,
        levels: [
          { label: 'Excellent', points: 25, description: 'On time, on budget' },
          { label: 'Good', points: 18, description: 'Mostly successful' },
          { label: 'Needs Work', points: 10, description: 'Significant issues' },
        ],
      },
    ],
  },
]

// Get templates by grade level
export function getTemplatesByGrade(gradeLevel: GradeLevel): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(t => t.gradeLevel === gradeLevel)
}

// Get template by ID
export function getTemplateById(id: string): ProjectTemplate | null {
  return PROJECT_TEMPLATES.find(t => t.id === id) || null
}

// Create a project slide from template
export function createProjectFromTemplate(
  template: ProjectTemplate,
  order: number = 0
): Slide {
  return {
    id: uuid(),
    type: 'project',
    order,
    title: template.name,
    content: [],
    narration: {
      script: `Time for a project! ${template.description}`,
      duration: 30,
      rate: 0.85,
      pitch: 1.0,
      highlights: [],
    },
    interactions: [],
    project: {
      instructions: template.instructions,
      resources: template.materials,
      deliverables: template.deliverables,
    },
  }
}

// Calculate rubric score
export function calculateRubricScore(
  rubric: RubricCriteria[],
  scores: Record<string, number>
): {
  totalPoints: number
  earnedPoints: number
  percentage: number
  grade: string
} {
  const totalPoints = rubric.reduce((sum, c) => sum + c.maxPoints, 0)
  const earnedPoints = rubric.reduce((sum, c) => sum + (scores[c.id] || 0), 0)
  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  
  let grade = 'F'
  if (percentage >= 90) grade = 'A'
  else if (percentage >= 80) grade = 'B'
  else if (percentage >= 70) grade = 'C'
  else if (percentage >= 60) grade = 'D'

  return { totalPoints, earnedPoints, percentage, grade }
}

// Generate feedback from rubric scores
export function generateRubricFeedback(
  rubric: RubricCriteria[],
  scores: Record<string, number>
): string[] {
  const feedback: string[] = []
  
  rubric.forEach(criteria => {
    const score = scores[criteria.id] || 0
    const maxLevel = criteria.levels[0]
    const minLevel = criteria.levels[criteria.levels.length - 1]
    
    if (score >= maxLevel.points * 0.9) {
      feedback.push(`✅ Excellent ${criteria.name.toLowerCase()}: ${maxLevel.description}`)
    } else if (score <= minLevel.points * 1.1) {
      feedback.push(`💡 Work on ${criteria.name.toLowerCase()}: ${criteria.description}`)
    }
  })
  
  return feedback
}
