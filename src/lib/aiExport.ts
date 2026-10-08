// AI-Optimized Export Formats
// Converts mood board content into formats that different AI models can understand

import type { BoardItem, Project } from '@/types'

// ─── Export Format Types ────────────────────────────────────────────

export type AIExportFormat =
  | 'sd-prompt'        // Stable Diffusion / ComfyUI
  | 'midjourney'       // Midjourney
  | 'dalle'            // DALL-E 3
  | 'flux'             // Flux models
  | 'video-scene'      // Video models (Runway, Pika, Sora)
  | 'llm-context'      // LLM structured context
  | 'design-tokens'    // Figma, CSS variables
  | 'comfyui-workflow'  // ComfyUI workflow JSON
  | 'markdown'         // Rich markdown for any LLM

export interface ExportOptions {
  format: AIExportFormat
  includeImages: boolean
  includeColors: boolean
  includeTypography: boolean
  includeNotes: boolean
  style?: string           // Additional style keywords
  negativePrompt?: string  // For image gen
  aspectRatio?: string     // e.g., "16:9", "1:1"
  quality?: 'draft' | 'standard' | 'high'
}

// ─── Color Analysis ─────────────────────────────────────────────────

interface ColorInfo {
  hex: string
  name: string
  hue: string
  saturation: string
  lightness: string
  mood: string
}

function analyzeColor(hex: string): ColorInfo {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  const hue = Math.round(h * 360)
  const satPercent = Math.round(s * 100)
  const lightPercent = Math.round(l * 100)

  // Determine hue name
  let hueName = 'neutral'
  if (hue < 15 || hue >= 345) hueName = 'red'
  else if (hue < 45) hueName = 'orange'
  else if (hue < 75) hueName = 'yellow'
  else if (hue < 150) hueName = 'green'
  else if (hue < 210) hueName = 'cyan'
  else if (hue < 270) hueName = 'blue'
  else if (hue < 345) hueName = 'purple'

  // Determine mood
  let mood = 'neutral'
  if (lightPercent > 70) mood = 'bright'
  else if (lightPercent < 30) mood = 'dark'
  if (satPercent > 70) mood = 'vibrant'
  else if (satPercent < 30) mood = 'muted'

  return {
    hex,
    name: `${hueName} ${mood}`,
    hue: hueName,
    saturation: satPercent > 70 ? 'high' : satPercent > 30 ? 'medium' : 'low',
    lightness: lightPercent > 70 ? 'light' : lightPercent > 30 ? 'mid' : 'dark',
    mood,
  }
}

// ─── Extract Board Content ──────────────────────────────────────────

interface BoardContent {
  colors: ColorInfo[]
  images: { url: string; description: string; style?: string }[]
  notes: string[]
  tags: string[]
  fonts: string[]
  gradients: { stops: string[]; direction: number }[]
  links: { url: string; title: string; summary: string }[]
}

function extractContent(items: BoardItem[]): BoardContent {
  const content: BoardContent = {
    colors: [],
    images: [],
    notes: [],
    tags: [],
    fonts: [],
    gradients: [],
    links: [],
  }

  for (const item of items) {
    switch (item.kind) {
      case 'palette':
        for (const color of item.colors || []) {
          content.colors.push(analyzeColor(color.hex))
        }
        break

      case 'swatch':
        content.colors.push(analyzeColor(item.hex))
        break

      case 'gradient':
        content.gradients.push({
          stops: item.stops?.map(s => s.color) || [],
          direction: item.direction || 0,
        })
        break

      case 'image':
        content.images.push({
          url: item.thumbnail || item.fullSource || '',
          description: item.description || '',
          style: item.purpose || '',
        })
        break

      case 'note':
        const noteText = (item as any).text || ''
        if (noteText.trim()) content.notes.push(noteText)
        break
      case 'text':
        const rawText = (item as any).raw || ''
        if (rawText.trim()) content.notes.push(rawText)
        break

      case 'font':
        content.fonts.push(item.fontFamily || 'Inter')
        break

      case 'link':
        content.links.push({
          url: item.url || '',
          title: item.title || '',
          summary: item.summary || '',
        })
        break
    }

    // Extract tags
    if ('tags' in item && item.tags) {
      const tags = Array.isArray(item.tags) ? item.tags : [item.tags]
      content.tags.push(...tags)
    }
  }

  return content
}

