// Production server — serves the built frontend, hosts the MCP server
// over SSE transport, and provides a board state API for web deployments
// where Tauri's invoke() is not available.
//
// Railway: set start command to "node server.mjs"
// Cloudflare Pages: deploy dist/ as static site, run this server separately for MCP

import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const BOARD_STATE_PATH = process.env.BOARD_STATE_PATH || getDefaultStatePath()

function getDefaultStatePath() {
  const home = process.env.HOME || '/tmp'
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'MoodBored', 'board.json')
  if (process.platform === 'win32') return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'MoodBored', 'board.json')
  return join(home, '.config', 'MoodBored', 'board.json')
}

function ensureDir(path) {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readBoard() {
  try {
    if (!existsSync(BOARD_STATE_PATH)) return { project: null, lastModified: new Date().toISOString() }
    return JSON.parse(readFileSync(BOARD_STATE_PATH, 'utf-8'))
  } catch {
    return { project: null, lastModified: new Date().toISOString() }
  }
}

function writeBoard(state) {
  ensureDir(BOARD_STATE_PATH)
  state.lastModified = new Date().toISOString()
  writeFileSync(BOARD_STATE_PATH, JSON.stringify(state, null, 2))
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ─── Board State API (for web frontend sync) ───────────────────────

app.get('/api/board', (_req, res) => {
  res.json(readBoard())
})

app.put('/api/board', (req, res) => {
  writeBoard(req.body)
  res.json({ ok: true })
})

app.get('/api/board/health', (_req, res) => {
  res.json({ status: 'ok', boardPath: BOARD_STATE_PATH, exists: existsSync(BOARD_STATE_PATH) })
})

// ─── MCP SSE Transport (for remote MCP clients) ────────────────────

const mcpSessions = new Map()

app.get('/mcp/sse', (req, res) => {
  const sessionId = randomUUID()
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write(`data: ${JSON.stringify({ type: 'endpoint', endpoint: `/mcp/message?sessionId=${sessionId}` })}\n\n`)

  mcpSessions.set(sessionId, { res })

  req.on('close', () => {
    mcpSessions.delete(sessionId)
  })
})

app.post('/mcp/message', async (req, res) => {
  const sessionId = req.query.sessionId
  const session = mcpSessions.get(sessionId)
  if (!session) { res.status(404).json({ error: 'Session not found' }); return }

  try {
    const message = req.body
    const response = await handleMcpMessage(message)
    session.res.write(`data: ${JSON.stringify(response)}\n\n`)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function handleMcpMessage(message) {
  if (message.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          { name: 'get_board', description: 'Read the current mood board state' },
          { name: 'add_items', description: 'Add items to the board', inputSchema: { type: 'object', properties: { items: { type: 'array' } } } },
          { name: 'remove_items', description: 'Remove items by ID', inputSchema: { type: 'object', properties: { ids: { type: 'array' } } } },
          { name: 'search_items', description: 'Search items', inputSchema: { type: 'object', properties: { query: { type: 'string' }, tag: { type: 'string' } } } },
          { name: 'export_brief', description: 'Export as creation brief', inputSchema: { type: 'object', properties: { creation_type: { type: 'string' }, format: { type: 'string' } } } },
          { name: 'clear_board', description: 'Clear all items' },
        ],
      },
    }
  }

  if (message.method === 'tools/call') {
    const { name, arguments: args } = message.params
    const state = readBoard()
    const vp = state.project?.viewports?.[0]
    if (!vp) return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'No board open' }] } }

    switch (name) {
      case 'get_board':
        return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: JSON.stringify({ projectName: state.project?.name, items: vp.items }, null, 2) }] } }
      case 'add_items':
        for (const raw of (args?.items || [])) {
          vp.items.push({ ...raw, id: randomUUID(), pos: raw.pos || { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 } })
        }
        writeBoard(state)
        return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: `Added ${(args?.items || []).length} items` }] } }
      case 'clear_board': {
        const count = vp.items.length
        vp.items = []
        writeBoard(state)
        return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: `Cleared ${count} items` }] } }
      }
      default:
        return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }] } }
    }
  }

  return { jsonrpc: '2.0', id: message.id, result: {} }
}

// ─── Static Files (SPA fallback) ───────────────────────────────────

app.use(express.static(join(__dirname, 'dist'), { maxAge: '1y', immutable: true }))
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// ─── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`MoodBored server running on port ${PORT}`)
  console.log(`  Frontend: http://localhost:${PORT}`)
  console.log(`  Board API: http://localhost:${PORT}/api/board`)
  console.log(`  MCP SSE: http://localhost:${PORT}/mcp/sse`)
  console.log(`  Board state: ${BOARD_STATE_PATH}`)
})