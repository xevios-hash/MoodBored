// MoodBored Production Server
// - Multi-board routes: /board/:id, /api/board/:id, /api/boards
// - SSE push: notifies frontend when MCP writes to a board
// - MCP over SSE: full tool parity with stdio server
// - Export to project folder tool

import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const BOARDS_DIR = process.env.BOARDS_DIR || join(process.env.HOME || '/tmp', '.moodbored', 'boards')

// ─── Board File I/O ─────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function boardPath(id) {
  return join(BOARDS_DIR, `${id}.json`)
}

function readBoard(id) {
  const p = boardPath(id)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
}

function writeBoard(id, state) {
  ensureDir(BOARDS_DIR)
  state.lastModified = new Date().toISOString()
  writeFileSync(boardPath(id), JSON.stringify(state, null, 2))
  // Notify all SSE subscribers for this board
  notifyBoardChange(id, state)
}

function listBoards() {
  ensureDir(BOARDS_DIR)
  return readdirSync(BOARDS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const id = f.replace('.json', '')
      const state = readBoard(id)
      return {
        id,
        name: state?.project?.name || id,
        itemCount: state?.project?.viewports?.[0]?.items?.length ?? 0,
        lastModified: state?.lastModified || null,
      }
    })
    .sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''))
}

function createBoard(name, template) {
  const id = randomUUID()
  const state = {
    project: {
      id, name: name || 'Untitled Board',
      viewports: [{
        id: randomUUID(), name: 'Main', items: [], connections: [], messages: [],
        camX: 0, camY: 0, zoom: 1,
      }],
      components: [],
      settings: {
        apiKey: '', defaultModel: 'anthropic/claude-sonnet-4',
        jevThreshold: 0.2, multiAgent: false, theme: 'dark',
        canvasBg: '#0c0814', canvasBgType: 'color', canvasBgVideo: '',
        customBgUrls: [], customBgLabels: {},
      },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },
    lastModified: new Date().toISOString(),
  }
  if (template?.items) {
    state.project.viewports[0].items = template.items
  }
  writeBoard(id, state)
  return { id, name: state.project.name }
}

// ─── SSE Board Events ───────────────────────────────────────────────
// When MCP writes to a board, push the new state to all connected
// frontend clients for that board.

const boardSubscribers = new Map() // boardId -> Set<res>

function notifyBoardChange(boardId, state) {
  const subs = boardSubscribers.get(boardId)
  if (!subs || subs.size === 0) return
  const data = JSON.stringify({ project: state.project, lastModified: state.lastModified })
  for (const res of subs) {
    try { res.write(`data: ${data}\n\n`) } catch { subs.delete(res) }
  }
}

// ─── Express App ────────────────────────────────────────────────────

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ─── Board API ──────────────────────────────────────────────────────

app.get('/api/boards', (_req, res) => {
  res.json(listBoards())
})

app.post('/api/boards', (req, res) => {
  const { name, template } = req.body || {}
  const board = createBoard(name, template)
  res.json(board)
})

app.get('/api/board/:id', (req, res) => {
  const state = readBoard(req.params.id)
  if (!state) { res.status(404).json({ error: 'Board not found' }); return }
  res.json(state)
})

app.put('/api/board/:id', (req, res) => {
  writeBoard(req.params.id, req.body)
  res.json({ ok: true })
})

app.delete('/api/board/:id', (req, res) => {
  const p = boardPath(req.params.id)
  if (existsSync(p)) unlinkSync(p)
  res.json({ ok: true })
})

app.get('/api/board/:id/health', (req, res) => {
  const p = boardPath(req.params.id)
  res.json({ status: 'ok', boardId: req.params.id, exists: existsSync(p) })
})

// SSE endpoint — frontend subscribes here for live updates
app.get('/api/board/:id/events', (req, res) => {
  const boardId = req.params.id
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(':ok\n\n')

  if (!boardSubscribers.has(boardId)) boardSubscribers.set(boardId, new Set())
  boardSubscribers.get(boardId).add(res)

  req.on('close', () => {
    const subs = boardSubscribers.get(boardId)
    if (subs) { subs.delete(res); if (subs.size === 0) boardSubscribers.delete(boardId) }
  })
})

// Legacy single-board endpoints (backward compat)
app.get('/api/board', (_req, res) => {
  const boards = listBoards()
  if (boards.length > 0) {
    res.json(readBoard(boards[0].id))
  } else {
    res.json({ project: null })
  }
})

app.put('/api/board', (req, res) => {
  let boards = listBoards()
  let id
  if (boards.length > 0) {
    id = boards[0].id
  } else {
    id = createBoard('Default Board').id
  }
  writeBoard(id, req.body)
  res.json({ ok: true, id })
})

