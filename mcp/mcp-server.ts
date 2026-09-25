#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { v4 as uuid } from 'uuid'
import { VectorStore } from './vector-store.js'

// ─── State File ─────────────────────────────────────────────────────

const BOARDS_DIR = process.env.MOODBORED_BOARDS_DIR || join(
  process.env.HOME || process.env.USERPROFILE || '/tmp',
  '.moodbored', 'boards',
)
const BOARD_ID = process.env.MOODBORED_BOARD_ID || null

function getStatePath(): string {
  if (BOARD_ID) return join(BOARDS_DIR, `${BOARD_ID}.json`)
  // Fallback: use the most recently modified board, or create one
  try {
    const files = readdirSync(BOARDS_DIR).filter(f => f.endsWith('.json'))
    if (files.length > 0) {
      // Most recently modified
      const sorted = files.sort((a, b) => {
        const sa = readFileSync(join(BOARDS_DIR, a), 'utf-8')
        const sb = readFileSync(join(BOARDS_DIR, b), 'utf-8')
        return (JSON.parse(sb).lastModified || '').localeCompare(JSON.parse(sa).lastModified || '')
      })
      return join(BOARDS_DIR, sorted[0])
    }
  } catch (_e) {}
  return join(BOARDS_DIR, 'default.json')
}

const STATE_PATH = getStatePath()

// ─── Vector Store (semantic search) ─────────────────────────────────

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || ''
const INDEX_DIR = join(BOARDS_DIR, '.index')
const vecStore = new VectorStore(join(INDEX_DIR, 'vectors.json'), OPENROUTER_KEY)

function ensureDir() {
  const dir = dirname(STATE_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readState(): any {
  try {
    if (!existsSync(STATE_PATH)) return { project: null, lastModified: new Date().toISOString() }
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
  } catch (_e) {
    return { project: null, lastModified: new Date().toISOString() }
  }
}

function writeState(state: any) {
  ensureDir()
  state.lastModified = new Date().toISOString()
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function getActiveViewport(state: any): any {
  return state?.project?.viewports?.[0]
}

function getItems(state: any): any[] {
  return getActiveViewport(state)?.items ?? []
}

// ─── Server ─────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'moodbored',
  version: '1.0.0',
})

// ─── Resources ──────────────────────────────────────────────────────

server.resource('board', 'board://current', async (uri) => {
  const state = readState()
  const items = getItems(state)
  return {
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify({ projectName: state.project?.name, itemCount: items.length, items }, null, 2),
    }],
  }
})

