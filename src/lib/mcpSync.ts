// MCP Sync Bridge — keeps a JSON file on disk in sync with the zustand
// store so the MCP server (running as a separate process) can read/write
// the board state. Uses Tauri's invoke API for file I/O.
//
// On web (non-Tauri), this is a no-op — MCP only works in the desktop app.

import { useStore } from '@/stores/useStore'

let syncTimer: ReturnType<typeof setTimeout> | null = null
let isTauri = false
let invoke: ((cmd: string, args?: any) => Promise<any>) | null = null

// Detect Tauri at runtime
async function detectTauri() {
  try {
    const mod = await import('@tauri-apps/api/core')
    invoke = mod.invoke
    // Test that the command exists
    if (invoke) await invoke('read_board_state')
    isTauri = true
    console.info('[MoodBored] MCP sync bridge active')
  } catch {
    isTauri = false
    console.info('[MoodBored] MCP sync bridge unavailable (web mode)')
  }
}

function syncToFile() {
  if (!isTauri || !invoke) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    try {
      const state = useStore.getState()
      await invoke!('sync_board_state', {
        state: JSON.stringify({
          project: state.project,
          lastModified: new Date().toISOString(),
        }),
      })
    } catch (err) {
      console.warn('[MoodBored] MCP sync write failed:', err)
    }
  }, 300)
}

export async function initMcpSync() {
  await detectTauri()
  if (!isTauri) return

  // Write initial state
  syncToFile()

  // Subscribe to all store changes
  useStore.subscribe(syncToFile)
}

export function getMcpServerPath(): string {
  // Path to the MCP server script — used by the settings UI to generate
  // Claude Desktop config
  return 'mcp/mcp-server.ts'
}

export function getMcpStatePath(): string {
  const home = typeof process !== 'undefined' ? (process.env.HOME || '') : ''
  if (typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')) {
    return `${home}/Library/Application Support/MoodBored/board.json`
  }
  return `${home}/.config/MoodBored/board.json`
}