app.get('/api/board/health', (_req, res) => {
  res.json({ status: 'ok', boardsDir: BOARDS_DIR, boardCount: listBoards().length })
})

// ─── MCP SSE Transport ──────────────────────────────────────────────
// Full parity with the stdio server + project management tools.

const mcpSessions = new Map()

app.get('/mcp/sse', (req, res) => {
  const sessionId = randomUUID()
  const boardId = req.query.board || null
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(`data: ${JSON.stringify({ type: 'endpoint', endpoint: `/mcp/message?sessionId=${sessionId}` })}\n\n`)
  mcpSessions.set(sessionId, { res, boardId })
  req.on('close', () => mcpSessions.delete(sessionId))
})

app.post('/mcp/message', async (req, res) => {
  const sessionId = req.query.sessionId
  const session = mcpSessions.get(sessionId)
  if (!session) { res.status(404).json({ error: 'Session not found' }); return }

  try {
    const response = await handleMcpMessage(req.body, session.boardId)
    session.res.write(`data: ${JSON.stringify(response)}\n\n`)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function getActiveViewport(state) {
  return state?.project?.viewports?.[0]
}

async function handleMcpMessage(message, sessionBoardId) {
  if (message.method === 'tools/list') {
    return {
      jsonrpc: '2.0', id: message.id,
      result: {
        tools: [
          { name: 'list_projects', description: 'List all available boards', inputSchema: { type: 'object', properties: {} } },
          { name: 'create_project', description: 'Create a new board', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
          { name: 'get_project', description: 'Get board metadata', inputSchema: { type: 'object', properties: { id: { type: 'string' } } } },
          { name: 'get_board', description: 'Read the full board state — all items, palette, typography', inputSchema: { type: 'object', properties: {} } },
          { name: 'add_items', description: 'Add items to the board', inputSchema: { type: 'object', properties: { items: { type: 'array' } }, required: ['items'] } },
          { name: 'remove_items', description: 'Remove items by ID', inputSchema: { type: 'object', properties: { ids: { type: 'array' } }, required: ['ids'] } },
          { name: 'update_item', description: 'Update an item\'s properties', inputSchema: { type: 'object', properties: { id: { type: 'string' }, updates: { type: 'object' } }, required: ['id', 'updates'] } },
          { name: 'search_items', description: 'Search items by text or tag', inputSchema: { type: 'object', properties: { query: { type: 'string' }, tag: { type: 'string' } } } },
          { name: 'arrange_items', description: 'Arrange items into a layout', inputSchema: { type: 'object', properties: { layout: { type: 'string', enum: ['grid', 'stack-h', 'stack-v', 'spiral'] }, cols: { type: 'number' }, gap: { type: 'number' } }, required: ['layout'] } },
          { name: 'clear_board', description: 'Remove all items', inputSchema: { type: 'object', properties: {} } },
          { name: 'export_brief', description: 'Export board as a creative brief', inputSchema: { type: 'object', properties: { creation_type: { type: 'string' }, format: { type: 'string' } } } },
          { name: 'export_to_folder', description: 'Export the board JSON to a file path (for saving to a project folder)', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Absolute file path to write the board JSON' } }, required: ['path'] } },
        ],
      },
    }
  }

  if (message.method === 'tools/call') {
    const { name, arguments: args } = message.params
    const result = await executeTool(name, args || {}, sessionBoardId)
    return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: result }] } }
  }

  return { jsonrpc: '2.0', id: message.id, result: {} }
}

async function executeTool(name, args, sessionBoardId) {
  // Project management tools
  if (name === 'list_projects') {
    const boards = listBoards()
    return JSON.stringify(boards, null, 2)
  }
  if (name === 'create_project') {
    const board = createBoard(args.name)
    return `Created board "${board.name}" (${board.id})`
  }
  if (name === 'get_project') {
    const id = args.id || sessionBoardId
    if (!id) return 'No board ID specified and no session board bound'
    const state = readBoard(id)
    if (!state) return `Board ${id} not found`
    return JSON.stringify({ id, name: state.project?.name, viewportCount: state.project?.viewports?.length, itemCount: state.project?.viewports?.[0]?.items?.length, created: state.project?.created, updated: state.project?.updated }, null, 2)
  }
  if (name === 'export_to_folder') {
    if (!args.path) return 'Error: path is required'
    if (!sessionBoardId) return 'Error: no session board bound'
    const state = readBoard(sessionBoardId)
    if (!state) return 'Error: session board not found'
    try {
      ensureDir(dirname(args.path))
      writeFileSync(args.path, JSON.stringify(state.project, null, 2))
      return `Exported board to ${args.path}`
    } catch (err) { return `Error: ${err.message}` }
  }

  // Board content tools — require a board
  if (!sessionBoardId) return 'Error: no board bound to this MCP session. Use create_project first.'
  const state = readBoard(sessionBoardId)
  if (!state) return 'Error: session board not found on disk'
  const vp = getActiveViewport(state)
  if (!vp) return 'Error: board has no viewports'

  switch (name) {
    case 'get_board': {
      const nonConn = vp.items.filter(i => i.kind !== 'connector')
      const palette = [], typography = [], notes = []
      for (const item of nonConn) {
        if (item.kind === 'palette') for (const c of item.colors || []) palette.push({ hex: c.hex, name: c.label })
        if (item.kind === 'swatch') palette.push({ hex: item.hex, name: item.name, usage: item.usage })
        if (item.kind === 'font') typography.push({ family: item.fontFamily, weights: item.weights })
        if (item.kind === 'note' || item.kind === 'text') notes.push({ text: item.text || item.raw, purpose: item.purpose })
      }
      return JSON.stringify({
        projectName: state.project?.name, itemCount: nonConn.length,
        palette, typography, notes: notes.slice(0, 10),
        items: nonConn.map(i => ({ id: i.id, kind: i.kind, text: i.text || i.raw || i.description || i.label || i.url || '', pos: i.pos, size: i.size })),
      }, null, 2)
    }
    case 'add_items': {
      let added = 0
      for (const raw of (args.items || [])) {
        const id = randomUUID()
        const pos = raw.pos || { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 }
        const item = { ...raw, id, pos }
        if (!item.size && raw.kind !== 'note' && raw.kind !== 'link') item.size = { w: 300, h: 200 }
        vp.items.push(item)
        added++
      }
      writeBoard(sessionBoardId, state)
      return `Added ${added} item(s)`
    }
    case 'remove_items': {
      const ids = new Set(args.ids || [])
      const before = vp.items.length
      vp.items = vp.items.filter(i => !ids.has(i.id))
      writeBoard(sessionBoardId, state)
      return `Removed ${before - vp.items.length} item(s)`
    }
    case 'update_item': {
      const item = vp.items.find(i => i.id === args.id)
      if (!item) return `Item ${args.id} not found`
      Object.assign(item, args.updates)
      writeBoard(sessionBoardId, state)
      return `Updated item ${args.id}`
    }
    case 'search_items': {
      const q = (args.query || '').toLowerCase()
      const tag = args.tag
      const results = vp.items.filter(i => {
        if (i.kind === 'connector') return false
        const text = [i.text, i.raw, i.description, i.label, i.url, i.subjectDesc, i.fontFamily, i.hex, i.name, i.purpose].filter(Boolean).join(' ').toLowerCase()
        return (!q || text.includes(q)) && (!tag || (i.tags || []).includes(tag))
      })
      return results.length === 0 ? 'No matches.' : `Found ${results.length}:\n${results.map(i => `- [${i.kind}] ${i.text || i.description || i.label || i.url || i.id}`).join('\n')}`
    }
    case 'arrange_items': {
      const positioned = vp.items.filter(i => i.kind !== 'connector' && i.pos)
      const g = args.gap ?? 20
      let offset = 0
      if (args.layout === 'grid') {
        const c = args.cols || 4
        positioned.forEach((item, idx) => { item.pos = { x: 50 + (idx % c) * ((item.size?.w ?? 250) + g), y: 50 + Math.floor(idx / c) * ((item.size?.h ?? 150) + g) } })
      } else if (args.layout === 'stack-h') {
        positioned.forEach(item => { item.pos = { x: 50 + offset, y: 50 }; offset += (item.size?.w ?? 250) + g })
      } else if (args.layout === 'stack-v') {
        positioned.forEach(item => { item.pos = { x: 50, y: 50 + offset }; offset += (item.size?.h ?? 150) + g })
      } else if (args.layout === 'spiral') {
        positioned.forEach((item, idx) => { const a = idx * 0.8; const r = 150 + idx * g * 0.3; item.pos = { x: 400 + Math.cos(a) * r, y: 300 + Math.sin(a) * r } })
      }
      writeBoard(sessionBoardId, state)
      return `Arranged ${positioned.length} items in ${args.layout} layout`
    }
    case 'clear_board': {
      const count = vp.items.filter(i => i.kind !== 'connector').length
      vp.items = vp.items.filter(i => i.kind === 'connector')
      writeBoard(sessionBoardId, state)
      return `Cleared ${count} items`
    }
    case 'export_brief': {
      const nonConn = vp.items.filter(i => i.kind !== 'connector')
      const lines = [`# Creative Brief`, '', `**Board:** ${state.project?.name}`, `**Items:** ${nonConn.length}`, '']
      for (const item of nonConn) {
        if (item.kind === 'note') lines.push(`- Note: ${item.text}`)
        if (item.kind === 'image') lines.push(`- Image: ${item.description} ${item.source || ''}`)
        if (item.kind === 'palette') lines.push(`- Palette: ${(item.colors || []).map(c => c.hex).join(', ')}`)
        if (item.kind === 'font') lines.push(`- Font: ${item.fontFamily}`)
      }
      return lines.join('\n')
    }
    default:
      return `Unknown tool: ${name}`
  }
}

// ─── MCP Discovery (before SPA fallback) ────────────────────────────

// MCP Discovery — serve .well-known from dist (built) or public (dev)
app.use('/.well-known', express.static(join(__dirname, 'dist', '.well-known')))
app.use('/.well-known', express.static(join(__dirname, 'public', '.well-known')))

// MCP connection info page — human-readable, copy-pasteable
app.get('/mcp', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`
  const boards = listBoards()
  const boardList = boards.length > 0
    ? boards.map(b => `<li><code>${b.id}</code> — ${b.name} (${b.itemCount} items)</li>`).join('')
    : '<li>No boards yet. Create one at <a href="/">the app</a>.</li>'

  res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MoodBored MCP Server</title>
<style>body{font-family:Inter,system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#e8e0f5;background:#0c0814}
code{background:#1a0030;padding:2px 6px;border-radius:4px;font-size:13px}
pre{background:#1a0030;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px}
h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #2d0055;padding-bottom:6px}
a{color:#7c6cbf}li{margin:4px 0}ul{padding-left:20px}
.copy{background:#7c6cbf;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-left:8px}
.copy:hover{background:#9b8ce0}</style></head>
<body>
<h1>MoodBored MCP Server</h1>
<p>Visual mood-board workspace — any LLM can read, write, and arrange items via MCP tools.</p>

<h2>Available Boards</h2>
<ul>${boardList}</ul>

<h2>Connect via SSE (OpenCode, web-based IDEs)</h2>
<pre>${origin}/mcp/sse?board=BOARD_ID</pre>

<h2>Connect via stdio (Claude Desktop, Cursor)</h2>
<pre>{
  "mcpServers": {
    "moodbored": {
      "command": "npx",
      "args": ["tsx", "/path/to/MoodBored/mcp/mcp-server.ts"],
      "env": { "MOODBORED_BOARD_ID": "BOARD_ID" }
    }
  }
}</pre>
<p>Replace <code>BOARD_ID</code> with one from the list above, or omit to auto-pick the most recent board.</p>

<h2>Tools</h2>
<ul>
<li><strong>get_board</strong> — read full board state</li>
<li><strong>add_items</strong> — add notes, images, palettes, fonts, gradients, links, videos, containers</li>
<li><strong>remove_items</strong> — delete by ID</li>
<li><strong>update_item</strong> — edit any item properties</li>
<li><strong>search_items</strong> — text + tag search</li>
<li><strong>arrange_items</strong> — grid, stack, spiral layouts</li>
<li><strong>clear_board</strong> — wipe all items</li>
</ul>

<h2>Resources</h2>
<ul>
<li><code>board://current</code> — full board JSON</li>
<li><code>board://summary</code> — text summary</li>
</ul>
</body></html>`)
})

// MCP manifest fallback (for clients that can't access .well-known)
app.get('/mcp.json', (_req, res) => {
  try {
    const p = join(__dirname, 'dist', '.well-known', 'mcp.json')
    if (existsSync(p)) { res.type('json').send(readFileSync(p, 'utf-8')); return }
    const pub = join(__dirname, 'public', '.well-known', 'mcp.json')
    if (existsSync(pub)) { res.type('json').send(readFileSync(pub, 'utf-8')); return }
  } catch (_e) {}
  res.status(404).json({ error: 'MCP manifest not found' })
})

// ─── SPA Fallback (catch-all, last) ─────────────────────────────────

app.use(express.static(join(__dirname, 'dist'), { maxAge: '1y', immutable: true }))
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// ─── Start ──────────────────────────────────────────────────────────

ensureDir(BOARDS_DIR)

app.listen(PORT, () => {
  console.log(`MoodBored server on port ${PORT}`)
  console.log(`  Frontend:  http://localhost:${PORT}`)
  console.log(`  Boards:    http://localhost:${PORT}/api/boards`)
  console.log(`  MCP SSE:   http://localhost:${PORT}/mcp/sse`)
  console.log(`  Board dir: ${BOARDS_DIR}`)
})
