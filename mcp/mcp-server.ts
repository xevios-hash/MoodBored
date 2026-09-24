#!/usr/bin/env node

// MoodBored MCP Server — exposes the mood board as tools that any LLM
// can call. Uses stdio transport (Claude Desktop, Cursor, etc.).
//
// State is stored in a JSON file at:
//   ~/Library/Application Support/MoodBored/board.json  (macOS)
//   %APPDATA%/MoodBored/board.json                      (Windows)
//
// The Tauri app syncs to this file automatically via the sync bridge.
// The MCP server reads/writes it directly.
//
// Usage:
//   node mcp/mcp-server.js           (compiled)
//   npx tsx mcp/mcp-server.ts        (dev)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { v4 as uuid } from 'uuid'

// ─── State File ─────────────────────────────────────────────────────

function getStatePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'MoodBored', 'board.json')
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'MoodBored', 'board.json')
  }
  return join(home, '.config', 'MoodBored', 'board.json')
}

const STATE_PATH = getStatePath()

interface BoardState {
  project: any
  lastModified: string
}

function ensureDir() {
  const dir = STATE_PATH.replace(/[/\\][^/\\]+$/, '')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readState(): BoardState {
  try {
    if (!existsSync(STATE_PATH)) {
      return { project: null, lastModified: new Date().toISOString() }
    }
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
  } catch {
    return { project: null, lastModified: new Date().toISOString() }
  }
}

function writeState(state: BoardState) {
  ensureDir()
  state.lastModified = new Date().toISOString()
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function getActiveViewport(state: BoardState): any {
  if (!state.project?.viewports?.length) return null
  return state.project.viewports[0]
}

function getItems(state: BoardState): any[] {
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
  const nonConn = items.filter(i => i.kind !== 'connector')
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

server.tool('get_board', 'Read the current mood board state — all items, palette, typography, layout', {}, async () => {
  const state = readState()
  const items = getItems(state)
  const nonConn = items.filter(i => i.kind !== 'connector')
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
        items: nonConn.map(i => ({
          id: i.id, kind: i.kind,
          text: i.text || i.raw || i.description || i.label || i.url || '',
          pos: i.pos, size: i.size,
        })),
      }, null, 2),
    }],
  }
})

server.tool('add_items', 'Add one or more items to the mood board. Items are placed on the canvas automatically.', {
  items: z.array(z.object({
    kind: z.enum(['note', 'text', 'image', 'link', 'palette', 'gradient', 'font', 'swatch', 'sizeguide', 'container', 'video']),
    text: z.string().optional().describe('Content for notes/text items'),
    description: z.string().optional().describe('Description for images/videos'),
    url: z.string().optional().describe('URL for links/images'),
    source: z.string().optional().describe('Image source URL (Unsplash, etc.)'),
    label: z.string().optional().describe('Label for palettes/gradients/containers/sizeguides'),
    colors: z.array(z.object({ hex: z.string(), label: z.string().optional() })).optional().describe('Colors for palette items'),
    stops: z.array(z.object({ position: z.number(), color: z.string() })).optional().describe('Stops for gradient items'),
    fontFamily: z.string().optional().describe('Font family name'),
    hex: z.string().optional().describe('Hex color for swatch items'),
    name: z.string().optional().describe('Name for swatch items'),
    purpose: z.string().optional().describe('Why this item is on the board'),
    importance: z.string().optional().describe('How important this item is'),
    tags: z.array(z.string()).optional().describe('Tags for filtering/search'),
  }).describe('An item to add to the board')),
}, async ({ items: newItems }) => {
  const state = readState()
  const vp = getActiveViewport(state)
  if (!vp) return { content: [{ type: 'text', text: 'Error: No active viewport. Open a project first.' }] }

  const added: string[] = []
  for (const raw of newItems) {
    const id = uuid()
    const kind = raw.kind
    const pos = { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 }
    let item: any

    switch (kind) {
      case 'note':
        item = { kind, id, text: raw.text || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos }
        break
      case 'text':
        item = { kind, id, raw: raw.text || '', pos, size: { w: 300, h: 200 } }
        break
      case 'image':
        item = { kind, id, description: raw.description || '', source: raw.source || raw.url || '', fullSource: raw.source || raw.url || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 300, h: 200 } }
        break
      case 'link':
        item = { kind, id, url: raw.url || '', title: raw.label || '', description: raw.description || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos }
        break
      case 'palette':
        item = { kind, id, label: raw.label || 'Palette', colors: (raw.colors || []).map(c => ({ hex: c.hex, label: c.label || '' })), purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 320, h: 120 } }
        break
      case 'gradient':
        item = { kind, id, label: raw.label || 'Gradient', stops: (raw.stops || []).map(s => ({ position: s.position, color: s.color })), direction: 90, purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 300, h: 80 } }
        break
      case 'font':
        item = { kind, id, fontFamily: raw.fontFamily || 'Inter', weights: [400, 700], sampleText: 'The quick brown fox', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 320, h: 160 } }
        break
      case 'swatch':
        item = { kind, id, hex: raw.hex || '#000000', name: raw.name || '', usage: raw.description || '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 160, h: 180 } }
        break
      case 'sizeguide':
        item = { kind, id, width: 1920, height: 1080, unit: 'px', label: raw.label || '', orientation: 'landscape', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 200, h: 160 } }
        break
      case 'container':
        item = { kind, id, label: raw.label || 'Container', children: [], layout: 'free', gap: 8, collapsed: false, purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 400, h: 300 } }
        break
      case 'video':
        item = { kind, id, source: raw.source || '', subjectDesc: raw.description || '', motionDesc: '', purpose: raw.purpose || '', importance: raw.importance || '', tags: raw.tags || [], pos, size: { w: 300, h: 200 } }
        break
      default:
        continue
    }

    vp.items.push(item)
    added.push(`${kind}: ${item.text || item.description || item.label || item.url || id}`)
  }

  writeState(state)
  return {
    content: [{
      type: 'text',
      text: `Added ${added.length} item(s) to the board:\n${added.map(a => `- ${a}`).join('\n')}`,
    }],
  }
})

