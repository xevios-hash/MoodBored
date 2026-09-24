// MCP Sync Bridge — keeps the board state in sync with the MCP server.
// Desktop (Tauri): writes to ~/Library/Application Support/MoodBored/board.json
// Web (Railway/Cloudflare): writes to /api/board via REST API

import { useStore } from '@/stores/useStore'

let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncMode: 'tauri' | 'api' | 'none' = 'none'
let invoke: ((cmd: string, args?: any) => Promise<any>) | null = null

async function detectSyncMode() {
  // Try Tauri first
  try {
    const mod = await import('@tauri-apps/api/core')
    invoke = mod.invoke
    if (invoke) await invoke('read_board_state')
    syncMode = 'tauri'
    console.info('[MoodBored] MCP sync bridge active (Tauri)')
    return
  } catch {}

  // Try REST API (web deployment)
  try {
    const res = await fetch('/api/board/health')
    if (res.ok) {
      syncMode = 'api'
      console.info('[MoodBored] MCP sync bridge active (REST API)')
      return
    }
  } catch {}

  syncMode = 'none'
  console.info('[MoodBored] MCP sync bridge unavailable')
}

function syncToFile() {
  if (syncMode === 'none') return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      const state = useStore.getState()
      const payload = JSON.stringify({
        project: state.project,
        lastModified: new Date().toISOString(),
      })
      if (syncMode === 'tauri' && invoke) {
        await invoke('sync_board_state', { state: payload })
      } else if (syncMode === 'api') {
        await fetch('/api/board', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        })
      }
    } catch (err) {
      console.warn('[MoodBored] MCP sync write failed:', err)
    }
  }, 300)
}

export async function initMcpSync() {
  await detectSyncMode()
  if (syncMode === 'none') return

  // Write initial state
  syncToFile()

  // Subscribe to all store changes
  useStore.subscribe(syncToFile)
}

export function getMcpServerPath(): string {
  return 'mcp/mcp-server.ts'
}

export function getMcpStatePath(): string {
  const home = typeof process !== 'undefined' ? (process.env.HOME || '') : ''
  if (typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')) {
    return `${home}/Library/Application Support/MoodBored/board.json`
  }
  return `${home}/.config/MoodBored/board.json`
}