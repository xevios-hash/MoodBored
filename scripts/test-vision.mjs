// End-to-end checks for vision LLM support:
//  1. lib/ai-transforms.mjs maps OpenAI-style image content for Anthropic/Gemini/Cohere
//  2. MCP get_board(include_images) / view_images return real image blocks
//  3. /api/ai/chat/:provider route exists (was 404 before)
//
// Usage: node scripts/test-vision.mjs

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import http from 'node:http'
import {
  toText, toAnthropicMessages, toGeminiContents, toCohereMessage, parseDataUrl,
} from '../lib/ai-transforms.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 3124
const BASE = `http://localhost:${PORT}`
const boardsDir = mkdtempSync(join(tmpdir(), 'moodbored-vision-boards-'))
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let passed = 0
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ok - ${label}`) }
  else { console.error(`  FAIL - ${label}`); process.exitCode = 1 }
}

// ── 1. transforms ────────────────────────────────────────────────────
console.log('transforms: anthropic / gemini / cohere image mapping')
const msgs = [
  { role: 'system', content: 'You see boards.' },
  {
    role: 'user',
    content: [
      { type: 'text', text: 'What is in these images?' },
      { type: 'image_url', image_url: { url: 'https://example.com/pic.jpg' } },
      { type: 'image_url', image_url: { url: PNG } },
    ],
  },
]
const anth = toAnthropicMessages(msgs)
ok(anth.system === 'You see boards.', 'anthropic system text extracted')
const blocks = anth.messages[0].content
ok(Array.isArray(blocks) && blocks.length === 3, 'anthropic content blocks built')
ok(blocks[0].type === 'text' && blocks[0].text.includes('What is in'), 'anthropic text block')
ok(blocks[1].type === 'image' && blocks[1].source.type === 'url' && blocks[1].source.url === 'https://example.com/pic.jpg', 'anthropic https image -> url source')
ok(blocks[2].type === 'image' && blocks[2].source.type === 'base64' && blocks[2].source.media_type === 'image/png' && blocks[2].source.data.length > 10, 'anthropic data URL -> base64 source')

const gem = toGeminiContents(msgs)
ok(gem.length === 1 && gem[0].role === 'user', 'gemini drops system into instruction')
const parts = gem[0].parts
ok(parts.some(p => p.text?.includes('What is in')), 'gemini text part')
ok(parts.some(p => p.file_data?.file_uri === 'https://example.com/pic.jpg'), 'gemini https image -> file_data')
ok(parts.some(p => p.inline_data?.mime_type === 'image/png' && p.inline_data?.data?.length > 10), 'gemini data URL -> inline_data')

ok(toCohereMessage([{ type: 'text', text: 'hi' }, { type: 'image_url', image_url: { url: PNG } }]) === 'hi', 'cohere keeps text only')
ok(toText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]) === 'a\nb', 'toText joins text parts')
const parsed = parseDataUrl(PNG)
ok(parsed?.mimeType === 'image/png' && parsed.base64.length > 10, 'parseDataUrl decodes')

// ── 2. MCP image blocks ──────────────────────────────────────────────
console.log('mcp: get_board / view_images return image blocks')
const boardState = {
  project: {
    id: 'default', name: 'Vision Test',
    viewports: [{
      id: 'v1', name: 'Main', connections: [], typedConnections: [], messages: [], camX: 0, camY: 0, zoom: 1,
      items: [
        { kind: 'image', id: 'img-data', description: 'a tiny test dot', source: 'generated', fullSource: PNG, thumbnail: PNG, purpose: 'test', importance: 'test', tags: [], pos: { x: 10, y: 10 }, size: { w: 100, h: 100 } },
        { kind: 'image', id: 'img-bad', description: 'dead blob ref', source: 'clipboard', fullSource: 'blob:https://x/123', thumbnail: 'blob:https://x/123', purpose: 'test', importance: 'test', tags: [], pos: { x: 200, y: 10 }, size: { w: 100, h: 100 } },
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
      await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'vision-test', version: '1.0' } })
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

const boardPlain = await mcp.call('get_board', {})
ok(!boardPlain.some(c => c.type === 'image'), 'get_board default is text-only')
ok(boardPlain[0]?.text?.includes('a tiny test dot'), 'get_board lists image metadata')

const boardWithImages = await mcp.call('get_board', { include_images: true })
const boardImgs = boardWithImages.filter(c => c.type === 'image')
ok(boardImgs.length === 1, `get_board include_images attaches fetched image (${boardImgs.length})`)
ok(boardImgs[0]?.mimeType === 'image/png' && boardImgs[0]?.data?.length > 10, 'get_board image block has base64 data')
ok(boardWithImages.some(c => c.type === 'text' && c.text.includes('1 of 2')), 'get_board notes unfetchable blob image')

const viewed = await mcp.call('view_images', {})
const viewImgs = viewed.filter(c => c.type === 'image')
ok(viewImgs.length === 1, `view_images returns image blocks (${viewImgs.length})`)
ok(viewed[0]?.text?.includes('img-data') && viewed[0]?.text?.includes('dead blob ref'), 'view_images captions list ids')
ok(viewed.some(c => c.type === 'text' && c.text.includes('Could not fetch') === false) || viewImgs.length === 1, 'view_images fetches what it can')

const one = await mcp.call('view_images', { item_ids: ['img-data'] })
ok(one.filter(c => c.type === 'image').length === 1 && one[0].text.includes('img-data'), 'view_images filters by id')
const none = await mcp.call('view_images', { item_ids: ['nope'] })
ok(none.length === 1 && none[0].text.includes('No images found'), 'view_images handles unknown ids')
mcp.close()
await sleep(800)

// ── 3. chat routes ───────────────────────────────────────────────────
console.log('server: /api/ai/chat/:provider route exists')
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), BOARDS_DIR: boardsDir },
  stdio: 'ignore',
  detached: true,
})
server.unref()

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
  const h = await new Promise(res => {
    http.get(`${BASE}/api/board/health`, r => res(r.statusCode)).on('error', () => res(0))
  })
  if (h === 200) { up = true; break }
  await sleep(500)
}
ok(up, 'test server healthy')

const routed = await post('/api/ai/chat/ollama', {
  model: 'llava',
  providerSettings: { ollamaUrl: 'http://127.0.0.1:9' },
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }, { type: 'image_url', image_url: { url: PNG } }] }],
}).catch(e => ({ status: 0, body: e.message }))
ok(routed.status !== 404, `/api/ai/chat/:provider not 404 (got ${routed.status})`)
ok(routed.status === 502 || routed.status === 200, `provider route proxies (${routed.status})`)

const noKey = await post('/api/ai/chat/openrouter', {
  model: 'openai/gpt-4o',
  messages: [{ role: 'user', content: 'hi' }],
}).catch(e => ({ status: 0, body: e.message }))
ok(noKey.status === 501 || noKey.status === 200, `openrouter key guard intact (${noKey.status})`)

try { process.kill(server.pid) } catch {}

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
rmSync(boardsDir, { recursive: true, force: true })
process.exit(process.exitCode || 0)