server.resource('summary', 'board://summary', async (uri) => {
  const state = readState()
  const items = getItems(state)
  const nonConn = items.filter((i: any) => i.kind !== 'connector')
  const kinds: Record<string, number> = {}
  for (const item of nonConn) kinds[item.kind] = (kinds[item.kind] || 0) + 1
  const parts = Object.entries(kinds).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`)
  const summary = nonConn.length === 0
    ? 'The board is empty.'
    : `Board "${state.project?.name}" has ${nonConn.length} items: ${parts.join(', ')}.`
  return {
    contents: [{
      uri: uri.href,
      mimeType: 'text/plain',
      text: summary,
    }],
  }
})

// ─── Tools ──────────────────────────────────────────────────────────

server.tool('get_board', 'Read the full mood board — items, palette, typography, spatial layout, and relationships', {}, async () => {
  const state = readState()
  const items = getItems(state)
  const nonConn = items.filter((i: any) => i.kind !== 'connector')
  const palette: any[] = []
  const typography: any[] = []
  const notes: any[] = []
  const images: any[] = []
  const links: any[] = []
  const gradients: any[] = []
  const containers: any[] = []

  for (const item of nonConn) {
    if (item.kind === 'palette') palette.push({ id: item.id, label: item.label, colors: (item.colors || []).map((c: any) => ({ hex: c.hex, name: c.label })), pos: item.pos })
    if (item.kind === 'swatch') palette.push({ id: item.id, hex: item.hex, name: item.name, usage: item.usage, pos: item.pos })
    if (item.kind === 'gradient') gradients.push({ id: item.id, label: item.label, stops: item.stops, direction: item.direction, pos: item.pos })
    if (item.kind === 'font') typography.push({ id: item.id, family: item.fontFamily, weights: item.weights, sample: item.sampleText, pos: item.pos })
    if (item.kind === 'note' || item.kind === 'text') notes.push({ id: item.id, text: item.text || item.raw, purpose: item.purpose, importance: item.importance, tags: item.tags, pos: item.pos })
    if (item.kind === 'image') images.push({ id: item.id, description: item.description, source: item.source, purpose: item.purpose, tags: item.tags, pos: item.pos })
    if (item.kind === 'link') links.push({ id: item.id, url: item.url, title: item.title, summary: item.summary, pos: item.pos })
    if (item.kind === 'video') images.push({ id: item.id, description: item.subjectDesc, motion: item.motionDesc, source: item.sourceUrl, pos: item.pos })
    if (item.kind === 'container') containers.push({ id: item.id, label: item.label, layout: item.layout, childCount: item.children?.length || 0, collapsed: item.collapsed, pos: item.pos })
  }

  const connectors = items.filter((i: any) => i.kind === 'connector').map((c: any) => ({
    from: c.fromId, to: c.toId, label: c.label, style: c.style,
  }))

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        projectName: state.project?.name,
        itemCount: nonConn.length,
        palette,
        gradients,
        typography,
        notes,
        images,
        links,
        containers,
        connectors,
      }, null, 2),
    }],
  }
})

server.tool(
  'add_items',
  'Add one or more items to the mood board. Items are placed on the canvas automatically.',
  {
    items: z.array(z.object({
      kind: z.enum(['note', 'text', 'image', 'link', 'palette', 'gradient', 'font', 'swatch', 'sizeguide', 'container', 'video']),
      text: z.string().optional(),
      description: z.string().optional(),
      url: z.string().optional(),
      source: z.string().optional(),
      label: z.string().optional(),
      colors: z.array(z.object({ hex: z.string(), label: z.string().optional() })).optional(),
      stops: z.array(z.object({ position: z.number(), color: z.string() })).optional(),
      fontFamily: z.string().optional(),
      hex: z.string().optional(),
      name: z.string().optional(),
      purpose: z.string().optional(),
      importance: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })),
  },
  async ({ items: newItems }) => {
    const state = readState()
    const vp = getActiveViewport(state)
    if (!vp) return { content: [{ type: 'text', text: 'Error: No active viewport. Open a project first.' }] }

    const added: string[] = []
    for (const raw of newItems) {
      const id = uuid()
      const pos = { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 }
      let item: any

      switch (raw.kind) {
        case 'note':
          item = { kind: 'note', id, text: raw.text || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos }
          break
        case 'text':
          item = { kind: 'text', id, raw: raw.text || '', pos, size: { w: 300, h: 200 } }
          break
        case 'image':
          item = { kind: 'image', id, description: raw.description || '', source: raw.source || raw.url || '', fullSource: raw.source || raw.url || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 300, h: 200 } }
          break
        case 'link':
          item = { kind: 'link', id, url: raw.url || '', title: raw.label || '', description: raw.description || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos }
          break
        case 'palette':
          item = { kind: 'palette', id, label: raw.label || 'Palette', colors: (raw.colors || []).map((c: any) => ({ hex: c.hex, label: c.label || '' })), purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 320, h: 120 } }
          break
        case 'gradient':
          item = { kind: 'gradient', id, label: raw.label || 'Gradient', stops: (raw.stops || []).map((s: any) => ({ position: s.position, color: s.color })), direction: 90, purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 300, h: 80 } }
          break
        case 'font':
          item = { kind: 'font', id, fontFamily: raw.fontFamily || 'Inter', weights: [400, 700], sampleText: 'The quick brown fox', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 320, h: 160 } }
          break
        case 'swatch':
          item = { kind: 'swatch', id, hex: raw.hex || '#000000', name: raw.name || '', usage: raw.description || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 160, h: 180 } }
          break
        case 'sizeguide':
          item = { kind: 'sizeguide', id, width: 1920, height: 1080, unit: 'px', label: raw.label || '', orientation: 'landscape', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 200, h: 160 } }
          break
        case 'container':
          item = { kind: 'container', id, label: raw.label || 'Container', children: [], layout: 'free', gap: 8, collapsed: false, purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 400, h: 300 } }
          break
        case 'video':
          item = { kind: 'video', id, source: raw.source || '', subjectDesc: raw.description || '', motionDesc: '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 300, h: 200 } }
          break
      }

      if (item) {
        vp.items.push(item)
        added.push(`${raw.kind}: ${item.text || item.description || item.label || item.url || id}`)
      }
    }

    writeState(state)
    // Index newly added items for semantic search
    for (const item of vp.items.slice(-newItems.length)) {
      await vecStore.indexItem(item)
    }
    vecStore.persist()
    return {
      content: [{
        type: 'text',
        text: `Added ${added.length} item(s) to the board:\n${added.map(a => `- ${a}`).join('\n')}`,
      }],
    }
  },
)

server.tool('remove_items', 'Remove items from the mood board by their IDs', {
  ids: z.array(z.string()),
}, async ({ ids }) => {
  const state = readState()
  const vp = getActiveViewport(state)
  if (!vp) return { content: [{ type: 'text', text: 'Error: No active viewport.' }] }

  const before = vp.items.length
  vp.items = vp.items.filter((i: any) => !ids.includes(i.id))
  const removed = before - vp.items.length
  writeState(state)

  return { content: [{ type: 'text', text: `Removed ${removed} item(s).` }] }
})

server.tool('update_item', 'Update properties of an existing item on the board', {
  id: z.string(),
  updates: z.record(z.any()),
}, async ({ id, updates }) => {
  const state = readState()
  const vp = getActiveViewport(state)
  if (!vp) return { content: [{ type: 'text', text: 'Error: No active viewport.' }] }

  const item = vp.items.find((i: any) => i.id === id)
  if (!item) return { content: [{ type: 'text', text: `Item ${id} not found.` }] }

  Object.assign(item, updates)
  writeState(state)
  return { content: [{ type: 'text', text: `Updated item ${id}.` }] }
})

server.tool('search_items', 'Search items on the board by text query and/or tag filter', {
  query: z.string().optional(),
  tag: z.string().optional(),
}, async ({ query, tag }) => {
  const state = readState()
  const items = getItems(state).filter((i: any) => i.kind !== 'connector')
  const q = (query || '').toLowerCase()
  const results = items.filter((item: any) => {
    const searchText = [item.text, item.raw, item.description, item.label, item.url, item.subjectDesc, item.fontFamily, item.hex, item.name, item.purpose, item.importance].filter(Boolean).join(' ').toLowerCase()
    const matchesQuery = !q || searchText.includes(q)
    const matchesTag = !tag || (item.tags || []).includes(tag)
    return matchesQuery && matchesTag
  })

  return {
    content: [{
      type: 'text',
      text: results.length === 0
        ? 'No items matched.'
        : `Found ${results.length} item(s):\n${results.map((i: any) => `- [${i.kind}] ${i.text || i.description || i.label || i.url || i.hex || i.id}`).join('\n')}`,
    }],
  }
})

server.tool('arrange_items', 'Organize items on the board — grid, horizontal stack, vertical stack, or spiral layout', {
  layout: z.enum(['grid', 'stack-h', 'stack-v', 'spiral']),
  cols: z.number().optional(),
  gap: z.number().optional(),
}, async ({ layout, cols, gap }) => {
  const state = readState()
  const vp = getActiveViewport(state)
  if (!vp) return { content: [{ type: 'text', text: 'Error: No active viewport.' }] }

  const positioned = vp.items.filter((i: any) => i.kind !== 'connector' && i.pos)
  const g = gap ?? 20
  let offset = 0

  switch (layout) {
    case 'grid': {
      const c = cols ?? 4
      positioned.forEach((item: any, idx: number) => {
        item.pos = { x: 50 + (idx % c) * ((item.size?.w ?? 250) + g), y: 50 + Math.floor(idx / c) * ((item.size?.h ?? 150) + g) }
      })
      break
    }
    case 'stack-h':
      positioned.forEach((item: any) => {
        item.pos = { x: 50 + offset, y: 50 }
        offset += (item.size?.w ?? 250) + g
      })
      break
    case 'stack-v':
      positioned.forEach((item: any) => {
        item.pos = { x: 50, y: 50 + offset }
        offset += (item.size?.h ?? 150) + g
      })
      break
    case 'spiral':
      positioned.forEach((item: any, idx: number) => {
        const angle = idx * 0.8
        const radius = 150 + idx * g * 0.3
        item.pos = { x: 400 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius }
      })
      break
  }

  writeState(state)
  return { content: [{ type: 'text', text: `Arranged ${positioned.length} items in ${layout} layout.` }] }
})

server.tool(
  'semantic_search',
  'Search items by meaning, not just keywords. Finds items related to the query concept even if they use different words. Requires OPENROUTER_API_KEY env var.',
  { query: z.string().describe('Natural language query — e.g. "warm coastal vibes", "luxury minimalist", "energetic youthful"') },
  async ({ query }) => {
    const state = readState()
    const items = getItems(state).filter((i: any) => i.kind !== 'connector')
    if (vecStore.size === 0) {
      // Index all items on first search
      for (const item of items) await vecStore.indexItem(item)
      vecStore.persist()
    }
    const results = await vecStore.search(query, 10)
    if (results.length === 0) {
      return { content: [{ type: 'text', text: `No items matched "${query}". Try rephrasing or use search_items for exact text matches.` }] }
    }
    const lines = results.map((r, i) => {
      const item = items.find((it: any) => it.id === r.id)
      const label = item ? (item.text || item.description || item.label || item.url || item.hex || r.id) : r.id
      const score = (r.score * 100).toFixed(0)
      return `${i + 1}. [${item?.kind || '?'}] ${label} (relevance: ${score}%)`
    })
    return { content: [{ type: 'text', text: `Semantic search for "${query}":\n${lines.join('\n')}\n\n${results.length} result(s). IDs can be used with update_item/remove_items.` }] }
  }
)

server.tool(
  'related_items',
  'Find items on the board that are semantically related to a given item. Returns items that complement or relate to the given item.',
  { item_id: z.string().describe('ID of the item to find relations for') },
  async ({ item_id }) => {
    const state = readState()
    const items = getItems(state).filter((i: any) => i.kind !== 'connector')
    const target = items.find((i: any) => i.id === item_id)
    if (!target) return { content: [{ type: 'text', text: `Item ${item_id} not found.` }] }

    if (vecStore.size === 0) {
      for (const item of items) await vecStore.indexItem(item)
      vecStore.persist()
    }

    const results = await vecStore.related(item_id, 5)
    if (results.length === 0) {
      return { content: [{ type: 'text', text: `No related items found for "${target.text || target.description || target.label || item_id}".` }] }
    }
    const targetLabel = target.text || target.description || target.label || target.url || target.hex || item_id
    const lines = results.map(r => {
      const item = items.find((it: any) => it.id === r.id)
      return `- [${item?.kind || '?'}] ${item?.text || item?.description || item?.label || item?.url || r.id} (similarity: ${(r.score * 100).toFixed(0)}%)`
    })
    return { content: [{ type: 'text', text: `Items related to "${targetLabel}":\n${lines.join('\n')}` }] }
  }
)

server.tool('clear_board', 'Remove all items from the current board', {}, async () => {
  const state = readState()
  const vp = getActiveViewport(state)
  if (!vp) return { content: [{ type: 'text', text: 'Error: No active viewport.' }] }
  const count = vp.items.filter((i: any) => i.kind !== 'connector').length
  vp.items = vp.items.filter((i: any) => i.kind === 'connector')
  writeState(state)
  return { content: [{ type: 'text', text: `Cleared ${count} items from the board.` }] }
})

// ─── Start ──────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MoodBored MCP server running on stdio')
}

main().catch(console.error)
