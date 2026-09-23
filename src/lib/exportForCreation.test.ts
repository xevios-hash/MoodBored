import { describe, it, expect } from 'vitest'
import {
  compileCreationBrief, renderMarkdown, renderJSON, renderXML,
  CREATION_TYPES, type CreationType,
} from './exportForCreation'
import type { BoardItem } from '@/types'

const makeNote = (id: string, text: string, purpose = ''): BoardItem =>
  ({ kind: 'note', id, text, purpose, importance: '', tags: [], pos: { x: 0, y: 0 } }) as any

const makePalette = (id: string, colors: { hex: string; label: string }[]): BoardItem =>
  ({ kind: 'palette', id, label: 'Test', colors, purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 }, size: { w: 300, h: 100 } }) as any

const makeImage = (id: string, description: string, source: string): BoardItem =>
  ({ kind: 'image', id, description, source, fullSource: source, purpose: 'reference', importance: 'high', tags: ['mood'], pos: { x: 100, y: 100 }, size: { w: 300, h: 200 } }) as any

const makeFont = (id: string, family: string): BoardItem =>
  ({ kind: 'font', id, fontFamily: family, weights: [400, 700], sampleText: 'The quick brown fox', purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 }, size: { w: 300, h: 150 } }) as any

const items: BoardItem[] = [
  makeNote('n1', 'Golden hour serenity', 'Set the mood'),
  makePalette('p1', [{ hex: '#FF6B35', label: 'Sunset' }, { hex: '#004E89', label: 'Ocean' }]),
  makeImage('i1', 'Beach sunset', 'https://images.unsplash.com/photo-1?w=800'),
  makeFont('f1', 'Playfair Display'),
]

describe('compileCreationBrief', () => {
  it('extracts palette, typography, imagery, and notes from items', () => {
    const brief = compileCreationBrief(items, 'Coastal Board', 'general')
    expect(brief.palette).toHaveLength(2) // 2 palette colors
    expect(brief.typography).toHaveLength(1)
    expect(brief.imagery).toHaveLength(1)
    expect(brief.notes).toHaveLength(1)
    expect(brief.itemCount).toBe(4)
  })

  it('generates a meaningful summary', () => {
    const brief = compileCreationBrief(items, 'Coastal Board', 'general')
    expect(brief.summary).toContain('4 items')
    expect(brief.summary).toContain('#FF6B35')
    expect(brief.summary).toContain('Playfair Display')
  })

  it('captures the creation type and user prompt', () => {
    const brief = compileCreationBrief(items, 'Test', 'video', 'A cinematic sunset sequence')
    expect(brief.creationType).toBe('video')
    expect(brief.userPrompt).toBe('A cinematic sunset sequence')
  })

  it('tracks kind breakdown', () => {
    const brief = compileCreationBrief(items, 'Test', 'general')
    expect(brief.kindBreakdown.note).toBe(1)
    expect(brief.kindBreakdown.palette).toBe(1)
    expect(brief.kindBreakdown.image).toBe(1)
    expect(brief.kindBreakdown.font).toBe(1)
  })
})

describe('renderMarkdown', () => {
  it('produces a complete creative brief', () => {
    const brief = compileCreationBrief(items, 'Coastal Board', 'image', 'A dreamy beach scene')
    const md = renderMarkdown(brief)
    expect(md).toContain('Create a detailed image')
    expect(md).toContain('A dreamy beach scene')
    expect(md).toContain('#FF6B35')
    expect(md).toContain('Playfair Display')
    expect(md).toContain('Beach sunset')
    expect(md).toContain('Golden hour serenity')
    expect(md).toContain('## Instructions')
    expect(md).toContain('Spatial Layout')
  })

  it('includes creation-type-specific instructions', () => {
    const brief = compileCreationBrief(items, 'Test', 'game')
    const md = renderMarkdown(brief)
    expect(md).toContain('game prototype')
    expect(md).toContain('art style')
  })

  it('handles empty items gracefully', () => {
    const brief = compileCreationBrief([], 'Empty', 'general')
    const md = renderMarkdown(brief)
    expect(md).toContain('0 items')
    expect(md).not.toContain('## Color Palette')
  })
})

describe('renderJSON', () => {
  it('produces valid JSON with all fields', () => {
    const brief = compileCreationBrief(items, 'Test', 'web')
    const json = JSON.parse(renderJSON(brief))
    expect(json.version).toBe('1.0')
    expect(json.creationType).toBe('web')
    expect(json.palette).toHaveLength(2)
    expect(json.typography).toHaveLength(1)
  })
})

describe('renderXML', () => {
  it('produces well-formed XML', () => {
    const brief = compileCreationBrief(items, 'Test', '3d')
    const xml = renderXML(brief)
    expect(xml).toContain('<?xml version="1.0"')
    expect(xml).toContain('type="3d"')
    expect(xml).toContain('<palette>')
    expect(xml).toContain('#FF6B35')
    expect(xml).toContain('</creation-brief>')
  })
})

describe('CREATION_TYPES', () => {
  it('covers all8 creation types', () => {
    const types = Object.keys(CREATION_TYPES) as CreationType[]
    expect(types).toHaveLength(8)
    expect(types).toContain('image')
    expect(types).toContain('video')
    expect(types).toContain('game')
    expect(types).toContain('web')
    expect(types).toContain('3d')
    expect(types).toContain('audio')
    expect(types).toContain('document')
    expect(types).toContain('general')
  })

  it('each type has label, description, icon, and prompt templates', () => {
    for (const [key, meta] of Object.entries(CREATION_TYPES)) {
      expect(meta.label).toBeTruthy()
      expect(meta.description).toBeTruthy()
      expect(meta.icon).toBeTruthy()
      expect(meta.promptPrefix).toBeTruthy()
      expect(meta.promptSuffix).toBeTruthy()
    }
  })
})