// ─── Stable Diffusion / ComfyUI Export ──────────────────────────────

export function exportForStableDiffusion(project: Project, options: ExportOptions): string {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  // Build positive prompt
  const parts: string[] = []

  // Style keywords from notes
  const styleKeywords = content.notes
    .join(' ')
    .split(/[,.\s]+/)
    .filter(w => w.length > 3)
    .slice(0, 10)
  if (styleKeywords.length > 0) {
    parts.push(styleKeywords.join(', '))
  }

  // Color mood
  if (content.colors.length > 0) {
    const moods = [...new Set(content.colors.map(c => c.mood))]
    const hues = [...new Set(content.colors.map(c => c.hue))]
    parts.push(`${moods.join(', ')} color palette`)
    parts.push(`${hues.join(' and ')} tones`)
  }

  // Add custom style
  if (options.style) {
    parts.push(options.style)
  }

  // Quality modifiers
  const qualityMods = {
    draft: 'sketch, rough',
    standard: 'detailed, high quality',
    high: 'masterpiece, best quality, 8k, ultra detailed, photorealistic',
  }
  parts.push(qualityMods[options.quality || 'standard'])

  const positivePrompt = parts.filter(Boolean).join(', ')

  // Build negative prompt
  const negativePrompt = options.negativePrompt ||
    'low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, signature'

  // Format output
  let output = `# Stable Diffusion Prompt\n\n`
  output += `## Positive Prompt\n\`\`\`\n${positivePrompt}\n\`\`\`\n\n`
  output += `## Negative Prompt\n\`\`\`\n${negativePrompt}\n\`\`\`\n\n`

  if (content.colors.length > 0) {
    output += `## Color Palette\n`
    for (const color of content.colors.slice(0, 8)) {
      output += `- ${color.hex} (${color.name})\n`
    }
    output += `\n`
  }

  if (content.images.length > 0) {
    output += `## Reference Images\n`
    for (const img of content.images.slice(0, 5)) {
      output += `- ${img.url}${img.description ? ` — ${img.description}` : ''}\n`
    }
    output += `\n`
  }

  output += `## ComfyUI Parameters\n\`\`\`json\n`
  output += JSON.stringify({
    positive: positivePrompt,
    negative: negativePrompt,
    steps: options.quality === 'high' ? 30 : options.quality === 'draft' ? 15 : 20,
    cfg_scale: 7,
    width: 1024,
    height: 1024,
    sampler: 'euler_a',
    seed: -1,
  }, null, 2)
  output += `\n\`\`\`\n`

  return output
}

// ─── Midjourney Export ──────────────────────────────────────────────

export function exportForMidjourney(project: Project, options: ExportOptions): string {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  const parts: string[] = []

  // Main subject from notes
  const subject = content.notes[0]?.slice(0, 100) || 'abstract design'
  parts.push(subject)

  // Style descriptors
  if (content.colors.length > 0) {
    const hues = [...new Set(content.colors.map(c => c.hue))]
    parts.push(`${hues.join(' and ')} color scheme`)
  }

  // Add custom style
  if (options.style) {
    parts.push(options.style)
  }

  // Midjourney parameters
  const params: string[] = []
  if (options.aspectRatio) {
    params.push(`--ar ${options.aspectRatio}`)
  } else {
    params.push('--ar 1:1')
  }
  params.push('--v 6')
  params.push('--style raw')

  if (options.quality === 'high') {
    params.push('--q 2')
  }

  const prompt = `${parts.join(', ')} ${params.join(' ')}`

  let output = `# Midjourney Prompt\n\n`
  output += `## Main Prompt\n\`\`\`\n${prompt}\n\`\`\`\n\n`

  // Variations
  output += `## Variations\n`
  output += `1. **Photorealistic**: ${prompt} --style raw --v 6\n`
  output += `2. **Artistic**: ${prompt} --style scenic --v 6\n`
  output += `3. **Anime**: ${prompt} --niji 6\n\n`

  if (content.colors.length > 0) {
    output += `## Color References\n`
    const hexCodes = content.colors.slice(0, 6).map(c => c.hex)
    output += `Use these colors: ${hexCodes.join(', ')}\n\n`
  }

  if (content.images.length > 0) {
    output += `## Image References (use --sref)\n`
    for (const img of content.images.slice(0, 3)) {
      output += `- ${img.url}\n`
    }
  }

  return output
}

