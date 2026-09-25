#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { v4 as uuid } from 'uuid'

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

server.tool('get_board', 'Read the current mood board state — all items, palette, typography', {}, async () => {
  const state = readState()
  const items = getItems(state)
  const nonConn = items.filter((i: any) => i.kind !== 'connector')
  const palette: any[] = []
  const typography: any[] = []
  const notes: any[] = []

  for (const item of nonConn) {
    if (item.kind === 'palette') {
      for (const c of item.colors || []) palette.push({ hex: c.hex, name: c.label })
    }
    if (item.kind === 'swatch') palette.push({ hex: item.hex, name: item.name, usage: item.usage })
    if (item.kind === 'font') typography.push({ family: item.fontFamily, weights: item.weights })
    if (item.kind === 'note' || item.kind === 'text') notes.push({ text: item.text || item.raw, purpose: item.purpose })
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        projectName: state.project?.name,
        itemCount: nonConn.length,
        palette,
        typography,
        notes: notes.slice(0, 10),
        items: nonConn.map((i: any) => ({
          id: i.id, kind: i.kind,
          text: i.text || i.raw || i.description || i.label || i.url || '',
          pos: i.pos, size: i.size,
        })),
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
