// Export for Creation — turns a mood board selection into a structured
// creative brief that any LLM can consume to produce real output.
//
// The key insight: a mood board is not the deliverable — it's the spec.
// This module extracts the spec and formats it for the creation target.

import type { BoardItem, PaletteItem, GradientItem, FontPreviewItem, ColorSwatchItem, SizeGuideItem, ContainerItem, ConnectorItem } from '@/types'

// ─── Creation Types ─────────────────────────────────────────────────

export type CreationType =
  | 'image'       // Midjourney, DALL-E, Stable Diffusion
  | 'video'       // Runway, Sora, Kling
  | 'game'        // Unity, Godot, web game
  | 'web'         // React, HTML/CSS, Framer
  | '3d'          // Blender, Three.js, Spline
  | 'audio'       // Music, SFX, voice
  | 'document'    // Report, presentation, pitch deck
  | 'general'     // Anything — let the LLM figure it out

export type ExportFormat = 'markdown' | 'json' | 'xml'

export interface CreationBrief {
  version: '1.0'
  creationType: CreationType
  userPrompt: string
  boardName: string
  summary: string
  palette: { hex: string; name: string; usage: string }[]
  typography: { family: string; weights: number[]; sample: string }[]
  imagery: { description: string; source: string; subject: string; mood: string }[]
  textures: { description: string; material: string }[]
  spatialLayout: { id: string; kind: string; x: number; y: number; w: number; h: number; group: string | null }[]
  connectors: { from: string; to: string; label: string }[]
  notes: { text: string; purpose: string; importance: string }[]
  videos: { subject: string; motion: string; source: string }[]
  containers: { label: string; layout: string; childCount: number }[]
  sizes: { width: number; height: number; unit: string; label: string }[]
  rawItems: BoardItem[]
  itemCount: number
  kindBreakdown: Record<string, number>
}

// ─── Creation Type Metadata ─────────────────────────────────────────

export const CREATION_TYPES: Record<CreationType, {
  label: string
  description: string
  icon: string
  promptPrefix: string
  promptSuffix: string
}> = {
  image: {
    label: 'Image',
    description: 'Generate images with Midjourney, DALL-E, or Stable Diffusion',
    icon: 'Image',
    promptPrefix: 'Create a detailed image based on this creative brief:',
    promptSuffix: 'Produce a single cohesive image that captures the mood, palette, and subject matter described above. Include specific composition notes, lighting direction, and style references.',
  },
  video: {
    label: 'Video',
    description: 'Produce video with Runway, Sora, or Kling',
    icon: 'Video',
    promptPrefix: 'Create a video based on this creative brief:',
    promptSuffix: 'Produce a video sequence that captures the mood and movement described above. Specify shot types, camera movement, pacing, color grading, and transitions. If generating with AI video tools, provide detailed scene descriptions for each key moment.',
  },
  game: {
    label: 'Game',
    description: 'Build a game prototype with Unity, Godot, or web tech',
    icon: 'Gamepad2',
    promptPrefix: 'Build a game prototype based on this creative brief:',
    promptSuffix: 'Create a playable prototype that embodies the visual direction and mood described above. Define the art style, UI color scheme, typography for HUD/menus, character/environment descriptions, and core gameplay loop that matches the creative tone.',
  },
  web: {
    label: 'Web',
    description: 'Build a website or web app with React, HTML/CSS, or Framer',
    icon: 'Globe',
    promptPrefix: 'Build a website based on this creative brief:',
    promptSuffix: 'Create a responsive website that implements the design direction above. Define the color system (as CSS variables), typography scale, component library (buttons, cards, inputs, navigation), layout grid, spacing system, and interactive states (hover, focus, active). Output production-ready code.',
  },
  '3d': {
    label: '3D',
    description: 'Create 3D scenes with Blender, Three.js, or Spline',
    icon: 'Box',
    promptPrefix: 'Create a 3D scene based on this creative brief:',
    promptSuffix: 'Model and render a 3D scene that captures the mood, materials, and spatial relationships described above. Define material properties (roughness, metallic, emission), lighting setup (HDRI, key/fill/rim), camera angles, and post-processing effects.',
  },
  audio: {
    label: 'Audio',
    description: 'Compose music or design sound with AI audio tools',
    icon: 'Music',
    promptPrefix: 'Create audio based on this creative brief:',
    promptSuffix: 'Compose a piece of audio (music, soundscape, or sound design) that captures the mood and energy described above. Specify tempo, key, instrumentation, dynamics, and reference tracks. If generating sound effects, describe the acoustic properties and context of use.',
  },
  document: {
    label: 'Document',
    description: 'Generate a report, pitch deck, or presentation',
    icon: 'FileText',
    promptPrefix: 'Create a document based on this creative brief:',
    promptSuffix: 'Produce a polished document (presentation, pitch deck, or report) that implements the visual direction above. Define slide/page layouts, typography hierarchy, data visualization style, image treatment, and the narrative structure that carries the creative mood through the document.',
  },
  general: {
    label: 'General',
    description: 'Open-ended creative brief — let the LLM decide',
    icon: 'Sparkles',
    promptPrefix: 'Here is a creative brief from a mood board session:',
    promptSuffix: 'Based on this creative direction, propose what to create and execute it. Consider the mood, palette, typography, and spatial relationships to produce something that captures the essence of this board.',
  },
}

