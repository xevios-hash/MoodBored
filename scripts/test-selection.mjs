// Checks for select-and-talk: MCP discuss_items, REST /api/board/:id/context,
// and HTTP-MCP discuss_items. The user selects items and talks about them; the
// LLM can do the same via these entry points.
//
// Usage: node scripts/test-selection.mjs

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import http from 'node:http'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 3125
const BASE = `http://localhost:${PORT}`
const boardsDir = mkdtempSync(join(tmpdir(), 'moodbored-selection-boards-'))
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let passed = 0
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ok - ${label}`) }
  else { console.error(`  FAIL - ${label}`); process.exitCode = 1 }
}

const boardState = {
  project: {
    id: 'default', name: 'Selection Test',
    viewports: [{
      id: 'v1', name: 'Main', connections: [], typedConnections: [], messages: [], camX: 0, camY: 0, zoom: 1,
      items: [
        { kind: 'note', id: 'n1', text: 'warm coastal vibes for the rebrand', purpose: 'mood', importance: 'high', tags: ['mood'], pos: { x: 10, y: 10 } },
        { kind: 'palette', id: 'p1', label: 'Sunset', colors: [{ hex: '#ff6b35', label: 'coral' }, { hex: '#004e89', label: 'deep' }], tags: [], pos: { x: 200, y: 10 }, size: { w: 320, h: 120 } },
        { kind: 'image', id: 'img1', description: 'sunset over the ocean', source: 'generated', fullSource: PNG, thumbnail: PNG, tags: [], pos: { x: 400, y: 10 }, size: { w: 300, h: 200 } },
        { kind: 'note', id: 'n2', text: 'unrelated note', tags: [], pos: { x: 10, y: 300 } },
      ],
    }],
    components: [],
    settings: {},
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  },
  lastModified: new Date().toISOString(),
}
writeFileSync(join(boardsDir, 'default.json'), JSON.stringify(boardState, null, 2))

// ── MCP stdio: discuss_items ─────────────────────────────────────────
console.log('mcp: discuss_items selects and returns discussion material')
function spawnMcp(extraEnv) {
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', 'npx', 'tsx', 'mcp/mcp-server.ts'], { cwd: ROOT, env: { ...process.env, ...extraEnv } })
    : spawn('npx', ['tsx', 'mcp/mcp-server.ts'], { cwd: ROOT, env: { ...process.env, ...extraEnv } })
  child.stdout.setEncoding('utf-8')
  const pending = new Map()
  let buf = ''
  child.stdout.on('data', d => {
    buf += d
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line)
        if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
      } catch {}
    }
  })
  let nextId = 1
  const rpc = (method, params) => new Promise((resolveP, rejectP) => {
    const id = nextId++
    pending.set(id, resolveP)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    setTimeout(() => { if (pending.delete(id)) rejectP(new Error(`rpc timeout: ${method}`)) }, 30000)
  })
  return {
    child,
    async ready() {
      await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'selection-test', version: '1.0' } })
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    },
    async call(name, args) {
      const res = await rpc('tools/call', { name, arguments: args })
      return res?.result?.content ?? []
    },
    close() {
      try { child.stdin.end() } catch {}
      setTimeout(() => { try { child.kill() } catch {} }, 800).unref?.()
    },
  }
}

const mcp = spawnMcp({
  MOODBORED_BOARDS_DIR: boardsDir,
  MOODBORED_AUTO_OPEN: '0',
  MOODBORED_NO_SERVER: '1',
})
await mcp.ready()

const discussed = await mcp.call('discuss_items', { item_ids: ['n1', 'p1', 'img1'], topic: 'color harmony' })
const discText = discussed.filter(c => c.type === 'text').map(c => c.text).join('\n')
ok(discText.includes('Discussing 3 selected item(s)'), 'discuss_items frames the selection')
ok(discText.includes('focus: color harmony'), 'discuss_items includes topic')
ok(discText.includes('warm coastal vibes'), 'discuss_items includes full note text')
ok(discText.includes('#ff6b35') && discText.includes('coral'), 'discuss_items includes palette colors')
ok(discText.includes('sunset over the ocean') && discText.includes('url=data:image'), 'discuss_items includes image description + url')
ok(discText.includes('Board: http'), 'discuss_items returns Board URL')
ok(discussed.some(c => c.type === 'image' && c.mimeType === 'image/png'), 'discuss_items attaches image pixels')

const multi = await mcp.call('discuss_items', { item_ids: ['n1', 'n2'] })
ok(multi[0].text.includes('unrelated note') && multi[0].text.includes('warm coastal vibes'), 'discuss_items supports multi-select of any kinds')
const miss = await mcp.call('discuss_items', { item_ids: ['nope'] })
ok(miss[0].text.includes('No board items found'), 'discuss_items handles unknown ids')
mcp.close()
await sleep(800)

// ── REST + HTTP MCP ──────────────────────────────────────────────────
console.log('rest: /api/board/:id/context  |  http-mcp: discuss_items')
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), BOARDS_DIR: boardsDir },
  stdio: 'ignore',
  detached: true,
})
server.unref()

function get(path) {
  return new Promise((resolveP, rejectP) => {
    http.get(`${BASE}${path}`, res => {
      let out = ''
      res.on('data', d => { out += d })
      res.on('end', () => resolveP({ status: res.statusCode, body: out }))
    }).on('error', rejectP)
  })
}
function post(path, body) {
  return new Promise((resolveP, rejectP) => {
    const data = JSON.stringify(body)
    const req = http.request({
      host: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let out = ''
      res.on('data', d => { out += d })
      res.on('end', () => resolveP({ status: res.statusCode, body: out }))
    })
    req.on('error', rejectP)
    req.write(data)
    req.end()
  })
}

let up = false
for (let i = 0; i < 40; i++) {
  const h = await get('/api/board/health').catch(() => ({ status: 0 }))
  if (h.status === 200) { up = true; break }
  await sleep(500)
}
ok(up, 'test server healthy')

const ctx = await get('/api/board/default/context?ids=n1,p1&topic=color%20harmony')
ok(ctx.status === 200, `/context responds (${ctx.status})`)
const ctxJson = JSON.parse(ctx.body)
ok(ctxJson.count === 2 && ctxJson.ids.join(',') === 'n1,p1', 'context filters by ids')
ok(ctxJson.text.includes('warm coastal vibes') && ctxJson.text.includes('#ff6b35'), 'context text covers selected items')
ok(ctxJson.topic === 'color harmony', 'context echoes topic')
ok(ctxJson.items.length === 2 && ctxJson.url.includes('/board/default'), 'context returns full items + board url')

const ctxAll = await get('/api/board/default/context')
ok(JSON.parse(ctxAll.body).count === 4, 'context without ids returns all items')
const ctxImg = await get('/api/board/default/context?ids=img1')
ok(JSON.parse(ctxImg.body).images.length === 1 && JSON.parse(ctxImg.body).images[0].url.startsWith('data:image'), 'context lists image urls for vision')

const toolsList = await post('/mcp?board=default', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
ok(JSON.parse(toolsList.body).result.tools.some(t => t.name === 'discuss_items'), 'http-mcp tools/list includes discuss_items')
const httpDiscuss = await post('/mcp?board=default', {
  jsonrpc: '2.0', id: 2, method: 'tools/call',
  params: { name: 'discuss_items', arguments: { item_ids: ['n1', 'img1'], topic: 'mood' } },
})
const httpText = JSON.parse(httpDiscuss.body).result?.content?.[0]?.text || JSON.parse(httpDiscuss.body).result || ''
ok(String(httpText).includes('Discussing 2 selected item(s)'), 'http-mcp discuss_items returns selection')
ok(String(httpText).includes('warm coastal vibes') && String(httpText).includes('sunset over the ocean'), 'http-mcp discuss_items covers item contents')

try { process.kill(server.pid) } catch {}

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
rmSync(boardsDir, { recursive: true, force: true })
process.exit(process.exitCode || 0)