// ─── DALL-E Export ──────────────────────────────────────────────────

export function exportForDALLE(project: Project, options: ExportOptions): string {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  // DALL-E works best with natural language descriptions
  let description = ''

  if (content.notes.length > 0) {
    description = content.notes.join('. ').slice(0, 500)
  } else {
    description = 'A creative visual composition'
  }

  // Add color context
  if (content.colors.length > 0) {
    const colorDesc = content.colors
      .slice(0, 4)
      .map(c => `${c.lightness} ${c.hue}`)
      .join(', ')
    description += `. Color palette: ${colorDesc}`
  }

  let output = `# DALL-E 3 Prompt\n\n`
  output += `## Natural Language Prompt\n`
  output += `"${description}"\n\n`

  output += `## Refinements\n`
  output += `- **Style**: ${options.style || 'digital art, professional design'}\n`
  output += `- **Quality**: ${options.quality === 'high' ? 'hd' : 'standard'}\n`
  output += `- **Size**: ${options.aspectRatio === '16:9' ? '1792x1024' : options.aspectRatio === '9:16' ? '1024x1792' : '1024x1024'}\n\n`

  if (content.colors.length > 0) {
    output += `## Color Hex Codes\n`
    output += content.colors.slice(0, 6).map(c => c.hex).join(', ') + '\n'
  }

  return output
}

// ─── Video Model Export ─────────────────────────────────────────────

export function exportForVideo(project: Project, options: ExportOptions): string {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  let output = `# Video Generation Prompt\n\n`

  // Scene description
  output += `## Scene Description\n`
  if (content.notes.length > 0) {
    output += content.notes.join('\n') + '\n\n'
  }

  // Visual style
  output += `## Visual Style\n`
  if (content.colors.length > 0) {
    const moods = [...new Set(content.colors.map(c => c.mood))]
    output += `- **Mood**: ${moods.join(', ')}\n`
  }
  if (content.fonts.length > 0) {
    output += `- **Typography**: ${content.fonts.join(', ')}\n`
  }
  output += `- **Style**: ${options.style || 'cinematic, professional'}\n\n`

  // Camera suggestions
  output += `## Suggested Camera Movements\n`
  output += `- Slow pan across elements\n`
  output += `- Zoom in on key details\n`
  output += `- Smooth transitions between scenes\n\n`

  // Color grading
  if (content.colors.length > 0) {
    output += `## Color Grading Reference\n`
    for (const color of content.colors.slice(0, 6)) {
      output += `- ${color.hex} (${color.name})\n`
    }
    output += `\n`
  }

  // Scene breakdown
  output += `## Scene Breakdown\n`
  const scenes = content.images.slice(0, 5)
  if (scenes.length > 0) {
    scenes.forEach((img, i) => {
      output += `### Scene ${i + 1}\n`
      output += `- **Description**: ${img.description || 'Visual element'}\n`
      if (img.url) output += `- **Reference**: ${img.url}\n`
      output += `- **Duration**: 2-3 seconds\n\n`
    })
  } else {
    output += `1. Opening shot — establish mood\n`
    output += `2. Main content — showcase elements\n`
    output += `3. Closing — final composition\n\n`
  }

  // Platform-specific formats
  output += `## Platform Formats\n`
  output += `- **Runway Gen-3**: Use scene descriptions above\n`
  output += `- **Pika**: Shorten to key phrases\n`
  output += `- **Sora**: Use full natural language descriptions\n`
  output += `- **Kling**: Focus on motion descriptions\n`

  return output
}

// ─── LLM Context Export ─────────────────────────────────────────────

