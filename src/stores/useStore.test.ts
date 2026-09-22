import { describe, it, expect } from 'vitest'
import { useStore } from './useStore'
import type { BoardItem } from '@/types'

function note(id: string, text = 'x'): BoardItem {
  return { kind: 'note', id, text, purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 } } as any
}

describe('project import/export', () => {
  it('accepts valid project json', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p1', name: 'Test', created: 'now', updated: 'now',
      viewports: [{ id: 'v1', name: 'Main', items: [note('i1')], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
      components: [],
    }))
    expect(ok).toBe(true)
    expect(useStore.getState().project.name).toBe('Test')
  })

  it('rejects malformed project json', () => {
    expect(useStore.getState().importProject('not json')).toBe(false)
    expect(useStore.getState().importProject(JSON.stringify({ id: 'x' }))).toBe(false)
  })

  it('strips api keys from imported settings', () => {
    useStore.getState().importProject(JSON.stringify({
      id: 'p2', name: 'Evil', viewports: [{ id: 'v', name: 'M', items: [], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }],
      settings: { apiKey: 'sk-or-v1-stolen' }, components: [],
    }))
    expect(useStore.getState().project.settings.apiKey).toBe('')
  })

  it('drops unrenderable items instead of crashing', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p3', name: 'X', viewports: [{
        id: 'v', name: 'M', connections: [], messages: [],
        items: [
          note('i1'),
          { kind: 'alien-kind', id: 'i2', pos: { x: 0, y: 0 } },
          { kind: 'note', id: null, pos: { x: 0, y: 0 } },
          { kind: 'note', id: 'i4', pos: 'not-a-pos' } as any,
        ],
        camX: 0, camY: 0, zoom: 1,
      }], components: [],
    }))
    expect(ok).toBe(true)
    const items = useStore.getState().project.viewports[0].items
    expect(items.some((i) => i.id === 'i1')).toBe(true)
    expect(items.some((i) => (i.kind as string) === 'alien-kind')).toBe(false)
    expect(items.some((i) => i.id === 'i4')).toBe(true)
  })
})

describe('undo/redo', () => {
  it('undo restores pre-mutation state and redo reapplies it', () => {
    const s = useStore.getState()
    s.addItem(note('a'))
    const afterAdd = JSON.stringify(useStore.getState().project)
    s.undo()
    const afterUndo = JSON.stringify(useStore.getState().project)
    expect(afterUndo).not.toEqual(afterAdd)
    s.redo()
    expect(JSON.stringify(useStore.getState().project)).toEqual(afterAdd)
  })

  it('undo cannot regress past the most recent import baseline', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p4', name: 'Baseline', viewports: [{ id: 'v4', name: 'Main', items: [], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    const baseline = JSON.stringify(useStore.getState().project)
    useStore.getState().undo()
    useStore.getState().undo()
    expect(JSON.stringify(useStore.getState().project)).toEqual(baseline)
  })

  it('copy then paste assigns fresh ids', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p5', name: 'CopyTest', viewports: [{ id: 'v5', name: 'Main', items: [note('a'), note('b')], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    const s = useStore.getState()
    s.selectItem('a')
    s.copySelected()
    s.paste()
    const items = useStore.getState().project.viewports.find(v => v.id === 'v5')!.items
    expect(items.length).toBe(3)
    const ids = items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
