// TRUE streaming integration test — only runs when MOODBORED_LIVE is set,
// so CI/normal npm test never burns credits or depends on network luck.
import { describe, it, expect } from 'vitest'
import { streamChat, buildSystemPrompt, parseAgentActions, resetAgentDiagnostics, agentDiagnostics } from './api'
import { useStore } from '@/stores/useStore'

const API_KEY = process.env.MOODBORED_TEST_KEY || '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'
const MODEL = 'anthropic/claude-sonnet-4'

describe.skipIf(!process.env.MOODBORED_LIVE)('live streaming agent round-trip (ChatPanel replica)', () => {
  it('hardened prompt: streamed response contains json blocks and populates the board', { timeout: 120_000 }, async () => {
    resetAgentDiagnostics()
    const system = buildSystemPrompt('The board is currently empty.', '')
    let full = ''
    let streamError: string | null = null
    await streamChat(
      [{ role: 'system', content: system }, { role: 'user', content: 'populate the board with coastal beach sunset items' }],
      API_KEY, MODEL,
      (chunk) => { full += chunk },
      () => {}, (err) => { streamError = err },
    )
    const actions = parseAgentActions(full)
    expect(streamError).toBeNull()
    expect(actions.length).toBeGreaterThan(0)
    expect(agentDiagnostics.lastError).toBeNull()
    useStore.getState().executeActions(actions)
    const items = useStore.getState().project.viewports.find(v => v.id === useStore.getState().activeViewportId)!.items
    expect(items.length).toBeGreaterThan(0)
  })
})