export function exportForLLM(project: Project, options: ExportOptions): string {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  let output = `# Mood Board Context\n\n`
  output += `**Project**: ${project.name}\n`
  output += `**Items**: ${items.length}\n\n`

  // Summary
  output += `## Summary\n`
  output += `This mood board contains ${content.colors.length} colors, ${content.images.length} images, `
  output += `${content.notes.length} notes, and ${content.fonts.length} fonts.\n\n`

  // Colors
  if (content.colors.length > 0) {
    output += `## Color Palette\n`
    for (const color of content.colors) {
      output += `- ${color.hex} — ${color.name} (${color.mood})\n`
    }
    output += `\n`
  }

  // Images
  if (content.images.length > 0) {
    output += `## Visual References\n`
    for (const img of content.images) {
      output += `- ${img.description || 'Image'}${img.url ? ` (${img.url})` : ''}\n`
    }
    output += `\n`
  }

  // Notes
  if (content.notes.length > 0) {
    output += `## Notes & Ideas\n`
    for (const note of content.notes) {
      output += `- ${note}\n`
    }
    output += `\n`
  }

  // Typography
  if (content.fonts.length > 0) {
    output += `## Typography\n`
    for (const font of content.fonts) {
      output += `- ${font}\n`
    }
    output += `\n`
  }

  // Tags
  if (content.tags.length > 0) {
    const uniqueTags = [...new Set(content.tags)]
    output += `## Tags\n${uniqueTags.join(', ')}\n\n`
  }

  // Instructions for AI
  output += `## Instructions\n`
  output += `Use this context to understand the creative direction. `
  output += `Maintain consistency with the color palette, style, and mood described above.\n`

  return output
}

// ─── Design Tokens Export ───────────────────────────────────────────

export function exportDesignTokens(project: Project, options: ExportOptions): string {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  // CSS Variables
  let css = `/* Design Tokens — ${project.name} */\n:root {\n`

  // Colors
  content.colors.forEach((color, i) => {
    css += `  --color-${i + 1}: ${color.hex};\n`
  })
  css += `\n`

  // Typography
  content.fonts.forEach((font, i) => {
    css += `  --font-${i + 1}: '${font}', sans-serif;\n`
  })
  css += `}\n\n`

  // Tailwind config
  let tailwind = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n`
  content.colors.forEach((color, i) => {
    tailwind += `        'brand-${i + 1}': '${color.hex}',\n`
  })
  tailwind += `      },\n      fontFamily: {\n`
  content.fonts.forEach((font, i) => {
    tailwind += `        'custom-${i + 1}': ['${font}', 'sans-serif'],\n`
  })
  tailwind += `      },\n    },\n  },\n}\n`

  // JSON tokens
  const tokens = {
    colors: content.colors.map(c => ({ hex: c.hex, name: c.name, mood: c.mood })),
    typography: content.fonts.map(f => ({ family: f, fallback: 'sans-serif' })),
    spacing: { unit: '8px', scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32] },
  }

  let output = `# Design Tokens — ${project.name}\n\n`
  output += `## CSS Variables\n\`\`\`css\n${css}\`\`\`\n\n`
  output += `## Tailwind Config\n\`\`\`javascript\n${tailwind}\`\`\`\n\n`
  output += `## JSON Tokens\n\`\`\`json\n${JSON.stringify(tokens, null, 2)}\n\`\`\`\n`

  return output
}

// ─── Markdown Export ────────────────────────────────────────────────

export function exportMarkdown(project: Project, options: ExportOptions): string {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  let md = `# ${project.name}\n\n`
  md += `> Mood board with ${items.length} items\n\n`

  // Table of contents
  md += `## Contents\n`
  if (content.colors.length > 0) md += `- [Colors](#colors)\n`
  if (content.images.length > 0) md += `- [Images](#images)\n`
  if (content.notes.length > 0) md += `- [Notes](#notes)\n`
  if (content.fonts.length > 0) md += `- [Typography](#typography)\n`
  md += `\n---\n\n`

  // Colors
  if (content.colors.length > 0) {
    md += `## Colors\n\n`
    md += `| Hex | Name | Mood |\n|-----|------|------|\n`
    for (const color of content.colors) {
      md += `| \`${color.hex}\` | ${color.name} | ${color.mood} |\n`
    }
    md += `\n`
  }

  // Images
  if (content.images.length > 0) {
    md += `## Images\n\n`
    for (const img of content.images) {
      if (img.url) md += `![${img.description || 'Image'}](${img.url})\n`
      if (img.description) md += `*${img.description}*\n\n`
    }
  }

  // Notes
  if (content.notes.length > 0) {
    md += `## Notes\n\n`
    for (const note of content.notes) {
      md += `- ${note}\n`
    }
    md += `\n`
  }

  // Typography
  if (content.fonts.length > 0) {
    md += `## Typography\n\n`
    for (const font of content.fonts) {
      md += `- **${font}**\n`
    }
    md += `\n`
  }

  return md
}

