// MoodBored Production Server
// - Multi-board routes: /board/:id, /api/board/:id, /api/boards
// - SSE push: notifies frontend when MCP writes to a board
// - MCP over SSE: full tool parity with stdio server
// - Export to project folder tool

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import compression from 'compression'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i] }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

const PORT = process.env.PORT || 3000
const BOARDS_DIR = process.env.BOARDS_DIR || join(process.env.HOME || '/tmp', '.moodbored', 'boards')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

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
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch {
    // Corrupt file - try to recover from backup
    const backupPath = p + '.backup'
    if (existsSync(backupPath)) {
      try {
        const backup = JSON.parse(readFileSync(backupPath, 'utf-8'))
        console.warn(`[MoodBored] Recovered board ${id} from backup`)
        return backup
      } catch {}
    }
    return null
  }
}

function writeBoard(id, state) {
  ensureDir(BOARDS_DIR)
  state.lastModified = new Date().toISOString()
  const targetPath = boardPath(id)
  const tmpPath = targetPath + '.tmp'
  const backupPath = targetPath + '.backup'
  
  // Atomic write: write to temp file, then rename
  try {
    writeFileSync(tmpPath, JSON.stringify(state, null, 2))
    // Keep backup of previous version
    if (existsSync(targetPath)) {
      try { renameSync(targetPath, backupPath) } catch {}
    }
    renameSync(tmpPath, targetPath)
  } catch (err) {
    console.error(`[MoodBored] Failed to write board ${id}:`, err)
    // Clean up temp file if it exists
    try { if (existsSync(tmpPath)) unlinkSync(tmpPath) } catch {}
    throw err
  }
  
  notifyBoardChange(id, state)
  // Also persist to Supabase if configured (survives Railway redeploy)
  syncToSupabase(id, state).catch(() => {})
}

// ─── Supabase Persistence ───────────────────────────────────────────
// Boards are saved to Supabase as a backup. On startup, if the local
// filesystem is empty, boards are restored from Supabase.

const supabaseHeaders = SUPABASE_URL && SUPABASE_KEY
  ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
  : null

