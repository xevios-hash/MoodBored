import { describe, it, expect } from 'vitest'
import { useStore } from './useStore'
import type { BoardItem, WebItem } from '@/types'

function note(id: string, text = 'x'): BoardItem {
  return { kind: 'note', id, text, purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 } } as any
}

function webItem(id: string, url = 'https://example.com'): WebItem {
  return {
    kind: 'web', id, url, title: 'Test', favicon: '', cardType: 'web',
    isLoading: false, isFocused: false, history: { urls: [url], index: 0 },
    cookies: '', purpose: '', importance: '', tags: [], pos: { x: 0, y: 0 }, size: { w: 640, h: 480 },
  } as any
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
      settings: { apiKey: '' }, components: [],
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

  it('accepts web items in import', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-web', name: 'WebTest', viewports: [{
        id: 'v', name: 'M', connections: [], messages: [],
        items: [webItem('w1', 'https://example.com')],
        camX: 0, camY: 0, zoom: 1,
      }], components: [],
    }))
    expect(ok).toBe(true)
    const items = useStore.getState().project.viewports[0].items
    expect(items.some((i) => i.kind === 'web')).toBe(true)
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

describe('web items / spatial tabs', () => {
  it('createBlankCard creates a web item with cardType blank', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-blank', name: 'BlankTest', viewports: [{ id: 'v', name: 'M', items: [], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    const id = useStore.getState().createBlankCard({ x: 100, y: 100 })
    expect(id).toBeTruthy()
    const items = useStore.getState().project.viewports[0].items
    const blank = items.find(i => i.id === id) as WebItem
    expect(blank).toBeTruthy()
    expect(blank.kind).toBe('web')
    expect(blank.cardType).toBe('blank')
  })

  it('morphCard transforms blank card to web card', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-morph', name: 'MorphTest', viewports: [{ id: 'v', name: 'M', items: [], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    const id = useStore.getState().createBlankCard({ x: 100, y: 100 })
    useStore.getState().morphCard(id, 'web', { url: 'https://example.com', title: 'Example' })
    const items = useStore.getState().project.viewports[0].items
    const card = items.find(i => i.id === id) as WebItem
    expect(card.cardType).toBe('web')
    expect(card.url).toBe('https://example.com')
    expect(card.title).toBe('Example')
  })

  it('morphCard transforms blank card to note card', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-morph2', name: 'MorphTest2', viewports: [{ id: 'v', name: 'M', items: [], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    const id = useStore.getState().createBlankCard({ x: 100, y: 100 })
    useStore.getState().morphCard(id, 'note', { content: 'Hello world' })
    const items = useStore.getState().project.viewports[0].items
    // Note morphing converts to old-style note item
    const note = items.find(i => i.kind === 'note')
    expect(note).toBeTruthy()
    expect((note as any).text).toBe('Hello world')
  })

  it('morphCard transforms blank card to search card', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-morph3', name: 'MorphTest3', viewports: [{ id: 'v', name: 'M', items: [], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    const id = useStore.getState().createBlankCard({ x: 100, y: 100 })
    useStore.getState().morphCard(id, 'search', { searchText: 'hello world' })
    const items = useStore.getState().project.viewports[0].items
    const card = items.find(i => i.id === id) as WebItem
    expect(card.cardType).toBe('search')
    expect(card.searchText).toBe('hello world')
    expect(card.url).toContain('google.com/search')
  })

  it('navigateWebNode updates history', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-nav', name: 'NavTest', viewports: [{ id: 'v', name: 'M', items: [webItem('w1', 'https://example.com')], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    useStore.getState().navigateWebNode('w1', 'https://google.com')
    const items = useStore.getState().project.viewports[0].items
    const card = items.find(i => i.id === 'w1') as WebItem
    expect(card.url).toBe('https://google.com')
    expect(card.history.urls).toEqual(['https://example.com', 'https://google.com'])
    expect(card.history.index).toBe(1)
  })

  it('webNodeGoBack navigates to previous URL', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-back', name: 'BackTest', viewports: [{ id: 'v', name: 'M', items: [webItem('w1', 'https://example.com')], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    useStore.getState().navigateWebNode('w1', 'https://google.com')
    useStore.getState().webNodeGoBack('w1')
    const items = useStore.getState().project.viewports[0].items
    const card = items.find(i => i.id === 'w1') as WebItem
    expect(card.url).toBe('https://example.com')
    expect(card.history.index).toBe(0)
  })
})

describe('typed connections', () => {
  it('addTypedConnection adds a typed connection', () => {
    const ok = useStore.getState().importProject(JSON.stringify({
      id: 'p-conn', name: 'ConnTest', viewports: [{ id: 'v', name: 'M', items: [note('a'), note('b')], connections: [], messages: [], camX: 0, camY: 0, zoom: 1 }], components: [],
    }))
    expect(ok).toBe(true)
    useStore.getState().addTypedConnection({
      fromItemId: 'a', fromPortId: 'output',
      toItemId: 'b', toPortId: 'input',
      connectionType: 'citation', label: 'cites',
      owner: 'user', created: new Date().toISOString(),
    })
    const vp = useStore.getState().project.viewports[0]
    expect(vp.typedConnections.length).toBe(1)
    expect(vp.typedConnections[0].connectionType).toBe('citation')
    expect(vp.typedConnections[0].label).toBe('cites')
  })
})

describe('focus/unfocus web nodes', () => {
  it('focusWebNode sets focusedWebNodeId', () => {
    useStore.getState().focusWebNode('test-id')
    expect(useStore.getState().focusedWebNodeId).toBe('test-id')
  })

  it('focusWebNode(null) clears focus', () => {
    useStore.getState().focusWebNode(null)
    expect(useStore.getState().focusedWebNodeId).toBeNull()
  })
})