// ─── ComfyUI Workflow Export ────────────────────────────────────────

export function exportComfyUIWorkflow(project: Project, options: ExportOptions): object {
  const items = project.viewports?.[0]?.items || []
  const content = extractContent(items)

  const styleKeywords = content.notes.join(' ').split(/[,.\s]+/).filter(w => w.length > 3).slice(0, 10).join(', ')
  const colorMood = content.colors.map(c => c.mood).join(', ')

  // ComfyUI workflow structure
  return {
    last_node_id: 10,
    last_link_id: 10,
    nodes: [
      {
        id: 1,
        type: 'KSampler',
        pos: [800, 200],
        size: [300, 300],
        properties: { 'Node name for S&R': 'KSampler' },
        widgets_values: [
          options.quality === 'high' ? 30 : 20,  // steps
          7,  // cfg
          'euler',  // sampler
          'normal',  // scheduler
          1,  // denoise
        ],
      },
      {
        id: 2,
        type: 'CLIPTextEncode',
        pos: [400, 300],
        size: [300, 100],
        properties: { 'Node name for S&R': 'CLIPTextEncode' },
        widgets_values: [
          `${styleKeywords}, ${colorMood} color palette, ${options.style || 'professional design'}, masterpiece, best quality`,
        ],
      },
      {
        id: 3,
        type: 'CLIPTextEncode',
        pos: [400, 500],
        size: [300, 100],
        properties: { 'Node name for S&R': 'CLIPTextEncode' },
        widgets_values: [
          options.negativePrompt || 'low quality, blurry, distorted, ugly',
        ],
      },
    ],
    links: [
      [1, 2, 0, 1, 0, 'CONDITIONING'],
      [2, 3, 0, 1, 1, 'CONDITIONING'],
    ],
    groups: [],
    config: {},
    extra: {
      info: `Exported from MoodBored — ${project.name}`,
    },
  }
}

// ─── Main Export Function ───────────────────────────────────────────

export function exportForAI(project: Project, options: ExportOptions): string | object {
  switch (options.format) {
    case 'sd-prompt':
      return exportForStableDiffusion(project, options)
    case 'midjourney':
      return exportForMidjourney(project, options)
    case 'dalle':
      return exportForDALLE(project, options)
    case 'flux':
      return exportForStableDiffusion(project, options) // Flux uses similar format
    case 'video-scene':
      return exportForVideo(project, options)
    case 'llm-context':
      return exportForLLM(project, options)
    case 'design-tokens':
      return exportDesignTokens(project, options)
    case 'comfyui-workflow':
      return exportComfyUIWorkflow(project, options)
    case 'markdown':
      return exportMarkdown(project, options)
    default:
      return exportForLLM(project, options)
  }
}

export function getFormatDescription(format: AIExportFormat): string {
  const descriptions: Record<AIExportFormat, string> = {
    'sd-prompt': 'Optimized for Stable Diffusion, ComfyUI, and Flux models',
    'midjourney': 'Midjourney-style prompts with parameters (--ar, --v, --style)',
    'dalle': 'Natural language descriptions for DALL-E 3',
    'flux': 'Optimized for Flux models',
    'video-scene': 'Scene descriptions for Runway, Pika, Sora, Kling',
    'llm-context': 'Structured context for any LLM (Claude, GPT, Gemini)',
    'design-tokens': 'CSS variables, Tailwind config, JSON tokens',
    'comfyui-workflow': 'Full ComfyUI workflow JSON',
    'markdown': 'Rich markdown with images, colors, and notes',
  }
  return descriptions[format] || ''
}

export function getFormatIcon(format: AIExportFormat): string {
  const icons: Record<AIExportFormat, string> = {
    'sd-prompt': '🎨',
    'midjourney': '🖌️',
    'dalle': '🖼️',
    'flux': '⚡',
    'video-scene': '🎬',
    'llm-context': '🤖',
    'design-tokens': '🎯',
    'comfyui-workflow': '🔧',
    'markdown': '📝',
  }
  return icons[format] || '📄'
}
