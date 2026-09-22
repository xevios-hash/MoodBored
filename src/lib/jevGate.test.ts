// Experiment harness: is there a better sequence of questions to ask Jev?
//
// We can't call the real Jev API in unit tests, so this suite runs the
// gate against a deterministic heuristic stand-in (keyword-overlap for
// fit, duplicate-ratio for novelty) across three archetypal scenarios:
//
//   A. coherent diverse batch   — should be accepted
//   B. duplicate-heavy batch    — this is the case 'fit-only' got wrong:
//                                 it looks "on theme", so the original
//                                 single-fit question accepts junk
//   C. off-theme batch          — should be rejected
//
// The comparison metric is SEPARATION: score(coherent) - score(duplicates).
// The 'fit+novelty' sequence must strictly improve it vs 'fit-only'.
import { describe, it, expect } from 'vitest'
import {
  buildJevQuestions, gateItems,
  type JevQuestions, type Proposal, type QuestionSequence,
} from './api'

export function heurJev(state: string, questions: JevQuestions) {
  const board = state.split('Proposed additions:')[0] ?? ''
  const proposalsBlock = state.split('Proposed additions:')[1] ?? ''
  const lines = proposalsBlock.split('\n').filter((l) => l.startsWith('- '))

  const boardWords = new Set(board.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3))
  const stop = new Set(['tema', 'nome', 'resumo', 'itens'])
  for (const s of stop) boardWords.delete(s)

  const answers: Record<string, { score: number; confidence: number }> = {}

  for (const key of Object.keys(questions)) {
    if (key === 'fit') {
      // keyword-overlap of proposal CONTENT (after "kind:") with the board;
      // structural words (kind, image, coordinates) must not inflate the score
      let overlap = 0
      let total = 0
      for (const line of lines) {
        const content = line.toLowerCase().replace(/^[^a-z0-9]*\w+:\s*/, '')
        for (const w of content.split(/[^a-z0-9]+/)) {
          if (w.length <= 2) continue
          total++
          if (boardWords.has(w)) overlap++
        }
      }
      const ratio = total === 0 ? 0 : overlap / total
      answers[key] = { score: Math.min(4, Math.round(ratio * 5)), confidence: 0.9 }
    } else if (key === 'novelty') {
      // duplicate detection on normalized proposal CONTENT (after "kind:");
      // repeats within the batch or wording already on the board count as redundant
      const normalize = (line: string) =>
        line.toLowerCase().replace(/^[^a-z0-9]*\w+:\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim()
      const seen = new Set<string>()
      let redundant = 0
      for (const l of lines) {
        const k = normalize(l)
        if (seen.has(k) || board.toLowerCase().includes(k)) redundant++
        else seen.add(k)
      }
      const uniqueRatio = lines.length === 0 ? 0 : (lines.length - redundant) / lines.length
      answers[key] = { score: Math.round(uniqueRatio * 4), confidence: 0.9 }
    } else {
      // questions not modeled by the heuristic score middle-of-road
      answers[key] = { score: 2, confidence: 0.5 }
    }
  }
  return answers
}

function mockTransport(answersFor: (state: string, q: JevQuestions) => any) {
  return async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string)
    const answers = answersFor(body.state, body.questions)
    return {
      ok: true,
      json: async () => ({ answers }),
    } as unknown as Response
  }
}

const apiKey = 'test-key'

const boardDesc = `EXISTING ITEMS ON THE BOARD:
- Image (100,100): beach sunset waves golden hour
- Note (100,300): golden hour palette
- Image (400,100): coastal boardwalk at sunset
- Swatch (0,0): #FF6B35 sunset orange`

const kind = (kind: string, description: string): Proposal => ({ kind, description })

const scenarioCoherentDiverse: Proposal[] = [
  kind('note', 'sunset over the dunes — linen and rope textures'),
  kind('palette', 'Sandy beige and sea foam blue'),
  kind('image', 'beach grass at low tide'),
]

const scenarioDuplicates: Proposal[] = [
  kind('image', 'beach sunset waves golden hour'),
  kind('image', 'beach sunset waves golden hour'),
  kind('image', 'beach sunset waves golden hour' + ' '),
  kind('note', 'golden hour palette'),
]

const scenarioOffTheme: Proposal[] = [
  kind('image', 'cyberpunk neon city hologram night'),
  kind('note', 'chrome droid streetwear'),
]