async function supabaseRequest(method, path, body) {
  if (!supabaseHeaders) return null
  const url = `${SUPABASE_URL}/rest/v1/${path}`
  const opts = { method, headers: supabaseHeaders }
  if (body) opts.body = JSON.stringify(body)
  try {
    const res = await fetch(url, opts)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[MoodBored] Supabase ${method} ${path} failed: ${res.status} ${res.statusText} — ${text}`)
      return null
    }
    return await res.json().catch(() => null)
  } catch (err) {
    console.error(`[MoodBored] Supabase ${method} ${path} error:`, err.message)
    return null
  }
}

async function syncToSupabase(id, state) {
  if (!supabaseHeaders) return
  const project = state.project
  if (!project) return
  const payload = {
    id,
    name: project.name || id,
    data: state,
    updated_at: new Date().toISOString(),
  }
  // Upsert — Supabase will insert or update based on id conflict
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/boards`, {
      method: 'POST',
      headers: { ...supabaseHeaders, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[MoodBored] Supabase sync failed for board ${id}: ${res.status} ${res.statusText} — ${text}`)
    }
  } catch (err) {
    console.error(`[MoodBored] Supabase sync error for board ${id}:`, err.message)
  }
}

async function loadFromSupabase() {
  if (!supabaseHeaders) return
  const boards = listBoards()
  if (boards.length > 0) return // local boards exist, don't overwrite
  console.log('[MoodBored] No local boards found — loading from Supabase...')
  const rows = await supabaseRequest('GET', 'boards?select=*', null)
  if (!Array.isArray(rows) || rows.length === 0) return
  for (const row of rows) {
    if (row.id && row.data) {
      writeFileSync(boardPath(row.id), JSON.stringify(row.data, null, 2))
      console.log(`[MoodBored] Restored board: ${row.name || row.id}`)
    }
  }
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
app.set('trust proxy', true) // Railway, Cloudflare, etc. set X-Forwarded-Proto
// Request logging
app.use(morgan('combined', {
  skip: (req) => req.url === '/api/board/health' && req.method === 'GET',
}))

// Compression
app.use(compression())

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for now - needs proper config for Tauri
  crossOriginEmbedderPolicy: false,
}))

// CORS - restrict to known origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:1420', 'https://moodbored-production.up.railway.app']
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, false) // Don't throw, just don't set CORS headers
    }
  },
  credentials: true,
}))

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
app.use('/api/', apiLimiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts' },
})

app.use(express.json({ limit: '10mb' }))

// Board API authentication — require Bearer token for mutating operations
const BOARD_API_TOKEN = process.env.BOARD_API_TOKEN || ''
function requireBoardAuth(req, res, next) {
  // If no token configured, allow all (local development)
  if (!BOARD_API_TOKEN) return next()
  
  // Only check auth for mutating methods on board endpoints
  const method = req.method
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
  const isBoardEndpoint = req.path.startsWith('/api/board') || req.path.startsWith('/api/boards')
  
  // Skip auth for health checks and SSE subscriptions
  const isPublic = req.path === '/api/board/health' || 
                   req.path.endsWith('/events') ||
                   (method === 'GET' && req.path.startsWith('/api/board'))
  
  if (!isMutating || !isBoardEndpoint || isPublic) return next()
  
  const authHeader = req.headers.authorization
  if (!authHeader || authHeader !== `Bearer ${BOARD_API_TOKEN}`) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  
  next()
}
app.use('/api/', requireBoardAuth)

// ─── Board API ──────────────────────────────────────────────────────

app.get('/api/boards', (_req, res) => {
  res.json(listBoards())
})

app.post('/api/boards', (req, res) => {
  const { name, template } = req.body || {}
  const board = createBoard(name, template)
  res.json(board)
})

// Health check route - must be before :id routes
app.get('/api/board/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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

// ─── REST API — Item Operations ─────────────────────────────────────
// Mirrors the MCP tools so any HTTP client can drive the board.

function getBoardOr404(id, res) {
  const state = readBoard(id)
  if (!state) { res.status(404).json({ error: 'Board not found' }); return null }
  return state
}

function getVpOr404(state, res) {
  const vp = state?.project?.viewports?.[0]
  if (!vp) { res.status(404).json({ error: 'Board has no viewport' }); return null }
  return vp
}

function itemSummary(item) {
  return {
    id: item.id, kind: item.kind,
    text: item.text || item.raw || item.description || item.label || item.url || '',
    pos: item.pos, size: item.size,
  }
}

// Add items
app.post('/api/board/:id/items', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const newItems = Array.isArray(req.body) ? req.body : [req.body]
  const added = []
  for (const raw of newItems) {
    const id = raw.id || randomUUID()
    const pos = raw.pos || { x: 80 + Math.random() * 600, y: 80 + Math.random() * 400 }
    const item = { ...raw, id, pos }
    if (!item.size && raw.kind !== 'note' && raw.kind !== 'link') item.size = { w: 300, h: 200 }
    vp.items.push(item)
    added.push(itemSummary(item))
  }
  writeBoard(req.params.id, state)
  res.json({ ok: true, added })
})

// Remove items by IDs
app.delete('/api/board/:id/items', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const ids = req.body?.ids || []
  if (!Array.isArray(ids) || ids.length === 0) {
    // No IDs → clear all
    const count = vp.items.filter(i => i.kind !== 'connector').length
    vp.items = vp.items.filter(i => i.kind === 'connector')
    writeBoard(req.params.id, state)
    res.json({ ok: true, removed: count })
    return
  }

  const before = vp.items.length
  vp.items = vp.items.filter(i => !ids.includes(i.id))
  writeBoard(req.params.id, state)
  res.json({ ok: true, removed: before - vp.items.length })
})

// Update a single item
app.patch('/api/board/:id/items/:itemId', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const item = vp.items.find(i => i.id === req.params.itemId)
  if (!item) { res.status(404).json({ error: 'Item not found' }); return }

  Object.assign(item, req.body)
  writeBoard(req.params.id, state)
  res.json({ ok: true, item: itemSummary(item) })
})

// Search items
app.get('/api/board/:id/search', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const q = (req.query.q || '').toLowerCase()
  const tag = req.query.tag || ''
  const kind = req.query.kind || ''

  const results = vp.items.filter(item => {
    if (item.kind === 'connector') return false
    const text = [item.text, item.raw, item.description, item.label, item.url, item.subjectDesc, item.fontFamily, item.hex, item.name, item.purpose, item.importance, (item.tags || []).join(' ')].filter(Boolean).join(' ').toLowerCase()
    const matchesQuery = !q || text.includes(q)
    const matchesTag = !tag || (item.tags || []).includes(tag)
    const matchesKind = !kind || item.kind === kind
    return matchesQuery && matchesTag && matchesKind
  })

  res.json({ count: results.length, items: results.map(itemSummary) })
})

// Semantic search — finds items related by meaning, not just keywords
// Requires OPENROUTER_API_KEY env var for embeddings
app.get('/api/board/:id/semantic', async (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const q = req.query.q || ''
  if (!q) { res.status(400).json({ error: 'q parameter required' }); return }

  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || ''
  if (!openrouterKey) { res.status(501).json({ error: 'Semantic search requires OPENROUTER_API_KEY env var' }); return }

  try {
    // Embed the query
    const embRes = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: q.slice(0, 8000) }),
    })
    if (!embRes.ok) { res.status(502).json({ error: 'Embedding API failed' }); return }
    const embData = await embRes.json()
    const qVector = embData.data?.[0]?.embedding
    if (!qVector) { res.status(502).json({ error: 'No embedding returned' }); return }

    // Embed each item and compute similarity
    const nonConn = vp.items.filter(i => i.kind !== 'connector')
    const scored = []
    for (const item of nonConn) {
      const text = [item.kind, item.text, item.raw, item.description, item.purpose, item.label, item.url, item.fontFamily, item.hex, (item.tags || []).join(' ')].filter(Boolean).join(' ')
      try {
        const r = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: text.slice(0, 8000) }),
        })
        if (r.ok) {
          const d = await r.json()
          const vec = d.data?.[0]?.embedding
          if (vec) {
            const score = cosineSimilarity(qVector, vec)
            scored.push({ ...itemSummary(item), score, text: text.slice(0, 100) })
          }
        }
      } catch {}
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.filter(s => s.score > 0.1).slice(0, 10)
    res.json({ query: q, count: top.length, items: top })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Related items — find items semantically similar to a given item
app.get('/api/board/:id/items/:itemId/related', async (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const target = vp.items.find(i => i.id === req.params.itemId)
  if (!target) { res.status(404).json({ error: 'Item not found' }); return }

  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || ''
  if (!openrouterKey) { res.status(501).json({ error: 'Related items requires OPENROUTER_API_KEY env var' }); return }

  try {
    const targetText = [target.kind, target.text, target.raw, target.description, target.purpose, target.label, target.url, target.fontFamily, target.hex, (target.tags || []).join(' ')].filter(Boolean).join(' ')
    const embRes = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: targetText.slice(0, 8000) }),
    })
    if (!embRes.ok) { res.status(502).json({ error: 'Embedding API failed' }); return }
    const embData = await embRes.json()
    const tVector = embData.data?.[0]?.embedding
    if (!tVector) { res.status(502).json({ error: 'No embedding returned' }); return }

    const nonConn = vp.items.filter(i => i.kind !== 'connector' && i.id !== target.id)
    const scored = []
    for (const item of nonConn) {
      const text = [item.kind, item.text, item.raw, item.description, item.purpose, item.label, item.url, item.fontFamily, item.hex, (item.tags || []).join(' ')].filter(Boolean).join(' ')
      try {
        const r = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: text.slice(0, 8000) }),
        })
        if (r.ok) {
          const d = await r.json()
          const vec = d.data?.[0]?.embedding
          if (vec) {
            const score = cosineSimilarity(tVector, vec)
            scored.push({ ...itemSummary(item), score })
          }
        }
      } catch {}
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.filter(s => s.score > 0.2).slice(0, 5)
    res.json({ target: itemSummary(target), count: top.length, related: top })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Clear board — remove all non-connector items
app.delete('/api/board/:id/items/all', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return
  const count = vp.items.filter(i => i.kind !== 'connector').length
  vp.items = vp.items.filter(i => i.kind === 'connector')
  writeBoard(req.params.id, state)
  res.json({ ok: true, removed: count })
})

// Arrange items
app.post('/api/board/:id/arrange', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const { layout, cols, gap } = req.body
  const positioned = vp.items.filter(i => i.kind !== 'connector' && i.pos)
  const g = gap ?? 20
  let offset = 0

  switch (layout) {
    case 'grid': {
      const c = cols || 4
      positioned.forEach((item, idx) => {
        item.pos = { x: 50 + (idx % c) * ((item.size?.w ?? 250) + g), y: 50 + Math.floor(idx / c) * ((item.size?.h ?? 150) + g) }
      })
      break
    }
    case 'stack-h':
      positioned.forEach(item => {
        item.pos = { x: 50 + offset, y: 50 }
        offset += (item.size?.w ?? 250) + g
      })
      break
    case 'stack-v':
      positioned.forEach(item => {
        item.pos = { x: 50, y: 50 + offset }
        offset += (item.size?.h ?? 150) + g
      })
      break
    case 'spiral':
      positioned.forEach((item, idx) => {
        const angle = idx * 0.8
        const radius = 150 + idx * g * 0.3
        item.pos = { x: 400 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius }
      })
      break
    default:
      res.status(400).json({ error: 'Invalid layout. Use: grid, stack-h, stack-v, spiral' })
      return
  }

  writeBoard(req.params.id, state)
  res.json({ ok: true, arranged: positioned.length, layout })
})

// Export as creative brief
app.get('/api/board/:id/brief', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const nonConn = vp.items.filter(i => i.kind !== 'connector')
  const palette = [], typography = [], notes = [], images = []
  for (const item of nonConn) {
    if (item.kind === 'palette') for (const c of item.colors || []) palette.push({ hex: c.hex, name: c.label })
    if (item.kind === 'swatch') palette.push({ hex: item.hex, name: item.name, usage: item.usage })
    if (item.kind === 'font') typography.push({ family: item.fontFamily, weights: item.weights })
    if (item.kind === 'note' || item.kind === 'text') notes.push({ text: item.text || item.raw, purpose: item.purpose })
    if (item.kind === 'image') images.push({ description: item.description, source: item.source })
  }

  const format = req.query.format || 'markdown'
  if (format === 'json') {
    res.json({ board: state.project?.name, items: nonConn.length, palette, typography, notes, images })
    return
  }

  const lines = [`# Creative Brief — ${state.project?.name}`, '', `**Items:** ${nonConn.length}`, '']
  if (palette.length) lines.push('## Palette', ...palette.map(c => `- \`${c.hex}\` ${c.name || ''}`), '')
  if (typography.length) lines.push('## Typography', ...typography.map(t => `- ${t.family} (${(t.weights || []).join(', ')})`), '')
  if (images.length) lines.push('## Visual References', ...images.map(i => `- ${i.description} ${i.source || ''}`), '')
  if (notes.length) lines.push('## Notes', ...notes.map(n => `- ${n.text}`), '')
  res.type('text').send(lines.join('\n'))
})

// ─── Lesson Generation ──────────────────────────────────────────────
// Generates educational content and adds it to the board.

function generateLessonSlides(topic, gradeLevel, slideCount, includeQuizzes) {
  const slides = []
  const level = gradeLevel.toLowerCase()
  const isYoung = ['k-2', '3-5'].includes(level)

  // Intro slide
  slides.push({
    type: 'concept',
    title: `Welcome to ${topic}!`,
    content: isYoung
      ? `Hi there! Today we're going to learn about ${topic}. It's going to be fun!`
      : `Let's explore ${topic}. This lesson will cover the key concepts and help you understand this important topic.`,
    narration: isYoung
      ? `Hi friends! Are you ready to learn about ${topic}? Let's get started!`
      : `Welcome to this lesson on ${topic}. By the end, you'll have a solid understanding of the fundamentals.`,
  })

  // What is it slide
  slides.push({
    type: 'concept',
    title: `What is ${topic}?`,
    content: isYoung
      ? `${topic} is something really cool that we use all the time. Let's find out what it is!`
      : `${topic} is a fundamental concept that plays a key role in many areas. Understanding it opens doors to many applications.`,
    narration: isYoung
      ? `So what exactly is ${topic}? Let me explain it in a way that's easy to understand.`
      : `Let's start by defining what ${topic} actually is and why it matters.`,
  })

  // Key concepts
  const concepts = [
    { title: `The Basics of ${topic}`, content: `Every topic has building blocks. For ${topic}, the foundational concepts are essential to understand before moving on to more complex ideas.` },
    { title: `How ${topic} Works`, content: `Now that we know what ${topic} is, let's look at how it works. The mechanisms and principles behind it are fascinating.` },
    { title: `Why ${topic} Matters`, content: `${topic} isn't just theoretical - it has real-world applications that affect our daily lives in many ways.` },
    { title: `${topic} in Practice`, content: `Let's see how ${topic} is used in the real world. From science to technology, its applications are vast.` },
    { title: `Key Principles of ${topic}`, content: `Understanding the core principles of ${topic} will help you apply this knowledge in different contexts.` },
  ]

  for (let i = 0; i < Math.min(slideCount - 4, concepts.length); i++) {
    slides.push({
      type: 'concept',
      title: concepts[i].title,
      content: concepts[i].content,
      narration: `Let me tell you about ${concepts[i].title.toLowerCase()}.`,
    })
  }

  // Quiz slides
  if (includeQuizzes) {
    slides.push({
      type: 'quiz',
      title: 'Quick Check!',
      questions: [
        {
          question: `What is the main purpose of ${topic}?`,
          options: ['To confuse people', 'To solve problems', 'To make things harder', 'None of the above'],
          correctAnswer: 1,
          explanation: `${topic} is used to solve problems and understand the world better!`,
        },
        {
          question: `True or False: ${topic} is only useful in school.`,
          options: ['True', 'False'],
          correctAnswer: 1,
          explanation: `False! ${topic} is used in many real-world situations.`,
        },
      ],
    })
  }

  // Summary slide
  slides.push({
    type: 'summary',
    title: 'Great Job!',
    content: `You've learned about ${topic}! Remember the key concepts we covered and try to apply them in your daily life.`,
    narration: `Congratulations! You've completed the lesson on ${topic}. Keep exploring and learning!`,
  })

  return slides
}

app.post('/api/board/:id/lesson', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return
  const vp = getVpOr404(state, res)
  if (!vp) return

  const { topic, grade_level = '9-12', slide_count = 8, include_quizzes = true } = req.body || {}

  if (!topic) {
    res.status(400).json({ error: 'topic is required' })
    return
  }

  const slides = generateLessonSlides(topic, grade_level, slide_count, include_quizzes)

  // Add region for the lesson
  const regionId = randomUUID()
  vp.items.push({
    kind: 'region',
    id: regionId,
    label: `Lesson: ${topic}`,
    color: '#4CAF50',
    fillColor: 'rgba(76, 175, 80, 0.04)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.2,
    purpose: `${grade_level} lesson on ${topic}`,
    importance: 'Educational content',
    tags: ['lesson', topic.toLowerCase()],
    locked: false,
    pos: { x: 50, y: 50 },
    size: { w: 600, h: slides.length * 120 + 100 },
  })

  // Build lesson object for presentation mode
  const lessonSlides = slides.map((slide, idx) => {
    const slideItems = []
    const y = 100 + idx * 120

    // Slide title as note
    slideItems.push({
      kind: 'note',
      id: randomUUID(),
      text: `${idx + 1}. ${slide.title}`,
      purpose: slide.type,
      importance: slide.type === 'quiz' ? 'Quiz' : 'Content',
      tags: ['lesson', slide.type],
      pos: { x: 80, y },
    })

    // Slide content as text
    if (slide.content) {
      slideItems.push({
        kind: 'text',
        id: randomUUID(),
        raw: slide.content,
        pos: { x: 300, y },
        size: { w: 320, h: 80 },
      })
    }

    // Add items to viewport
    slideItems.forEach(item => vp.items.push(item))

    return {
      id: randomUUID(),
      type: slide.type,
      order: idx,
      title: slide.title,
      content: slideItems,
      narration: {
        script: slide.narration || '',
        duration: 30,
        rate: 0.85,
        pitch: 1.0,
        highlights: [],
      },
      interactions: [],
      ...(slide.questions && { quiz: slide.questions }),
    }
  })

  // Store lesson in board state for presentation mode
  state.lesson = {
    id: state.project?.id || randomUUID(),
    name: topic,
    viewports: state.project?.viewports || [],
    components: state.project?.components || [],
    settings: state.project?.settings || {
      apiKey: '', defaultModel: 'anthropic/claude-sonnet-4',
      jevThreshold: 0.2, multiAgent: false, theme: 'dark',
      canvasBg: '#0c0814', canvasBgType: 'color', canvasBgVideo: '',
      customBgUrls: [], customBgLabels: {},
    },
    snapshots: state.project?.snapshots || [],
    annotations: state.project?.annotations || [],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    metadata: {
      title: topic,
      subject: 'General',
      gradeLevel: grade_level,
      estimatedTime: `${slides.length * 2} minutes`,
      learningObjectives: [`Understand ${topic}`],
      author: 'AI Generated',
      created: new Date().toISOString(),
    },
    slides: lessonSlides,
    navigation: 'linear',
  }

  writeBoard(req.params.id, state)

  res.json({
    ok: true,
    topic,
    gradeLevel: grade_level,
    slideCount: slides.length,
    slides: slides.map((s, i) => ({ index: i + 1, type: s.type, title: s.title })),
    lessonId: state.lesson.id,
    presentationUrl: `/board/${req.params.id}?lesson=true`,
  })
})

// Get lesson data for presentation
app.get('/api/board/:id/lesson', (req, res) => {
  const state = getBoardOr404(req.params.id, res)
  if (!state) return

  if (!state.lesson) {
    res.status(404).json({ error: 'No lesson found on this board' })
    return
  }

  res.json(state.lesson)
})

// ─── MCP SSE Transport ──────────────────────────────────────────────
// Full parity with the stdio server + project management tools.

const mcpSessions = new Map()

// SSE endpoint — streams responses, accepts messages via POST
// Sessions survive connection drops for 5 minutes (Railway kills idle SSE).
app.get('/mcp/sse', (req, res) => {
  const sessionId = randomUUID()
  const boardId = req.query.board || null
  const proto = req.get('x-forwarded-proto') || req.protocol
  const host = req.get('x-forwarded-host') || req.get('host')
  const origin = process.env.PUBLIC_URL || `${proto}://${host}`
  const endpointUrl = `${origin}/mcp/message?sessionId=${sessionId}`

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  })
  res.write(`event: endpoint\ndata: ${JSON.stringify({ endpoint: endpointUrl })}\n\n`)
  res.flush?.()

  // Store session — survives even if this SSE connection drops
  mcpSessions.set(sessionId, { res, boardId, lastSeen: Date.now() })

  // Heartbeat — if it fails, mark connection as stale but don't delete session
  const heartbeat = setInterval(() => {
    try {
      res.write(':ping\n\n'); res.flush?.()
      const session = mcpSessions.get(sessionId)
      if (session) session.lastSeen = Date.now()
    } catch {
      clearInterval(heartbeat)
    }
  }, 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    // Don't delete session — allow POST /mcp/message to still work
    // Session will expire after 5 minutes of inactivity
    const session = mcpSessions.get(sessionId)
    if (session) session.res = null // mark as disconnected
  })
})