// ─── Compilation ────────────────────────────────────────────────────

export function compileCreationBrief(
  items: BoardItem[],
  boardName: string,
  creationType: CreationType,
  userPrompt: string = '',
): CreationBrief {
  const nonConnectors = items.filter(i => i.kind !== 'connector')

  // Extract palette
  const palette: CreationBrief['palette'] = []
  for (const item of nonConnectors) {
    if (item.kind === 'palette') {
      for (const c of (item as PaletteItem).colors) {
        palette.push({ hex: c.hex, name: c.label || '', usage: '' })
      }
    }
    if (item.kind === 'swatch') {
      const s = item as ColorSwatchItem
      palette.push({ hex: s.hex, name: s.name || '', usage: s.usage || '' })
    }
    if (item.kind === 'gradient') {
      const g = item as GradientItem
      for (const stop of g.stops) {
        palette.push({ hex: stop.color, name: '', usage: `gradient stop at ${Math.round(stop.position * 100)}%` })
      }
    }
  }

  // Extract typography
  const typography: CreationBrief['typography'] = []
  for (const item of nonConnectors) {
    if (item.kind === 'font') {
      const f = item as FontPreviewItem
      typography.push({ family: f.fontFamily, weights: f.weights, sample: f.sampleText })
    }
  }

  // Extract imagery
  const imagery: CreationBrief['imagery'] = []
  for (const item of nonConnectors) {
    if (item.kind === 'image') {
      imagery.push({
        description: item.description,
        source: item.source || item.fullSource || '',
        subject: item.description,
        mood: [item.purpose, item.importance].filter(Boolean).join(' · '),
      })
    }
  }

  // Extract videos
  const videos: CreationBrief['videos'] = []
  for (const item of nonConnectors) {
    if (item.kind === 'video') {
      videos.push({
        subject: item.subjectDesc,
        motion: item.motionDesc,
        source: item.sourceUrl || '',
      })
    }
  }

  // Extract notes
  const notes: CreationBrief['notes'] = []
  for (const item of nonConnectors) {
    if (item.kind === 'note' || item.kind === 'text') {
      notes.push({
        text: ('text' in item ? item.text : '') || ('raw' in item ? (item as any).raw : ''),
        purpose: ('purpose' in item ? item.purpose : '') || '',
        importance: ('importance' in item ? item.importance : '') || '',
      })
    }
  }

  // Extract sizes
  const sizes: CreationBrief['sizes'] = []
  for (const item of nonConnectors) {
    if (item.kind === 'sizeguide') {
      const s = item as SizeGuideItem
      sizes.push({ width: s.width, height: s.height, unit: s.unit, label: s.label })
    }
  }

  // Extract containers
  const containers: CreationBrief['containers'] = []
  for (const item of nonConnectors) {
    if (item.kind === 'container') {
      const c = item as ContainerItem
      containers.push({ label: c.label, layout: c.layout, childCount: c.children?.length || 0 })
    }
  }

  // Extract connectors
  const connectors: CreationBrief['connectors'] = []
  for (const item of items) {
    if (item.kind === 'connector') {
      const c = item as ConnectorItem
      connectors.push({ from: c.fromId, to: c.toId, label: c.label })
    }
  }

  // Spatial layout (with container grouping)
  const containerMembership = new Map<string, string>()
  for (const item of nonConnectors) {
    if (item.kind === 'container') {
      const c = item as ContainerItem
      for (const child of c.children || []) {
        containerMembership.set(child.id, c.label)
      }
    }
  }
  const spatialLayout: CreationBrief['spatialLayout'] = nonConnectors
    .filter(i => 'pos' in i)
    .map(i => ({
      id: i.id,
      kind: i.kind,
      x: Math.round(i.pos.x),
      y: Math.round(i.pos.y),
      w: Math.round((i as any).size?.w ?? 250),
      h: Math.round((i as any).size?.h ?? 150),
      group: containerMembership.get(i.id) ?? null,
    }))

  // Kind breakdown
  const kindBreakdown: Record<string, number> = {}
  for (const item of nonConnectors) {
    kindBreakdown[item.kind] = (kindBreakdown[item.kind] || 0) + 1
  }

  // Generate summary
  const parts = Object.entries(kindBreakdown).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`)
  const summary = `Board "${boardName}" contains ${nonConnectors.length} items: ${parts.join(', ')}.` +
    (palette.length > 0 ? ` Palette: ${palette.map(p => p.hex).slice(0, 5).join(', ')}.` : '') +
    (typography.length > 0 ? ` Typography: ${typography.map(t => t.family).join(', ')}.` : '') +
    (imagery.length > 0 ? ` Imagery: ${imagery.length} reference images.` : '')

  return {
    version: '1.0',
    creationType,
    userPrompt,
    boardName,
    summary,
    palette,
    typography,
    imagery,
    textures: [],
    spatialLayout,
    connectors,
    notes,
    videos,
    containers,
    sizes,
    rawItems: items,
    itemCount: nonConnectors.length,
    kindBreakdown,
  }
}

// ─── Renderers ──────────────────────────────────────────────────────

export function renderMarkdown(brief: CreationBrief): string {
  const meta = CREATION_TYPES[brief.creationType]
  const lines: string[] = []

  // Header + system context
  lines.push(meta.promptPrefix)
  lines.push('')

  if (brief.userPrompt) {
    lines.push(`**User direction:** ${brief.userPrompt}`)
    lines.push('')
  }

  // Board summary
  lines.push('## Creative Direction')
  lines.push(brief.summary)
  lines.push('')

  // Palette
  if (brief.palette.length > 0) {
    lines.push('## Color Palette')
    for (const c of brief.palette) {
      const usage = c.usage ? ` — ${c.usage}` : ''
      const name = c.name ? ` (${c.name})` : ''
      lines.push(`- \`${c.hex}\`${name}${usage}`)
    }
    lines.push('')
  }

  // Typography
  if (brief.typography.length > 0) {
    lines.push('## Typography')
    for (const t of brief.typography) {
      lines.push(`- **${t.family}** (weights: ${t.weights.join(', ')}) — sample: "${t.sample}"`)
    }
    lines.push('')
  }

  // Imagery
  if (brief.imagery.length > 0) {
    lines.push('## Visual References')
    for (const img of brief.imagery) {
      lines.push(`- ${img.description}${img.source ? ` — ${img.source}` : ''}`)
      if (img.mood) lines.push(`  Mood: ${img.mood}`)
    }
    lines.push('')
  }

  // Videos
  if (brief.videos.length > 0) {
    lines.push('## Motion References')
    for (const v of brief.videos) {
      lines.push(`- **Subject:** ${v.subject}`)
      if (v.motion) lines.push(`  **Movement:** ${v.motion}`)
      if (v.source) lines.push(`  **Source:** ${v.source}`)
    }
    lines.push('')
  }

  // Notes
  if (brief.notes.length > 0) {
    lines.push('## Creative Notes')
    for (const n of brief.notes) {
      lines.push(`- ${n.text}`)
      if (n.purpose) lines.push(`  Purpose: ${n.purpose}`)
      if (n.importance) lines.push(`  Importance: ${n.importance}`)
    }
    lines.push('')
  }

  // Sizes / constraints
  if (brief.sizes.length > 0) {
    lines.push('## Dimensions')
    for (const s of brief.sizes) {
      lines.push(`- ${s.label}: ${s.width}x${s.height}${s.unit}`)
    }
    lines.push('')
  }

  // Containers (grouping context)
  if (brief.containers.length > 0) {
    lines.push('## Groupings')
    for (const c of brief.containers) {
      lines.push(`- **${c.label}** (${c.layout} layout, ${c.childCount} items)`)
    }
    lines.push('')
  }

  // Spatial relationships
  if (brief.connectors.length > 0) {
    lines.push('## Relationships')
    for (const c of brief.connectors) {
      lines.push(`- ${c.from} → ${c.to}: ${c.label || 'linked'}`)
    }
    lines.push('')
  }

  // Creation-specific suffix
  lines.push('## Instructions')
  lines.push(meta.promptSuffix)
  lines.push('')

  // Spatial layout data (for LLMs that need positional context)
  if (brief.spatialLayout.length > 0) {
    lines.push('<details>')
    lines.push('<summary>Spatial Layout (positions on canvas)</summary>')
    lines.push('')
    lines.push('| Kind | Position | Size | Group |')
    lines.push('|------|----------|------|-------|')
    for (const s of brief.spatialLayout) {
      lines.push(`| ${s.kind} | (${s.x}, ${s.y}) | ${s.w}x${s.h} | ${s.group || '—'} |`)
    }
    lines.push('</details>')
    lines.push('')
  }

  return lines.join('\n')
}