async function scoreScenario(seq: QuestionSequence, proposals: Proposal[], threshold: number) {
  const res = await gateItems(
    boardDesc, proposals, 'test-key', threshold,
    mockTransport((state, q) => heurJev(state, q)),
    seq,
  )
  return res
}

describe('buildJevQuestions', () => {
  it("'fit-only' asks exactly one question", () => {
    expect(Object.keys(buildJevQuestions([], 'fit-only'))).toEqual(['fit'])
  })
  it("'fit+novelty' adds the redundancy question", () => {
    const q = buildJevQuestions([], 'fit+novelty')
    expect(Object.keys(q)).toEqual(['fit', 'novelty'])
    expect(q.novelty.instructions.toLowerCase()).toContain('repeat')
  })
})

describe('sequence experiment: fit-only vs fit+novelty', () => {
  it('both sequences accept the coherent batch at a 20% threshold', async () => {
    expect((await scoreScenario('fit-only', scenarioCoherentDiverse as any, 0.2)).accepted).toBe(true)
    expect((await scoreScenario('fit+novelty', scenarioCoherentDiverse, 0.2)).accepted).toBe(true)
  })

  it('the duplicate batch is rejected ONLY by the novelty-aware sequence', async () => {
    const fitOnly = await scoreScenario('fit-only', scenarioDuplicates, 0.2)
    const withNovelty = await scoreScenario('fit+novelty', scenarioDuplicates, 0.2)
    expect(fitOnly.score).toBeGreaterThanOrEqual(0.2) // old gate would pass junk
    expect(fitOnly.accepted).toBe(true)
    expect(withNovelty.score).toBeLessThan(fitOnly.score)
    expect(withNovelty.score).toBeLessThan(0.2)
    expect(withNovelty.accepted).toBe(false)
  })

  it('both sequences reject the off-theme batch', async () => {
    const a = await scoreScenario('fit-only', scenarioOffTheme, 0.2)
    const b = await scoreScenario('fit+novelty', scenarioOffTheme, 0.2)
    expect(a.accepted).toBe(false)
    expect(b.accepted).toBe(false)
  })

  it('novelty widens outcome discrimination of the duplicate case', async () => {
    // discrimination = 1 if the sequences' outcomes differ between the
    // coherent and duplicate scenarios (good), 0 if both are treated alike
    const a1 = await scoreScenario('fit-only', scenarioCoherentDiverse, 0.2)
    const a2 = await scoreScenario('fit-only', scenarioDuplicates, 0.2)
    const b1 = await scoreScenario('fit+novelty', scenarioCoherentDiverse, 0.2)
    const b2 = await scoreScenario('fit+novelty', scenarioDuplicates, 0.2)
    const discriminates = (r1: boolean, r2: boolean) => (r1 === r2 ? 0 : 1)
    expect(discriminates(a1.accepted, a2.accepted)).toBe(0)
    expect(discriminates(b1.accepted, b2.accepted)).toBe(1)
  })
})

describe('gateItems transport contract', () => {
  it('sends the state and questions to the Decisions API', async () => {
    const seen: { url: string; state: string | undefined; questionKeys: string[] | undefined }[] = []
    await gateItems(
      'BOARD', [kind('note', 'waves')], 'test-key', 0.5,
      async (url, init) => {
        const body = JSON.parse(init.body as string)
        seen.push({ url, state: body.state, questionKeys: Object.keys(body.questions) })
        return { ok: false } as unknown as Response
      },
      'fit-only',
    )
    expect(seen[0].url).toContain('openrouter.ai/api/alpha/decisions')
    expect(seen[0].state).toContain('BOARD')
    expect(seen[0].state).toContain('waves')
    expect(seen[0].questionKeys).toEqual(['fit'])
  })

  it('bypasses the gate when Jev is unavailable', async () => {
    const res = await gateItems(
      'BOARD', [kind('note', 'waves')], 'test-key', 0.99,
      async () => ({ ok: false } as unknown as Response),
      'fit+novelty',
    )
    expect(res.accepted).toBe(true)
    expect(res.reasoning).toContain('bypassed')
  })

  it('bypasses when Jev answers none of the asked questions', async () => {
    const res = await gateItems(
      'BOARD', [kind('note', 'waves')], 'test-key', 0.99,
      mockTransport(() => ({})),
      'fit+novelty',
    )
    expect(res.accepted).toBe(true)
    expect(res.reasoning).toContain('no usable answers')
  })
})