// Expire stale sessions every 60s
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of mcpSessions) {
    if (now - session.lastSeen > 300_000) mcpSessions.delete(id) // 5 min
  }
}, 60_000)

app.post('/mcp/message', async (req, res) => {
  const sessionId = req.query.sessionId
  const session = mcpSessions.get(sessionId)
  if (!session) { res.status(404).json({ jsonrpc: '2.0', id: req.body?.id, error: { code: -32000, message: 'Session expired — reconnect SSE' } }); return }
  session.lastSeen = Date.now()

  try {
    const response = await handleMcpMessage(req.body, session.boardId)
    // Try to send on SSE stream; if disconnected, return as JSON response
    if (session.res) {
      session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`)
      session.res.flush?.()
    }
    res.json(response)
  } catch (err) {
    res.status(500).json({ jsonrpc: '2.0', id: req.body?.id, error: { code: -32603, message: err.message } })
  }
})

// Simple POST-only MCP endpoint — for clients that can't do SSE
// Single request → single JSON-RPC response (no streaming, no session).
app.post('/mcp', async (req, res) => {
  try {
    const body = req.body
    // If it's a notification (no id), just ack
    if (body.id === undefined || body.id === null) { res.json({ jsonrpc: '2.0' }); return }
    // Determine board from query param or most recent
    const boardId = req.query.board || null
    const response = await handleMcpMessage(body, boardId)
    res.json(response)
  } catch (err) {
    res.status(500).json({ jsonrpc: '2.0', id: req.body?.id, error: { code: -32603, message: err.message } })
  }
})

function getActiveViewport(state) {
  return state?.project?.viewports?.[0]
}

async function handleMcpMessage(message, sessionBoardId) {
  if (message.method === 'initialize') {
    return {
      jsonrpc: '2.0', id: message.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'moodbored', version: '1.0.0' },
      },
    }
  }

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
          // SECURITY: export_to_folder tool removed — arbitrary file write vulnerability
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
  // SECURITY: export_to_folder removed — arbitrary file write vulnerability

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
// ─── MCP Info Page ──────────────────────────────────────────────────

function buildMcpPage(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol
  const host = req.get('x-forwarded-host') || req.get('host')
  const origin = process.env.PUBLIC_URL || `${proto}://${host}`
  const boards = listBoards()
  const boardList = boards.length > 0
    ? boards.map(b => `<li><code>${b.id}</code> — ${b.name} (${b.itemCount} items)</li>`).join('')
    : '<li>No boards yet. Create one at <a href="/">the app</a>.</li>'

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MoodBored MCP Server</title>
<style>body{font-family:Inter,system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#e8e0f5;background:#0c0814}
code{background:#1a0030;padding:2px 6px;border-radius:4px;font-size:13px}
pre{background:#1a0030;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px}
h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #2d0055;padding-bottom:6px}
a{color:#7c6cbf}li{margin:4px 0}ul{padding-left:20px}</style></head>
<body>
<h1>MoodBored MCP Server</h1>
<p>Visual mood-board workspace — any LLM can read, write, and arrange items via MCP tools.</p>

<h2>Available Boards</h2>
<ul>${boardList}</ul>

<h2>Connect via POST (simplest — works everywhere)</h2>
<pre>POST ${origin}/mcp?board=BOARD_ID

curl -X POST "${origin}/mcp?board=BOARD_ID" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_board","arguments":{}}}'</pre>
<p>Single request → single JSON-RPC response. No sessions, no SSE. Works with any HTTP client.</p>

<h2>Connect via SSE (OpenCode, Cursor, Claude Desktop)</h2>
<pre>GET ${origin}/mcp/sse?board=BOARD_ID</pre>
<p>SSE stream with heartbeat. Messages via <code>POST /mcp/message?sessionId=...</code></p>

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
<li><strong>semantic_search</strong> — meaning-based search</li>
<li><strong>related_items</strong> — find items related to a given item</li>
<li><strong>arrange_items</strong> — grid, stack, spiral layouts</li>
<li><strong>clear_board</strong> — wipe all items</li>
</ul>

<h2>REST API (same tools, plain HTTP)</h2>
<p>For clients that don't support MCP — use <code>curl</code>, <code>fetch</code>, Postman, any language.</p>
<table style="width:100%;border-collapse:collapse;font-size:13px">
<tr style="border-bottom:1px solid #2d0055;text-align:left"><th style="padding:6px 0">Method</th><th>Endpoint</th><th>Description</th></tr>
<tr><td style="padding:4px 0"><code>GET</code></td><td><code>/api/boards</code></td><td>List all boards</td></tr>
<tr><td style="padding:4px 0"><code>POST</code></td><td><code>/api/boards</code></td><td>Create a board <code>{name}</code></td></tr>
<tr><td style="padding:4px 0"><code>GET</code></td><td><code>/api/board/:id</code></td><td>Read full board state</td></tr>
<tr><td style="padding:4px 0"><code>POST</code></td><td><code>/api/board/:id/items</code></td><td>Add items <code>[{kind, text, ...}]</code></td></tr>
<tr><td style="padding:4px 0"><code>DELETE</code></td><td><code>/api/board/:id/items</code></td><td>Remove items <code>{ids: [...]}</code></td></tr>
<tr><td style="padding:4px 0"><code>DELETE</code></td><td><code>/api/board/:id/items/all</code></td><td>Clear entire board</td></tr>
<tr><td style="padding:4px 0"><code>PATCH</code></td><td><code>/api/board/:id/items/:itemId</code></td><td>Update item properties</td></tr>
<tr><td style="padding:4px 0"><code>GET</code></td><td><code>/api/board/:id/search?q=&tag=&kind=</code></td><td>Text + tag search</td></tr>
<tr><td style="padding:4px 0"><code>GET</code></td><td><code>/api/board/:id/semantic?q=</code></td><td>Semantic search (meaning-based)</td></tr>
<tr><td style="padding:4px 0"><code>GET</code></td><td><code>/api/board/:id/items/:itemId/related</code></td><td>Find related items</td></tr>
<tr><td style="padding:4px 0"><code>POST</code></td><td><code>/api/board/:id/arrange</code></td><td>Arrange <code>{layout, cols?, gap?}</code></td></tr>
<tr><td style="padding:4px 0"><code>GET</code></td><td><code>/api/board/:id/brief?format=markdown|json</code></td><td>Export creative brief</td></tr>
<tr><td style="padding:4px 0"><code>GET</code></td><td><code>/api/board/:id/events</code></td><td>SSE stream of board changes</td></tr>
</table>
<p style="margin-top:8px"><strong>Example:</strong></p>
<pre>curl -X POST ${origin}/api/board/BOARD_ID/items \\
  -H "Content-Type: application/json" \\
  -d '[{"kind":"note","text":"Hello from curl!"},{"kind":"palette","label":"My Colors","colors":[{"hex":"#FF6B35","label":"Orange"}]}]'</pre>

<h2>Resources</h2>
<ul>
<li><code>board://current</code> — full board JSON</li>
<li><code>board://summary</code> — text summary</li>
</ul>
</body></html>`
}

app.get('/mcp', (req, res) => {
  res.type('html').send(buildMcpPage(req))
})

// Sanity check: verify rendered page uses correct origin
app.get('/mcp/selftest', (req, res) => {
  const proto = req.get('x-forwarded-proto') || req.protocol
  const host = req.get('x-forwarded-host') || req.get('host')
  const expected = process.env.PUBLIC_URL || `${proto}://${host}`
  const rendered = buildMcpPage(req)
  const ok = rendered.includes(expected)
  res.json({ expected, rendered_contains_localhost: rendered.includes('localhost'), ok })
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

// ─── API Proxy (keeps keys server-side) ──────────────────────────────

// Proxy OpenRouter chat completions
app.post('/api/ai/chat', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY || ''
  if (!apiKey) {
    res.status(501).json({ error: 'AI features require OPENROUTER_API_KEY on the server. Set this environment variable to enable AI.' })
    return
  }
  
  // Check if streaming is requested
  const isStreaming = req.body?.stream === true
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://moodbored.app',
        'X-Title': 'MoodBored',
      },
      body: JSON.stringify(req.body),
    })
    
    if (!response.ok) {
      const status = response.status
      const errorText = await response.text().catch(() => '')
      console.error(`[MoodBored] OpenRouter API error ${status}:`, errorText.slice(0, 200))
      
      if (status === 401) {
        res.status(502).json({ error: 'AI service authentication failed. Check OPENROUTER_API_KEY.' })
      } else if (status === 429) {
        res.status(429).json({ error: 'AI service rate limited. Try again later.' })
      } else {
        res.status(502).json({ error: `AI service error (${status})` })
      }
      return
    }
    
    // Handle streaming response
    if (isStreaming) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      
      const reader = response.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      }
      pump().catch(() => res.end())
    } else {
      const data = await response.json()
      res.status(200).json(data)
    }
  } catch (err) {
    res.status(502).json({ error: `AI proxy error: ${err.message}` })
  }
})

// Proxy OpenRouter image generation
app.post('/api/ai/generate-image', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY || ''
  if (!apiKey) {
    res.status(501).json({ error: 'Image generation requires OPENROUTER_API_KEY on the server' })
    return
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    res.status(502).json({ error: `Image generation error: ${err.message}` })
  }
})

