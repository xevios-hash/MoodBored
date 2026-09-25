// MCP Sync Bridge — keeps the board state in sync between the frontend
// and the MCP server. Supports both Tauri (desktop) and REST API (web).
//
// In embed mode with a board ID, uses /api/board/:id endpoints and
// subscribes to SSE for bidirectional sync.

import { useStore } from '@/stores/useStore'

let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncMode: 'tauri' | 'api' | 'none' = 'none'
let invoke: ((cmd: string, args?: any) => Promise<any>) | null = null
let boardId: string | null = null
let sseCleanup: (() => void) | null = null

function getApiBase() {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

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
    const res = await fetch(`${getApiBase()}/api/board/health`)
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
        const url = boardId
          ? `${getApiBase()}/api/board/${boardId}`
          : `${getApiBase()}/api/board`
        await fetch(url, {
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

// Subscribe to server-side board changes (for embed mode)
function subscribeToBoardEvents(bid: string) {
  const es = new EventSource(`${getApiBase()}/api/board/${bid}/events`)
  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.project) {
        // Only apply if the data is newer than our current state
        const current = useStore.getState().project
        if (data.project.updated > current.updated) {
          useStore.getState().setProject(data.project)
        }
      }
    } catch {}
  }
  es.onerror = () => {
    es.close()
    // Reconnect after 3s
    setTimeout(() => subscribeToBoardEvents(bid), 3000)
  }
  return () => es.close()
}

export async function initMcpSync(options?: { boardId?: string }) {
  boardId = options?.boardId || null
  await detectSyncMode()
  if (syncMode === 'none') return

  // Write initial state
  syncToFile()

  // Subscribe to all store changes → write to disk
  useStore.subscribe(syncToFile)

  // If we have a board ID, also subscribe to server-side changes
  // (for bidirectional sync when MCP tools write to the board)
  if (boardId && syncMode === 'api') {
    sseCleanup = subscribeToBoardEvents(boardId)
  }
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