import type { Project, BoardItem, Viewport } from '@/types'
import { summarizeProject, describeBoard } from './api'

// ─── Design Token Extraction ────────────────────────────────────────

interface DesignTokens {
  $schema: string
  color: Record<string, { $type: string; $value: string }>
  typography: Record<string, { $type: string; $value: string }>
  spacing: Record<string, { $type: string; $value: string }>
  borderRadius: Record<string, { $type: string; $value: string }>
}

export function extractDesignTokens(project: Project): DesignTokens {
  const items = project.viewports.flatMap((v) => v.items)
  const colors = new Set<string>()
  const fonts = new Set<string>()

  for (const item of items) {
    if (item.kind === 'palette' && 'colors' in item) {
      for (const c of item.colors) colors.add(c.hex)
    }
    if (item.kind === 'gradient' && 'stops' in item) {
      for (const s of item.stops) colors.add(s.color)
    }
    if (item.kind === 'swatch' && 'hex' in item) {
      colors.add(item.hex)
    }
    if (item.kind === 'font' && 'fontFamily' in item) {
      fonts.add(item.fontFamily)
    }
    if (item.kind === 'image' && 'source' in item) {
      colors.add('#ffffff') // images imply white background
    }
  }

  // Add app colors
  colors.add(project.settings.canvasBg || '#e0f2fe')
  colors.add('#ffffff')
  colors.add('#1a1a2e')
  colors.add('#2dd4bf')

  const colorTokens: Record<string, { $type: string; $value: string }> = {}
  let colorIdx = 0
  for (const c of colors) {
    if (c && c.startsWith('#')) {
      colorTokens[`color-${colorIdx}`] = { $type: 'color', $value: c }
      colorIdx++
    }
  }

  // Add primary/secondary/accent
  colorTokens['primary'] = { $type: 'color', $value: '#2dd4bf' }
  colorTokens['background'] = { $type: 'color', $value: project.settings.canvasBg || '#e0f2fe' }
  colorTokens['surface'] = { $type: 'color', $value: '#ffffff' }
  colorTokens['text-primary'] = { $type: 'color', $value: '#1a1a2e' }
  colorTokens['text-secondary'] = { $type: 'color', $value: '#6b7280' }

  const fontTokens: Record<string, { $type: string; $value: string }> = {}
  fontTokens['heading'] = { $type: 'fontFamily', $value: fonts.values().next().value || 'Inter' }
  fontTokens['body'] = { $type: 'fontFamily', $value: 'Inter' }
  let fontIdx = 0
  for (const f of fonts) {
    fontTokens[`font-${fontIdx}`] = { $type: 'fontFamily', $value: f }
    fontIdx++
  }

  return {
    $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
    color: colorTokens,
    typography: fontTokens,
    spacing: {
      'gap-sm': { $type: 'dimension', $value: '8px' },
      'gap-md': { $type: 'dimension', $value: '16px' },
      'gap-lg': { $type: 'dimension', $value: '24px' },
      'gap-xl': { $type: 'dimension', $value: '32px' },
    },
    borderRadius: {
      sm: { $type: 'dimension', $value: '4px' },
      md: { $type: 'dimension', $value: '6px' },
      lg: { $type: 'dimension', $value: '8px' },
      xl: { $type: 'dimension', $value: '12px' },
      '2xl': { $type: 'dimension', $value: '16px' },
    },
  }
}

// ─── Mood Description Generator ─────────────────────────────────────