server.tool('remove_items', 'Remove items from the mood board by their IDs', {
  ids: z.array(z.string()).describe('IDs of items to remove'),
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
  id: z.string().describe('The item ID to update'),
  updates: z.record(z.any()).describe('Properties to update (e.g. {"text": "new text", "purpose": "mood setter"})'),
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
  query: z.string().optional().describe('Text to search for (matches descriptions, text, labels, URLs)'),
  tag: z.string().optional().describe('Tag to filter by'),
}, async ({ query, tag }) => {
  const state = readState()
  const items = getItems(state).filter(i => i.kind !== 'connector')
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
  layout: z.enum(['grid', 'stack-h', 'stack-v', 'spiral']).describe('Layout type'),
  cols: z.number().optional().describe('Columns for grid layout (default: 4)'),
  gap: z.number().optional().describe('Gap between items in pixels (default: 20)'),
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

server.tool('export_brief', 'Export the board as a structured creative brief for another LLM to consume', {
  creation_type: z.enum(['image', 'video', 'game', 'web', '3d', 'audio', 'document', 'general']).optional().describe('What the receiving LLM should create'),
  format: z.enum(['markdown', 'json']).optional().describe('Output format (default: markdown)'),
}, async ({ creation_type, format }) => {
  const state = readState()
  const items = getItems(state)
  const nonConn = items.filter(i => i.kind !== 'connector')

  // Simple inline export (avoids import dependency on the frontend module)
  const palette: string[] = []
  const fonts: string[] = []
  const images: string[] = []
  const notesList: string[] = []

  for (const item of nonConn) {
    if (item.kind === 'palette') {
      for (const c of item.colors || []) palette.push(c.hex)
    }
    if (item.kind === 'swatch') palette.push(item.hex)
    if (item.kind === 'font') fonts.push(`${item.fontFamily} (${(item.weights || []).join(', ')})`)
    if (item.kind === 'image') images.push(item.description || item.source)
    if (item.kind === 'note' || item.kind === 'text') notesList.push(item.text || item.raw)
  }

  if (format === 'json') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ creationType: creation_type || 'general', itemCount: nonConn.length, palette, fonts, images, notes: notesList, items: nonConn }, null, 2),
      }],
    }
  }

  const lines: string[] = [`# Creative Brief`, '', `**Board:** ${state.project?.name}`, `**Items:** ${nonConn.length}`, `**Creation target:** ${creation_type || 'general'}`, '']
  if (palette.length) lines.push('## Color Palette', ...palette.map(h => `- \`${h}\``), '')
  if (fonts.length) lines.push('## Typography', ...fonts.map(f => `- ${f}`), '')
  if (images.length) lines.push('## Visual References', ...images.map(i => `- ${i}`), '')
  if (notesList.length) lines.push('## Creative Notes', ...notesList.map(n => `- ${n}`), '')

  return { content: [{ type: 'text', text: lines.join('\n') }] }
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