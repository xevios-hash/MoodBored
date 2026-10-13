import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function log(msg: string) {
  try { console.error(`[moodbored-window] ${msg}`) } catch {}
}

export function baseUrl(): string {
  return (process.env.MOODBORED_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export function boardUrl(boardId: string): string {
  return `${baseUrl()}/board/${boardId}`
}

function envFlag(name: string, defaultOn: boolean): boolean {
  const raw = (process.env[name] || '').trim().toLowerCase()
  if (!raw) return defaultOn
  return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off')
}

async function probeHealth(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${baseUrl()}/api/board/health`, { signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

let spawnAttempted = false
let spawnFailed = false

export async function ensureServerRunning(): Promise<boolean> {
  if (await probeHealth()) return true
  if (envFlag('MOODBORED_NO_SERVER', false)) return false
  if (spawnAttempted) {
    if (spawnFailed) return false
  } else {
    spawnAttempted = true
    const serverPath = join(REPO_ROOT, 'server.mjs')
    if (!existsSync(serverPath)) {
      spawnFailed = true
      log(`server.mjs not found at ${serverPath}; start the MoodBored server manually`)
      return false
    }
    try {
      const port = new URL(baseUrl()).port || '3000'
      const env: NodeJS.ProcessEnv = { ...process.env, PORT: port }
      const boards = process.env.MOODBORED_BOARDS_DIR || process.env.BOARDS_DIR
      if (boards) env.BOARDS_DIR = boards
      const child = spawn(process.execPath, [serverPath], {
        cwd: REPO_ROOT,
        detached: true,
        stdio: 'ignore',
        env,
      })
      child.unref()
      child.on('exit', () => {
        // Spawned server died (e.g. port still in use); allow a retry later.
        spawnAttempted = false
      })
      log(`started server.mjs on port ${port} (pid ${child.pid})`)
    } catch (err: any) {
      spawnFailed = true
      log(`failed to start server.mjs: ${err?.message}`)
      return false
    }
  }
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (await probeHealth()) return true
    await new Promise(r => setTimeout(r, 500))
  }
  log('server did not become healthy in time')
  return false
}

function findBrowser(): string | null {
  const candidates: string[] = []
  if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files'
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    const local = process.env.LOCALAPPDATA || ''
    candidates.push(
      join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(pf, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      join(pf86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      join(local, 'Chromium', 'Application', 'chrome.exe'),
    )
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    )
  } else {
    for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave-browser', 'microsoft-edge']) {
      try {
        const r = spawnSync('which', [bin], { encoding: 'utf-8' })
        if (r.status === 0 && r.stdout.trim()) candidates.push(r.stdout.trim())
      } catch {}
    }
  }
  for (const c of candidates) {
    try {
      if (existsSync(c)) return c
    } catch {}
  }
  return null
}

function openDefaultBrowser(url: string): boolean {
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
    }
    return true
  } catch (err: any) {
    log(`failed to open browser: ${err?.message}`)
    return false
  }
}

function openAppWindow(url: string): boolean {
  const browser = findBrowser()
  if (!browser) return openDefaultBrowser(url)
  try {
    spawn(browser, [`--app=${url}`, '--window-size=1280,800'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    }).unref()
    return true
  } catch (err: any) {
    log(`app window launch failed (${err?.message}); falling back to default browser`)
    return openDefaultBrowser(url)
  }
}

const openedBoards = new Set<string>()

export async function showBoard(boardId: string): Promise<string> {
  const url = boardUrl(boardId)
  const up = await ensureServerRunning()
  if (!envFlag('MOODBORED_AUTO_OPEN', true)) return url
  if (openedBoards.has(boardId)) return url
  if (!up) {
    log(`server not reachable; window not opened (board URL: ${url})`)
    return url
  }
  openedBoards.add(boardId)
  const ok = openAppWindow(url)
  log(ok ? `opened board window: ${url}` : `could not open a window for ${url}`)
  return url
}
