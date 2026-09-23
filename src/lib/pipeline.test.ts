// End-to-end integrity: does a realistic streamed LLM response make it
// onto the board through the full pipeline (parse → gate → execute)?
import { describe, it, expect, beforeEach } from 'vitest'
import { parseActionsIncremental } from './api'
import { gateItems } from './api'
import { useStore } from '@/stores/useStore'

// typical assistant output that wraps json in prose + multiple blocks
const realisticResponse = `Love this direction! Here are some coastal ideas for your board.

\`\`\`json
{"kind":"note","text":"golden hour palette","pos":{"x":100,"y":100}}
\`\`\`

And a few more:

\`\`\`json
[{"kind":"note","text":"waves crashing on rocks","pos":{"x":200,"y":100}},
 {"kind":"image","description":"beach sunset","source":"https://images.unsplash.com/photo-1?w=800","pos":{"x":300,"y":100},"size":{"w":300,"h":200}},
 {"kind":"palette","label":"Sea Breeze","colors":[{"hex":"#004E89","label":"Ocean"},{"hex":"#FF6B35","label":"Sunset"}],"pos":{"x":400,"y":100},"size":{"w":300,"h":100}}]
\`\`\`

Want me to refine any of these?`

// Replicates the exact ChatPanel streaming accumulation behavior post-fix
function simulateChatPanelStream(text: string) {
  let consumed = 0
  const pendingActions: any[] = []
  const chunks = text.match(/[\s\S]{1,40}/g) ?? [] // simulate progressive chunking
  for (let ci = 0; ci < chunks.length; ci++) {
    const full = chunks.slice(0, ci + 1).join('')
    const result = parseActionsIncremental(full, consumed)
    pendingActions.push(...result.actions)
    consumed = result.consumedLength
  }
  return pendingActions
}

describe('end-to-end: streamed response → board items', () => {
  it('realistic multi-block stream yields exactly 4 actions', () => {
    const actions = simulateChatPanelStream(realisticResponse)
    expect(actions.length).toBe(4)
  })

  it('executing the gated batch lands all items on the active viewport', async () => {
    const actions = simulateChatPanelStream(realisticResponse)
    // gate with unreachable transport → bypass-accept path used in offline runs
    const gate = await gateItems('', 
      actions.map((a: any) => ({ kind: a.item.kind, description: a.item.description ?? a.item.text ?? '' })),
      'test-key', 0.2,
      async () => ({ ok: false } as unknown as Response),
    )
    expect(gate.accepted).toBe(true)

    const before = useStore.getState().project.viewports[0].items.length
    useStore.getState().executeActions(actions)
    const after = useStore.getState().project.viewports.find(v => v.id === useStore.getState().activeViewportId)!.items.length
    expect(after - before).toBe(4)
  })
})

// Gate strength sweep: how aggressive is the gate at the 20% threshold?
// The heuristic stand-in from jevGate.test.ts is reused via a tiny local
// copy so this file is self-contained.
describe('gate strength: should NOT reject borderline-good batches', () => {
  const mock = (answers: Record<string, number>) =>
    async (_url: string, init: RequestInit) => {
      return { ok: true, json: async () => ({ answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, { score: v, confidence: 0.9 }])) }) } as unknown as Response
    }

  const cases: [string, Record<string, number>, boolean][] = [
    ['fit=2 (average), novelty high → accept at 20%', { fit: 2, novelty: 4 }, true],
    ['fit=1 (below avg), novelty high', { fit: 1, novelty: 4 }, true],
    ['fit=1 duplicate-heavy', { fit: 1, novelty: 0 }, false],
    ['fit=0 (poor), novelty high', { fit: 0, novelty: 4 }, false],
  ]

  for (const [name, answers, shouldAccept] of cases) {
    it(`fit-only question, threshold 0.2: ${name} → ${shouldAccept ? 'accept' : 'reject'}`, async () => {
      const res = await gateItems('BOARD', [{ kind: 'note', description: 'x' }], 'k', 0.2, mock(answers), 'fit-only')
      expect(res.accepted).toBe(shouldAccept)
    })
    it(`fit+novelty sequence, threshold 0.2: ${name} → ${shouldAccept ? 'accept' : 'reject'}`, async () => {
      const res = await gateItems('BOARD', [{ kind: 'note', description: 'x' }], 'k', 0.2, mock(answers), 'fit+novelty')
      expect(res.accepted).toBe(shouldAccept)
    })
  }
})
