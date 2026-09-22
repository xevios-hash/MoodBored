import { describe, it, expect } from 'vitest'
import { parseAgentActions, normalizeItem, searchItems, boardToMarkdown, parseActionsIncremental } from './api'
import type { BoardItem } from '@/types'

describe('parseAgentActions', () => {
  it('parses a single json block item', () => {
    const text = 'Here you go:\n```json\n{"kind":"note","text":"Hello"}\n```\nAdded!'
    const actions = parseAgentActions(text)
    expect(actions).toHaveLength(1)
    expect(actions[0]).toEqual({ type: 'add_item', item: expect.objectContaining({ kind: 'note', text: 'Hello' }) })
  })

  it('parses an array of items', () => {
    const text = '```json\n[{"kind":"note","text":"A"},{"kind":"palette","colors":[{"hex":"#fff"}]}]\n```'
    const actions = parseAgentActions(text)
    expect(actions).toHaveLength(2)
  })

  it('repairs trailing commas and single quotes', () => {
    const text = "```json\n{'kind':'note','text':'hello world',}\n```"
    const actions = parseAgentActions(text)
    expect(actions).toHaveLength(1)
    expect((actions[0] as any).item.text).toBe('hello world')
  })

  it('skips non-JSON code blocks', () => {
    const text = '```python\nprint("hi")\n```'
    expect(parseAgentActions(text)).toHaveLength(0)
  })

  it('does not double-parse consumed blocks', () => {
    const text = '```json\n[{"kind":"note","text":"A"}]\n``` rest'
    const first = parseActionsIncremental(text, 0)
    const second = parseActionsIncremental(text, first.consumedLength)
    expect(first.actions).toHaveLength(1)
    expect(second.actions).toHaveLength(0)
  })

  it('returns no actions for malformed json', () => {
    expect(parseAgentActions('```json\n{broken json\n```')).toHaveLength(0)
  })
})

describe('normalizeItem', () => {
  it('falls back to note kind for unknown types', () => {
    const item = normalizeItem({ type: 'mystery', text: 'hi' })
    expect(item.kind).toBe('note')
    expect((item as any).text).toBe('hi')
  })

  it('generates an id when missing', () => {
    const item = normalizeItem({ kind: 'note', text: 'x' })
    expect(item.id).toBeTruthy()
  })

  it('preserves provided id', () => {
    const item = normalizeItem({ kind: 'note', text: 'x', id: 'fixed-id' })
    expect(item.id).toBe('fixed-id')
  })

  it('coerces image alt keys to canonical fields', () => {
    const item = normalizeItem({ kind: 'image', thumbnailUrl: 'http://t', full_source: 'http://f', description: 'd' })
    expect(item).toEqual(expect.objectContaining({ thumbnail: 'http://t', fullSource: 'http://f' }))
  })

  it('repositions new items away from existing ones', () => {
    const existing = normalizeItem({ kind: 'note', text: 'a' }) as BoardItem
    const seen = existing as any
    seen.pos = { x: 100, y: 100 }
    const second = normalizeItem({ kind: 'note', text: 'b' }, [seen])
    // should not sit at exactly the same spot
    expect((second as any).pos).not.toEqual({ x: 100, y: 100 })
  })
})

describe('searchItems', () => {
  const items: BoardItem[] = [
    normalizeItem({ kind: 'note', text: 'beach sunset', tags: ['summer'] }),
    normalizeItem({ kind: 'note', text: 'nordic cabin', tags: ['winter'] }),
  ]

  it('matches query text', () => {
    expect(searchItems(items, 'beach')).toHaveLength(1)
  })

  it('matches tags exclusively', () => {
    expect(searchItems(items, '', 'winter')).toHaveLength(1)
  })

  it('combines query and tag', () => {
    expect(searchItems(items, 'cabin', 'summer')).toHaveLength(0)
    expect(searchItems(items, 'cabin', 'winter')).toHaveLength(1)
  })

  it('is case-insensitive', () => {
    expect(searchItems(items, 'NORDIC')).toHaveLength(1)
  })
})

describe('boardToMarkdown', () => {
  it('exports notes and palettes', () => {
    const items: BoardItem[] = [
      { kind: 'note', id: '1', text: 'hello', purpose: 'greeting', tags: ['a'] },
      { kind: 'palette', id: '2', label: 'P', colors: [{ hex: '#FF0000', label: 'Red' }], purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 }, size: { w: 1, h: 1 } },
    ] as any
    const md = boardToMarkdown(items)
    expect(md).toContain('# Mood Board Export')
    expect(md).toContain('hello')
    expect(md).toContain('#FF0000 Red')
  })
})
