import type { GradeLevel } from '@/types'

// Grade-school UI theme configuration
export interface EducationTheme {
  fontSize: {
    body: string
    header: string
    caption: string
  }
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    error: string
    background: string
    surface: string
    text: string
    textSecondary: string
  }
  spacing: {
    buttonPadding: string
    sectionGap: string
  }
  borderRadius: {
    small: string
    medium: string
    large: string
  }
}

// Theme for different grade levels
export const GRADE_THEMES: Record<GradeLevel, EducationTheme> = {
  'K-2': {
    fontSize: {
      body: 'text-xl',
      header: 'text-3xl',
      caption: 'text-lg',
    },
    colors: {
      primary: '#FF6B6B',
      secondary: '#4ECDC4',
      success: '#95E77E',
      warning: '#FFE66D',
      error: '#FF6B6B',
      background: '#FFF8E7',
      surface: '#FFFFFF',
      text: '#2D3436',
      textSecondary: '#636E72',
    },
    spacing: {
      buttonPadding: 'px-8 py-6',
      sectionGap: 'space-y-8',
    },
    borderRadius: {
      small: 'rounded-lg',
      medium: 'rounded-2xl',
      large: 'rounded-3xl',
    },
  },
  '3-5': {
    fontSize: {
      body: 'text-lg',
      header: 'text-2xl',
      caption: 'text-base',
    },
    colors: {
      primary: '#4A90D9',
      secondary: '#F5A623',
      success: '#7ED321',
      warning: '#F5A623',
      error: '#D0021B',
      background: '#F8F9FA',
      surface: '#FFFFFF',
      text: '#2D3436',
      textSecondary: '#636E72',
    },
    spacing: {
      buttonPadding: 'px-6 py-4',
      sectionGap: 'space-y-6',
    },
    borderRadius: {
      small: 'rounded-lg',
      medium: 'rounded-xl',
      large: 'rounded-2xl',
    },
  },
  '6-8': {
    fontSize: {
      body: 'text-base',
      header: 'text-xl',
      caption: 'text-sm',
    },
    colors: {
      primary: '#6A5AAE',
      secondary: '#8B7DC8',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      background: '#F2F2F7',
      surface: '#FFFFFF',
      text: '#1C1C1E',
      textSecondary: '#8E8E93',
    },
    spacing: {
      buttonPadding: 'px-5 py-3',
      sectionGap: 'space-y-5',
    },
    borderRadius: {
      small: 'rounded-md',
      medium: 'rounded-lg',
      large: 'rounded-xl',
    },
  },
  '9-12': {
    fontSize: {
      body: 'text-sm',
      header: 'text-lg',
      caption: 'text-xs',
    },
    colors: {
      primary: '#007AFF',
      secondary: '#5856D6',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      background: '#F2F2F7',
      surface: '#FFFFFF',
      text: '#1C1C1E',
      textSecondary: '#8E8E93',
    },
    spacing: {
      buttonPadding: 'px-4 py-2.5',
      sectionGap: 'space-y-4',
    },
    borderRadius: {
      small: 'rounded',
      medium: 'rounded-md',
      large: 'rounded-lg',
    },
  },
  'adult': {
    fontSize: {
      body: 'text-sm',
      header: 'text-lg',
      caption: 'text-xs',
    },
    colors: {
      primary: '#6A5AAE',
      secondary: '#8B7DC8',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      background: '#F5F5F7',
      surface: '#FFFFFF',
      text: '#1D1D1F',
      textSecondary: '#86868B',
    },
    spacing: {
      buttonPadding: 'px-4 py-2',
      sectionGap: 'space-y-4',
    },
    borderRadius: {
      small: 'rounded',
      medium: 'rounded-md',
      large: 'rounded-lg',
    },
  },
}

// Get theme for grade level
export function getEducationTheme(gradeLevel: GradeLevel): EducationTheme {
  return GRADE_THEMES[gradeLevel] || GRADE_THEMES['3-5']
}

// Generate CSS variables for theme
export function getThemeCSS(theme: EducationTheme): string {
  return `
    --edu-primary: ${theme.colors.primary};
    --edu-secondary: ${theme.colors.secondary};
    --edu-success: ${theme.colors.success};
    --edu-warning: ${theme.colors.warning};
    --edu-error: ${theme.colors.error};
    --edu-bg: ${theme.colors.background};
    --edu-surface: ${theme.colors.surface};
    --edu-text: ${theme.colors.text};
    --edu-text-secondary: ${theme.colors.textSecondary};
  `
}

// Accessibility helpers
export const a11y = {
  // Screen reader announcements
  announce: (message: string) => {
    const announcer = document.getElementById('a11y-announcer')
    if (announcer) {
      announcer.textContent = message
      // Clear after a delay so it can be re-announced
      setTimeout(() => { announcer.textContent = '' }, 1000)
    }
  },

  // Focus trap for modals
  trapFocus: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable.focus()
        }
      }
    }

    element.addEventListener('keydown', handleTab)
    return () => element.removeEventListener('keydown', handleTab)
  },

  // High contrast mode detection
  prefersHighContrast: () => {
    return window.matchMedia('(prefers-contrast: high)').matches
  },

  // Reduced motion detection
  prefersReducedMotion: () => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },
}

// Generate ARIA labels for common elements
export const ariaLabels = {
  quizQuestion: (index: number, total: number) => 
    `Question ${index + 1} of ${total}`,
  
  progressBar: (value: number) => 
    `Progress: ${value} percent complete`,
  
  slideNavigation: (current: number, total: number) => 
    `Slide ${current} of ${total}`,
  
  scoreDisplay: (score: number) => 
    `Your score: ${score} percent`,
  
  button: (action: string) => 
    `Click to ${action}`,
  
  correctAnswer: () => 'Correct answer',
  incorrectAnswer: () => 'Incorrect answer',
  revealHint: () => 'Click to reveal answer',
  nextSlide: () => 'Go to next slide',
  previousSlide: () => 'Go to previous slide',
  closeLesson: () => 'Close lesson',
  openLesson: (title: string) => `Open lesson: ${title}`,
}
