// End-to-end test for the auto-opening board window.
// Verifies: board auto-creation, "Board: <url>" in responses, server
// auto-start, chromeless window open (once), MOODBORED_AUTO_OPEN=0 opt-out,
// and live SSE updates from stdio MCP writes.
//
// Usage: node scripts/test-mcp-window.mjs

import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import http from 'node:http'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3123'
const PORT = new URL(BASE).port || '3000'
const boardsDir = mkdtempSync(join(tmpdir(), 'moodbored-test-boards-'))

let passed = 0
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ok - ${label}`) }
  else { console.error(`  FAIL - ${label}`); process.exitCode = 1 }
}

function spawnMcp(extraEnv) {
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', 'npx', 'tsx', 'mcp/mcp-server.ts'], { cwd: ROOT, env: { ...process.env, ...extraEnv } })
    : spawn('npx', ['tsx', 'mcp/mcp-server.ts'], { cwd: ROOT, env: { ...process.env, ...extraEnv } })
  child.stdout.setEncoding('utf-8')
  child.stderr.setEncoding('utf-8')
  const pending = new Map()
  let buf = ''
  let stderr = ''
  child.stderr.on('data', d => { stderr += d })
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
    setTimeout(() => { if (pending.delete(id)) rejectP(new Error(`rpc timeout: ${method}`)) }, 20000)
  })
  return {
    child,
    getStderr: () => stderr,
    async ready() {
      await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } })
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    },
    async call(name, args) {
      const res = await rpc('tools/call', { name, arguments: args })
      return res?.result?.content?.[0]?.text ?? JSON.stringify(res)
    },
    close() {
      // Close stdin so the MCP server exits on EOF. Do NOT taskkill /T:
      // the auto-started server.mjs is a descendant but must survive.
      try { child.stdin.end() } catch {}
      setTimeout(() => { try { child.kill() } catch {} }, 1500).unref?.()
    },
  }
}

function getJson(url) {
  return new Promise((resolveP, rejectP) => {
    http.get(url, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => { try { resolveP(JSON.parse(data)) } catch (e) { rejectP(e) } })
    }).on('error', rejectP)
  })
}

async function waitHealthy(ms) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const h = await getJson(`${BASE}/api/board/health`).catch(() => null)
    if (h?.status === 'ok') return true
    await sleep(400)
  }
  return false
}

function collectSse(boardId, ms) {
  return new Promise(resolveP => {
    const events = []
    const req = http.get(`${BASE}/api/board/${boardId}/events`, res => {
      res.setEncoding('utf-8')
      let buf = ''
      res.on('data', d => {
        buf += d
        let idx
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim()
          buf = buf.slice(idx + 1)
          if (line.startsWith('data: ')) {
            try { events.push(JSON.parse(line.slice(6))) } catch { events.push({ raw: line.slice(6) }) }
          }
        }
      })
    })
    req.on('error', e => events.push({ error: e.message }))
    setTimeout(() => { req.destroy(); resolveP(events) }, ms)
  })
}

console.log(`boards dir: ${boardsDir}`)

// ── Phase 1: opt-out + server auto-start + Board URL ──────────────────
console.log('phase 1: MOODBORED_AUTO_OPEN=0 (no window, URL in response)')
const a = spawnMcp({
  MOODBORED_BOARDS_DIR: boardsDir,
  MOODBORED_URL: BASE,
  MOODBORED_AUTO_OPEN: '0',
})
await a.ready()
const res1 = await a.call('add_items', { items: [{ kind: 'note', text: 'hello from mcp' }] })
console.log('  response:', JSON.stringify(res1))
ok(res1.includes(`Board: ${BASE}/board/`), 'response includes Board: URL')
const boardId = (res1.match(/\/board\/([A-Za-z0-9-]+)/) || [])[1]
ok(!!boardId, `board id parsed (${boardId})`)

await sleep(1500)
ok(await waitHealthy(30000), 'server.mjs auto-started and healthy')

const files = readdirSync(boardsDir).filter(f => f.endsWith('.json') && !f.startsWith('snapshot-'))
const state = JSON.parse(readFileSync(join(boardsDir, files[0]), 'utf-8'))
const items1 = state.project?.viewports?.[0]?.items ?? []
ok(items1.some(i => i.text === 'hello from mcp'), 'board auto-created with the item')
ok(!a.getStderr().includes('opened board window'), 'no window opened when MOODBORED_AUTO_OPEN=0')
a.close()
await sleep(800)

// ── Phase 2: window auto-opens + live SSE from MCP file writes ────────
console.log('phase 2: window auto-open + live SSE updates')
const b = spawnMcp({ MOODBORED_BOARDS_DIR: boardsDir, MOODBORED_URL: BASE })
await b.ready()
ok(await waitHealthy(20000), 'server healthy before SSE test')
const ssePromise = collectSse(boardId, 6000)
await sleep(400) // let the SSE subscription register
const res2 = await b.call('add_items', { items: [{ kind: 'note', text: 'live update note' }] })
console.log('  response:', JSON.stringify(res2))
ok(res2.includes(`Board: ${BASE}/board/`), 'second response includes Board: URL')
await sleep(2500) // window open is async (server probe + browser spawn)
ok(b.getStderr().includes('opened board window'), 'chromeless window open attempted (see window)')
ok((b.getStderr().match(/opened board window/g) || []).length === 1, 'window opens only once per board')
const res3 = await b.call('add_items', { items: [{ kind: 'note', text: 'another' }] })
ok(res3.includes('Board:'), 'later calls still report the URL')
const events = await ssePromise
ok(events.some(e => JSON.stringify(e).includes('live update note')), `SSE pushed MCP write to open window (${events.length} event(s))`)
if (!events.some(e => JSON.stringify(e).includes('live update note'))) console.log('  SSE events:', JSON.stringify(events).slice(0, 500))
b.close()

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}`)
console.log('NOTE: a test board window may be open on', BASE, '- safe to close.')
console.log('cleanup: rm -rf', boardsDir, `and stop the node server.mjs on port ${PORT}`)
process.exit(process.exitCode || 0)