// Proxy Unsplash search
app.get('/api/unsplash/search', async (req, res) => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY || ''
  if (!accessKey) {
    res.status(501).json({ error: 'Unsplash search requires UNSPLASH_ACCESS_KEY on the server' })
    return
  }
  try {
    const { q = '', per_page = 20, page = 1 } = req.query
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${per_page}&page=${page}`,
      { headers: { 'Authorization': `Client-ID ${accessKey}` } }
    )
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    res.status(502).json({ error: `Unsplash error: ${err.message}` })
  }
})

// ─── Multi-Provider AI Chat ─────────────────────────────────────────
// Unified endpoint that routes to different providers based on model prefix
// Supports 12 providers for maximum global accessibility

const AI_PROVIDERS = {
  // ─── Cloud Providers ───────────────────────────────────────────────
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    envKey: 'OPENROUTER_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://moodbored.app',
      'X-Title': 'MoodBored',
    }),
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    envKey: 'ANTHROPIC_API_KEY',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }),
    transform: (body) => {
      const messages = body.messages || []
      const system = messages.find(m => m.role === 'system')?.content || ''
      const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content,
      }))
      return {
        model: body.model?.replace('anthropic/', '') || 'claude-3-5-sonnet-20241022',
        max_tokens: body.max_tokens || 4096,
        messages: userMessages,
        ...(system && { system }),
        ...(body.temperature && { temperature: body.temperature }),
      }
    },
    transformResponse: (data) => ({
      choices: [{
        message: { role: 'assistant', content: data.content?.[0]?.text || '' },
        finish_reason: data.stop_reason,
      }],
      usage: data.usage,
    }),
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    envKey: 'GEMINI_API_KEY',
    headers: () => ({ 'Content-Type': 'application/json' }),
    transform: (body) => {
      const messages = body.messages || []
      const system = messages.find(m => m.role === 'system')?.content || ''
      const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
      return {
        contents: userMessages,
        ...(system && { systemInstruction: { parts: [{ text: system }] } }),
        generationConfig: {
          ...(body.temperature && { temperature: body.temperature }),
          ...(body.max_tokens && { maxOutputTokens: body.max_tokens }),
        },
      }
    },
    transformResponse: (data) => ({
      choices: [{
        message: { role: 'assistant', content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' },
        finish_reason: data.candidates?.[0]?.finishReason,
      }],
    }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  together: {
    url: 'https://api.together.xyz/v1/chat/completions',
    envKey: 'TOGETHER_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    envKey: 'MISTRAL_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  cohere: {
    url: 'https://api.cohere.ai/v1/chat',
    envKey: 'COHERE_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    transform: (body) => ({
      model: body.model || 'command-r-plus',
      message: body.messages?.[body.messages.length - 1]?.content || '',
      chat_history: body.messages?.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: m.content,
      })) || [],
      ...(body.temperature && { temperature: body.temperature }),
      ...(body.max_tokens && { max_tokens: body.max_tokens }),
    }),
    transformResponse: (data) => ({
      choices: [{
        message: { role: 'assistant', content: data.text || '' },
        finish_reason: data.finish_reason,
      }],
    }),
  },
  perplexity: {
    url: 'https://api.perplexity.ai/chat/completions',
    envKey: 'PERPLEXITY_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  fireworks: {
    url: 'https://api.fireworks.ai/inference/v1/chat/completions',
    envKey: 'FIREWORKS_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    envKey: 'DEEPSEEK_API_KEY',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
  // ─── Local Providers (no API key needed) ───────────────────────────
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434/api/chat',
    envKey: null,
    headers: () => ({ 'Content-Type': 'application/json' }),
    transform: (body) => ({
      model: body.model || 'llama3',
      messages: body.messages || [],
      stream: body.stream || false,
      ...(body.temperature && { options: { temperature: body.temperature } }),
    }),
    transformResponse: (data) => ({
      choices: [{
        message: data.message || { role: 'assistant', content: '' },
        finish_reason: data.done ? 'stop' : null,
      }],
    }),
  },
  lmstudio: {
    url: process.env.LMSTUDIO_URL || 'http://localhost:1234/v1/chat/completions',
    envKey: null,
    headers: () => ({ 'Content-Type': 'application/json' }),
  },
  // ─── Catch-all for OpenAI-compatible endpoints ─────────────────────
  custom: {
    url: process.env.CUSTOM_AI_URL || 'http://localhost:8080/v1/chat/completions',
    envKey: 'CUSTOM_AI_KEY',
    headers: (key) => ({
      ...(key && { 'Authorization': `Bearer ${key}` }),
      'Content-Type': 'application/json',
    }),
  },
}

function detectProvider(model) {
  if (!model) return 'openrouter'
  const lower = model.toLowerCase()
  // Cloud providers
  if (lower.startsWith('openai/') || lower.startsWith('gpt-')) return 'openai'
  if (lower.startsWith('anthropic/') || lower.startsWith('claude')) return 'anthropic'
  if (lower.startsWith('gemini/') || lower.startsWith('google/')) return 'gemini'
  if (lower.startsWith('groq/') || lower.startsWith('llama3-70b-8192')) return 'groq'
  if (lower.startsWith('together/') || lower.startsWith('meta-llama/')) return 'together'
  if (lower.startsWith('mistral/') || lower.startsWith('mixtral/')) return 'mistral'
  if (lower.startsWith('cohere/') || lower.startsWith('command')) return 'cohere'
  if (lower.startsWith('perplexity/') || lower.startsWith('pplx-')) return 'perplexity'
  if (lower.startsWith('fireworks/') || lower.startsWith('accounts/fireworks/')) return 'fireworks'
  if (lower.startsWith('deepseek/') || lower.startsWith('deepseek')) return 'deepseek'
  // Local providers
  if (lower.startsWith('ollama/') || lower.startsWith('local/')) return 'ollama'
  if (lower.startsWith('lmstudio/') || lower.startsWith('local-lm/')) return 'lmstudio'
  if (lower.startsWith('custom/')) return 'custom'
  return 'openrouter'
}

function getProviderConfig(provider) {
  return AI_PROVIDERS[provider] || AI_PROVIDERS.openrouter
}

app.post('/api/ai/chat', async (req, res) => {
  const provider = detectProvider(req.body?.model)
  const config = getProviderConfig(provider)
  const apiKey = config.envKey ? (process.env[config.envKey] || '') : ''

  if (config.envKey && !apiKey) {
    res.status(501).json({
      error: `${provider} requires ${config.envKey} environment variable`,
      provider,
      availableProviders: Object.keys(AI_PROVIDERS).filter(p => !AI_PROVIDERS[p].envKey || process.env[AI_PROVIDERS[p].envKey]),
    })
    return
  }

  const isStreaming = req.body?.stream === true

  try {
    // Transform request if needed
    const requestBody = config.transform ? config.transform(req.body, req.body.model) : req.body
    const url = config.transform
      ? config.url // Anthropic/Gemini/Ollama use different URL patterns
      : config.url

    // Build full URL for providers that need it
    let fullUrl = url
    if (provider === 'gemini') {
      const model = req.body.model?.replace('gemini/', '').replace('google/', '') || 'gemini-pro'
      const action = isStreaming ? 'streamGenerateContent' : 'generateContent'
      fullUrl = `${url}/${model}:${action}?key=${apiKey}`
    }
    if (provider === 'ollama') {
      fullUrl = config.url
    }

    const headers = config.headers(apiKey)
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const status = response.status
      const errorText = await response.text().catch(() => '')
      console.error(`[MoodBored] ${provider} API error ${status}:`, errorText.slice(0, 200))

      if (status === 401) {
        res.status(502).json({ error: `${provider} authentication failed. Check ${config.envKey}.` })
      } else if (status === 429) {
        res.status(429).json({ error: `${provider} rate limited. Try again later.` })
      } else {
        res.status(502).json({ error: `${provider} error (${status})` })
      }
      return
    }

    // Handle streaming
    if (isStreaming && provider !== 'gemini') {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const reader = response.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
        res.end()
      }
      pump().catch(() => res.end())
    } else {
      const data = await response.json()
      // Transform response if needed
      const responseData = config.transformResponse ? config.transformResponse(data) : data
      res.status(200).json(responseData)
    }
  } catch (err) {
    res.status(502).json({ error: `${provider} proxy error: ${err.message}` })
  }
})

// List available providers
app.get('/api/ai/providers', (req, res) => {
  const providers = Object.entries(AI_PROVIDERS).map(([name, config]) => ({
    name,
    available: !config.envKey || !!process.env[config.envKey],
    envKey: config.envKey,
    models: name === 'openrouter' ? ['anthropic/claude-sonnet-4', 'openai/gpt-4', 'google/gemini-pro', 'meta-llama/llama-3-70b', 'mistralai/mistral-large'] :
            name === 'openai' ? ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'] :
            name === 'anthropic' ? ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'] :
            name === 'gemini' ? ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'] :
            name === 'groq' ? ['llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'] :
            name === 'together' ? ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'codellama/CodeLlama-70b-Instruct-hf'] :
            name === 'mistral' ? ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] :
            name === 'cohere' ? ['command-r-plus', 'command-r', 'command'] :
            name === 'perplexity' ? ['llama-3-sonar-large-32k-chat', 'llama-3-sonar-small-32k-chat'] :
            name === 'fireworks' ? ['accounts/fireworks/models/llama-v3-70b', 'accounts/fireworks/models/mixtral-8x7b'] :
            name === 'deepseek' ? ['deepseek-chat', 'deepseek-coder'] :
            name === 'ollama' ? ['llama3', 'mistral', 'codellama', 'phi3', 'gemma'] :
            name === 'lmstudio' ? ['local-model', 'default'] :
            name === 'custom' ? ['custom-model'] : [],
  }))
  res.json({ providers })
})

// ─── SPA Fallback (catch-all, last) ─────────────────────────────────

// Serve static files with proper caching
// index.html should NOT be cached (always get fresh version)
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1y',
  immutable: true,
  index: false, // Don't serve index.html from static
}))

// Serve index.html with no-cache headers for root
app.get(['/', '/index.html'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// SPA fallback - only for routes that don't match static files
// This allows Express static middleware to serve JS/CSS/assets first
app.get('/{*splat}', (req, res, next) => {
  // Skip if it's an API route (should have been handled above)
  if (req.path.startsWith('/api/') || req.path.startsWith('/mcp/')) {
    return next()
  }
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// ─── Start ──────────────────────────────────────────────────────────

ensureDir(BOARDS_DIR)

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('[MoodBored] Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Process error handlers
process.on('uncaughtException', (err) => {
  console.error('[MoodBored] Uncaught exception:', err)
  // Don't exit - let the server continue running
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MoodBored] Unhandled rejection at:', promise, 'reason:', reason)
})

// Restore boards from Supabase if local filesystem is empty
await loadFromSupabase().catch(() => {})

app.listen(PORT, () => {
  const origin = process.env.PUBLIC_URL || `http://localhost:${PORT}`
  console.log(`MoodBored server on port ${PORT}`)
  console.log(`  Frontend:  ${origin}`)
  console.log(`  Boards:    ${origin}/api/boards`)
  console.log(`  MCP SSE:   ${origin}/mcp/sse`)
  console.log(`  Board dir: ${BOARDS_DIR}`)
})
// Force Railway rebuild Mon Oct  5 12:11:35 PDT 2026