export function renderJSON(brief: CreationBrief): string {
  return JSON.stringify(brief, null, 2)
}

export function renderXML(brief: CreationBrief): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>']
  lines.push(`<creation-brief version="1.0" type="${brief.creationType}">`)
  if (brief.userPrompt) lines.push(`  <user-prompt>${escape(brief.userPrompt)}</user-prompt>`)
  lines.push(`  <board-name>${escape(brief.boardName)}</board-name>`)
  lines.push(`  <summary>${escape(brief.summary)}</summary>`)

  if (brief.palette.length > 0) {
    lines.push('  <palette>')
    for (const c of brief.palette) {
      lines.push(`    <color hex="${c.hex}" name="${escape(c.name)}" usage="${escape(c.usage)}" />`)
    }
    lines.push('  </palette>')
  }

  if (brief.typography.length > 0) {
    lines.push('  <typography>')
    for (const t of brief.typography) {
      lines.push(`    <font family="${escape(t.family)}" weights="${t.weights.join(',')}" sample="${escape(t.sample)}" />`)
    }
    lines.push('  </typography>')
  }

  if (brief.notes.length > 0) {
    lines.push('  <notes>')
    for (const n of brief.notes) {
      lines.push(`    <note text="${escape(n.text)}" purpose="${escape(n.purpose)}" importance="${escape(n.importance)}" />`)
    }
    lines.push('  </notes>')
  }

  lines.push(`  <instructions>${escape(CREATION_TYPES[brief.creationType].promptSuffix)}</instructions>`)
  lines.push('</creation-brief>')
  return lines.join('\n')
}

// ─── Clipboard / Download ───────────────────────────────────────────

export async function copyBriefToClipboard(brief: CreationBrief, format: ExportFormat): Promise<void> {
  const content = render(brief, format)
  await navigator.clipboard.writeText(content)
}

export function downloadBrief(brief: CreationBrief, format: ExportFormat): void {
  const content = render(brief, format)
  const ext = format === 'json' ? 'json' : format === 'xml' ? 'xml' : 'md'
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${brief.boardName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-brief.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function render(brief: CreationBrief, format: ExportFormat): string {
  switch (format) {
    case 'json': return renderJSON(brief)
    case 'xml': return renderXML(brief)
    case 'markdown': return renderMarkdown(brief)
  }
}