export function generateMoodDescription(project: Project): string {
  const items = project.viewports.flatMap((v) => v.items)
  const summary = summarizeProject(items)
  const desc = describeBoard(items)

  // Extract color palette
  const colors: string[] = []
  for (const item of items) {
    if (item.kind === 'palette' && 'colors' in item) {
      for (const c of item.colors) colors.push(`${c.label || c.hex} (${c.hex})`)
    }
    if (item.kind === 'swatch' && 'hex' in item) {
      colors.push(`${item.name || item.hex} (${item.hex})`)
    }
  }

  // Extract fonts
  const fonts: string[] = []
  for (const item of items) {
    if (item.kind === 'font' && 'fontFamily' in item) {
      fonts.push(item.fontFamily)
    }
  }

  // Extract tags
  const allTags = new Set<string>()
  for (const item of items) {
    if ('tags' in item && item.tags) {
      for (const tag of item.tags) allTags.add(tag)
    }
  }

  // Extract purposes
  const purposes: string[] = []
  for (const item of items) {
    if ('purpose' in item && item.purpose) {
      purposes.push(item.purpose)
    }
  }

  const lines: string[] = [
    `# ${project.name}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    `Updated: ${project.updated}`,
    '',
    '## Summary',
    summary,
    '',
  ]

  if (colors.length > 0) {
    lines.push('## Color Palette')
    for (const c of colors.slice(0, 20)) lines.push(`- ${c}`)
    lines.push('')
  }

  if (fonts.length > 0) {
    lines.push('## Typography')
    for (const f of [...new Set(fonts)]) lines.push(`- ${f}`)
    lines.push('')
  }

  if (allTags.size > 0) {
    lines.push('## Themes & Tags')
    lines.push([...allTags].slice(0, 30).join(', '))
    lines.push('')
  }

  if (purposes.length > 0) {
    lines.push('## Purpose & Intent')
    for (const p of [...new Set(purposes)].slice(0, 10)) lines.push(`- ${p}`)
    lines.push('')
  }

  lines.push('## Board Contents')
  lines.push(desc)

  return lines.join('\n')
}

// ─── PNG Export (Transparent Background) ─────────────────────────────

export function exportCanvasAsPNG(canvasEl: HTMLCanvasElement): string {
  // Just export the canvas as-is (includes background)
  return canvasEl.toDataURL('image/png')
}

// ─── Full Export Bundle ──────────────────────────────────────────────

export interface ExportBundle {
  board_json: string
  tokens_json: string
  mood_md: string
  png_data_url: string
}

export async function exportForAI(
  project: Project,
  canvasEl: HTMLCanvasElement | null,
  generateMood?: (project: Project) => Promise<string>,
): Promise<ExportBundle> {
  // 1. Board JSON
  const boardJson = JSON.stringify(project, null, 2)

  // 2. Design tokens
  const tokens = extractDesignTokens(project)
  const tokensJson = JSON.stringify(tokens, null, 2)

  // 3. Mood description
  let moodMd: string
  if (generateMood) {
    moodMd = await generateMood(project)
  } else {
    moodMd = generateMoodDescription(project)
  }

  // 4. PNG snapshot
  let pngDataUrl = ''
  if (canvasEl) {
    pngDataUrl = exportCanvasAsPNG(canvasEl)
  }

  return {
    board_json: boardJson,
    tokens_json: tokensJson,
    mood_md: moodMd,
    png_data_url: pngDataUrl,
  }
}

// ─── Download Bundle ─────────────────────────────────────────────────

export function downloadExportBundle(bundle: ExportBundle, projectName: string) {
  const safeName = projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  // Download each file
  downloadFile(`${safeName}.json`, bundle.board_json, 'application/json')
  downloadFile(`${safeName}-tokens.json`, bundle.tokens_json, 'application/json')
  downloadFile(`${safeName}-mood.md`, bundle.mood_md, 'text/markdown')

  if (bundle.png_data_url) {
    downloadDataUrl(`${safeName}.png`, bundle.png_data_url)
  }
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function downloadDataUrl(name: string, dataUrl: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = name
  a.click()
}

// ─── Import from AI Format ───────────────────────────────────────────

export interface ImportResult {
  project: Project | null
  error?: string
}

export function importFromBundle(
  boardJson?: string,
  tokensJson?: string,
  moodMd?: string,
): ImportResult {
  if (!boardJson) {
    return { project: null, error: 'No board JSON provided' }
  }

  try {
    const project = JSON.parse(boardJson) as Project

    // Validate basic structure
    if (!project.id || !project.name || !project.viewports) {
      return { project: null, error: 'Invalid project structure' }
    }

    // Ensure required fields exist
    if (!project.components) project.components = []
    for (const vp of project.viewports) {
      if (!vp.connections) vp.connections = []
      if (!vp.messages) vp.messages = []
    }
    if (!project.settings) {
      project.settings = {
        apiKey: '',
        defaultModel: 'anthropic/claude-sonnet-4',
        jevThreshold: 0.2,
        multiAgent: false,
        theme: 'light',
        canvasBg: '#e0f2fe',
        canvasBgType: 'color',
        canvasBgVideo: '',
        customBgUrls: [],
      }
    }

    // If tokens provided, extract colors and apply to settings
    if (tokensJson) {
      try {
        const tokens = JSON.parse(tokensJson)
        if (tokens.color?.background?.$value) {
          project.settings.canvasBg = tokens.color.background.$value
        }
      } catch {
        // ignore token parse errors
      }
    }

    return { project }
  } catch (e) {
    return { project: null, error: `Failed to parse JSON: ${e}` }
  }
}

// ─── API Endpoint (for tool calling) ─────────────────────────────────

export function createExportAPI() {
  return {
    exportBoard: async (project: Project, canvasEl?: HTMLCanvasElement | null) => {
      return exportForAI(project, canvasEl || null)
    },

    extractTokens: (project: Project) => {
      return extractDesignTokens(project)
    },

    generateMood: (project: Project) => {
      return generateMoodDescription(project)
    },

    importBoard: (boardJson: string, tokensJson?: string) => {
      return importFromBundle(boardJson, tokensJson)
    },
  }
}
