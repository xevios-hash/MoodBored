import type { BoardItem, ChatMessage, AgentAction, Position, ConnectorItem } from '@/types'
import { getDefaultPorts } from '@/types'
import { v4 as uuid } from 'uuid'
import { findFreePosition } from './layout'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ─── Streaming ──────────────────────────────────────────────────────

export async function streamChat(
  messages: { role: string; content: string }[],
  apiKey: string,
  model: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  signal?: AbortSignal,
) {
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://moodbored.app',
        'X-Title': 'MoodBored',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.8,
        max_tokens: 4096,
      }),
      signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      onError(`API error ${res.status}: ${errText || res.statusText}`)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) { onError('No response body'); return }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') { onDone(); return }
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) onChunk(content)
          } catch { /* skip */ }
        }
      }
    }
    onDone()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      onDone()
    } else {
      onError(err instanceof Error ? err.message : 'Unknown error')
    }
  }
}

// ─── Stable Diffusion via OpenRouter ────────────────────────────────

export async function generateImage(
  prompt: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'stability/stable-diffusion-xl',
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0]?.url || data.data?.[0]?.b64_json || null
  } catch {
    return null
  }
}

// ─── Jev Integration (OpenRouter Decisions API) ─────────────────────

export interface JevResult {
  score: number
  reasoning: string
  accepted: boolean
}

let jevCallCount = 0
const JEV_MAX_CALLS_PER_SESSION = 50

export type JevQuestions = Record<string, {
  type: 'noul' | 'choice' | 'score'
  instructions: string
  criteria?: any
}>

export async function callJev(
  state: string,
  questions: JevQuestions,
  apiKey: string,
  transport: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<Record<string, { score?: number; choice?: string; noul?: number; confidence?: number }> | null> {
  if (jevCallCount >= JEV_MAX_CALLS_PER_SESSION) return null
  jevCallCount++

  try {
    const res = await transport('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://moodbored.app',
        'X-Title': 'MoodBored',
      },
      body: JSON.stringify({
        model: 'typesafe/jev-1.13',
        state,
        questions,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.answers ?? null
  } catch {
    return null
  }
}

// ─── Agent Gate (replaces old scoreProposedItems/scoreBoardCoherence) ─
//
// Previously there were two near-identical questions (fit_score and
// coherence) and neither was ever invoked — dead code. This is now the
// single gate, wired into the agent path from ChatPanel. The question
// builder is separated from the transport so tests can experiment with
// different question sequences without hitting the network.

export interface Proposal {
  kind: string
  description: string
}

// Sequences are named so tests can A/B them:
//   'fit-only'    — original single question
//   'fit+novelty' — adds a redundancy check (default)
export type QuestionSequence = 'fit-only' | 'fit+novelty'

export function buildJevQuestions(
  proposals: Proposal[],
  sequence: QuestionSequence = 'fit+novelty',
): JevQuestions {
  const questions: JevQuestions = {
    fit: {
      type: 'score',
      instructions: 'How well do these proposed items fit the existing mood board in terms of theme, aesthetic coherence, and creative direction?',
      criteria: [
        'Poor fit: items clash with the existing aesthetic',
        'Below average: some thematic overlap but significant mismatches',
        'Average: items are acceptable but not strongly aligned',
        'Good fit: items complement the existing theme well',
        'Excellent fit: items perfectly enhance and extend the board vision',
      ],
    },
  }
  if (sequence === 'fit+novelty') {
    questions.novelty = {
      type: 'score',
      instructions: 'How much do these proposed items ADD rather than repeat? Penalize items that duplicate imagery, wording, or concepts already heavily represented; reward variety that broadens the board.',
      criteria: [
        'Redundant: near-duplicates of items already on the board',
        'Slightly redundant: mostly restates what exists',
        'Mixed: some repetition, some new direction',
        'Mostly fresh: new angles with good variety',
        'Brilliantly diverse: meaningfully extends the board with fresh ideas',
      ],
    }
  }
  return questions
}

const SEQUENCE_WEIGHTS: Record<QuestionSequence, Record<string, number>> = {
  'fit-only': { fit: 1 },
  'fit+novelty': { fit: 0.65, novelty: 0.35 },
}

export async function gateItems(
  boardDescription: string,
  proposed: Proposal[],
  apiKey: string,
  threshold: number,
  transport: (url: string, init: RequestInit) => Promise<Response> = fetch,
  sequence: QuestionSequence = 'fit+novelty',
): Promise<JevResult> {
  const proposedDesc = proposed.map((i) => `- ${i.kind}: ${i.description}`).join('\n')
  const state = `Current mood board:\n${boardDescription}\n\nProposed additions:\n${proposedDesc}`

  const answers = await callJev(state, buildJevQuestions(proposed, sequence), apiKey, transport)

  if (!answers) {
    return { score: 0.5, reasoning: 'Jev unavailable (session limit or API error) — gate bypassed', accepted: true }
  }

  // Unavailable question halves → weight falls to the remaining one.
  const weights = SEQUENCE_WEIGHTS[sequence]
  let total = 0, weightSum = 0
  for (const [key, weight] of Object.entries(weights)) {
    const answer = answers[key]
    if (!answer || answer.score == null) continue
    total += (answer.score / 4) * weight
    weightSum += weight
  }
  // Fit drives the threshold; other questions act as hard floors.
  const fitRaw = answers.fit?.score
  if (fitRaw == null) {
    return { score: 0.5, reasoning: 'Jev returned no usable answers — gate bypassed', accepted: true }
  }
  const fitNorm = fitRaw / 4

  // Hard redundancy veto: a batch that is ≥75% repeats is rejected even if
  // it "fits" — the fit question alone would happily accept junk.
  const noveltyRaw = answers.novelty?.score
  if (noveltyRaw != null && noveltyRaw / 4 < 0.25) {
    return { score: 0, reasoning: `gate: rejected for redundancy (novelty ${Math.round((noveltyRaw / 4) * 100)}%, fit ${(fitNorm * 100).toFixed(0)}%)`, accepted: false }
  }

  const combined = total / weightSum
  const floors = noveltyRaw != null ? { fit: fitNorm >= threshold, novelty: (noveltyRaw / 4) >= 0.25 } : { fit: fitNorm >= threshold }
  const accepted = Object.values(floors).every(Boolean)

  return { score: combined, reasoning: `gate: fit ${(fitNorm * 100).toFixed(0)}% vs threshold ${(threshold * 100).toFixed(0)}%, novelty ${(((noveltyRaw ?? 4) / 4) * 100).toFixed(0)}%`, accepted }
}

export function resetJevCounter() {
  jevCallCount = 0
}

// ─── Agent Diagnostics ──────────────────────────────────────────────
// Why isn't the board populating? These counters surface where the
// pipeline stalls: LLM → streamed text → parsed JSON blocks → actions
// → executed items. Inspect with getAgentDiagnostics() after a chat.

export const agentDiagnostics = {
  chunksSeen: 0,
  jsonBlockMatches: 0,
  actionsParsed: 0,
  actionsExecuted: 0,
  lastError: null as string | null,
  timeline: [] as string[],
}

function diag(msg: string) {
  agentDiagnostics.timeline.push(`${new Date().toISOString().slice(11, 23)} ${msg}`)
  if (agentDiagnostics.timeline.length > 100) agentDiagnostics.timeline.shift()
}

export function getAgentDiagnostics() { return agentDiagnostics }
export function resetAgentDiagnostics() {
  Object.assign(agentDiagnostics, { chunksSeen: 0, jsonBlockMatches: 0, actionsParsed: 0, actionsExecuted: 0, lastError: null, timeline: [] })
}

// ─── JSON Action Parsing (incremental for streaming) ────────────────

export interface ParsedActions {
  actions: AgentAction[]
  consumedLength: number
}

export function parseActionsIncremental(text: string, lastConsumed: number): ParsedActions {
  const actions: AgentAction[] = []

  // Match complete ```json ... ``` or ```JSON ... ``` blocks (case insensitive)
  const jsonBlockRegex = /```(?:json|JSON)?\s*([\s\S]*?)```/g
  let match

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    agentDiagnostics.jsonBlockMatches++
    const blockEnd = match.index + match[0].length
    if (blockEnd <= lastConsumed) continue // already processed

    const jsonStr = match[1].trim()
    if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) { diag('block skipped: not JSON'); continue }

    try {
      const parsed = JSON.parse(jsonStr)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item && (item.kind || item.type)) {
          actions.push({ type: 'add_item', item: normalizeItem(item) })
        }
      }
    } catch {
      diag(`strict parse failed on ${jsonStr.length} chars — attempting repair`)
      // Try to fix common JSON issues (trailing commas, etc.)
      try {
        const fixed = jsonStr
          .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
          .replace(/'/g, '"') // single to double quotes
        const parsed = JSON.parse(fixed)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          if (item && (item.kind || item.type)) {
            actions.push({ type: 'add_item', item: normalizeItem(item) })
          }
        }
      } catch {
        diag(`repair failed: block discarded (${jsonStr.slice(0, 80)}...)`)
      }
    }
  }
  agentDiagnostics.actionsParsed += actions.length

  return { actions, consumedLength: text.length }
}

export function parseAgentActions(text: string): AgentAction[] {
  const result = parseActionsIncremental(text, 0)
  return result.actions
}

// ─── Item Normalization ─────────────────────────────────────────────

let itemCounter = 0

function randomPosition(): Position {
  // Spread items in a grid-like pattern with some randomness
  const col = itemCounter % 4
  const row = Math.floor(itemCounter / 4)
  itemCounter++
  return {
    x: 80 + col * 220 + Math.floor(Math.random() * 40),
    y: 80 + row * 200 + Math.floor(Math.random() * 40),
  }
}

export function normalizeItem(raw: any, existingItems: BoardItem[] = []): BoardItem {
  const id = raw.id || uuid()
  const kind = raw.kind || raw.type || 'note'

  // Connectors don't need position
  if (kind === 'connector') {
    return {
      kind: 'connector',
      id,
      fromId: raw.fromId || raw.from || '',
      toId: raw.toId || raw.to || '',
      label: raw.label || '',
      style: raw.style || 'arrow',
      owner: raw.owner || 'llm',
      purpose: raw.purpose || '',
      tags: raw.tags || [],
    } as ConnectorItem
  }

  const size = raw.size || { w: 300, h: 200 }
  const preferredPos = raw.pos || randomPosition()

  let item: BoardItem

  switch (kind) {
    case 'text':
      item = { kind: 'text', id, raw: raw.raw || raw.text || '', pos: preferredPos, size }
      break
    case 'image':
      item = {
        kind: 'image', id,
        thumbnail: raw.thumbnail || raw.thumbnailUrl || '',
        fullSource: raw.fullSource || raw.full_source || raw.url || raw.source || '',
        description: raw.description || '',
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        source: raw.source || 'generated',
        tags: raw.tags || [],
        genPrompt: raw.genPrompt || raw.gen_prompt,
        pos: preferredPos, size,
      }
      break
    case 'link':
      item = {
        kind: 'link', id,
        url: raw.url || '',
        title: raw.title || '',
        summary: raw.summary || '',
        description: raw.description || '',
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        source: raw.source || '',
        tags: raw.tags || [],
        pos: preferredPos,
      }
      break
    case 'video':
      item = {
        kind: 'video', id,
        source: raw.source || '',
        startTs: raw.startTs || raw.start_ts || 0,
        duration: raw.duration || 0,
        subjectDesc: raw.subjectDesc || raw.subject_desc || '',
        motionDesc: raw.motionDesc || raw.motion_desc || '',
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        sourceUrl: raw.sourceUrl || raw.source_url || '',
        tags: raw.tags || [],
        pos: preferredPos, size,
      }
      break
    case 'palette':
      item = {
        kind: 'palette', id,
        label: raw.label || raw.name || 'Palette',
        colors: (raw.colors || []).map((c: any) => ({
          hex: c.hex || c.color || '#000000',
          label: c.label || c.name || '',
        })),
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        tags: raw.tags || [],
        pos: preferredPos, size: { w: size.w || 320, h: size.h || 120 },
      }
      break
    case 'gradient':
      item = {
        kind: 'gradient', id,
        label: raw.label || raw.name || 'Gradient',
        stops: (raw.stops || []).map((s: any) => ({
          position: s.position ?? s.pos ?? 0,
          color: s.color || s.hex || '#000000',
        })),
        direction: raw.direction ?? 90,
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        tags: raw.tags || [],
        pos: preferredPos, size: { w: size.w || 300, h: size.h || 80 },
      }
      break
    case 'font':
      item = {
        kind: 'font', id,
        fontFamily: raw.fontFamily || raw.font || raw.family || 'Inter',
        weights: raw.weights || [400, 700],
        sampleText: raw.sampleText || raw.sample || raw.text || 'The quick brown fox',
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        tags: raw.tags || [],
        pos: preferredPos, size: { w: size.w || 320, h: size.h || 160 },
      }
      break
    case 'swatch':
      item = {
        kind: 'swatch', id,
        hex: raw.hex || raw.color || '#000000',
        name: raw.name || raw.label || '',
        usage: raw.usage || raw.description || '',
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        tags: raw.tags || [],
        pos: preferredPos, size: { w: size.w || 160, h: size.h || 180 },
      }
      break
    case 'sizeguide':
      item = {
        kind: 'sizeguide', id,
        width: raw.width || raw.w || 1920,
        height: raw.height || raw.h || 1080,
        unit: raw.unit || 'px',
        label: raw.label || raw.name || '',
        orientation: raw.orientation || (raw.width > raw.height ? 'landscape' : raw.width < raw.height ? 'portrait' : 'square'),
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        tags: raw.tags || [],
        pos: preferredPos, size: { w: size.w || 200, h: size.h || 160 },
      }
      break
    case 'container':
      item = {
        kind: 'container', id,
        label: raw.label || raw.name || 'Container',
        children: (raw.children || []).map((c: any) => normalizeItem(c)),
        layout: raw.layout || 'free',
        gridCols: raw.gridCols,
        gap: raw.gap || 8,
        collapsed: raw.collapsed || false,
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        tags: raw.tags || [],
        pos: preferredPos, size: { w: size.w || 400, h: size.h || 300 },
      }
      break
    default:
      item = {
        kind: 'note', id,
        text: raw.text || raw.raw || raw.content || '',
        purpose: raw.purpose || '',
        importance: raw.importance || '',
        tags: raw.tags || [],
        pos: preferredPos,
      }
  }

  // Assign default ports
  if ('ports' in item && !item.ports) {
    (item as any).ports = getDefaultPorts(item.kind)
  }

  // Collision avoidance
  return repositionItem(item, existingItems)
}

export function repositionItem(item: BoardItem, existingItems: BoardItem[]): BoardItem {
  if (item.kind === 'connector') return item
  const freePos = findFreePosition(item, existingItems, item.pos)
  return { ...item, pos: freePos } as BoardItem
}

// ─── Board Description for LLM Context ──────────────────────────────

export function summarizeProject(items: BoardItem[]): string {
  if (items.length === 0) return 'The board is currently empty — this is a fresh start.'
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.kind] = (counts[item.kind] || 0) + 1
  }
  const parts = Object.entries(counts).map(([k, v]) => `${v} ${k}${v > 1 ? 's' : ''}`)
  return `Board has ${items.length} items: ${parts.join(', ')}.`
}

export function describeBoard(items: BoardItem[]): string {
  if (items.length === 0) return ''

  const lines: string[] = ['EXISTING ITEMS ON THE BOARD:']
  for (const item of items.slice(0, 25)) {
    if (item.kind === 'connector') {
      lines.push(`- Connector: ${item.fromId} → ${item.toId} (${item.owner}, ${item.style}) "${item.label}"`)
      continue
    }
    const pos = `(${Math.round(item.pos.x)},${Math.round(item.pos.y)})`
    switch (item.kind) {
      case 'note': lines.push(`- Note ${pos}: "${item.text.slice(0, 60)}" [${item.tags.join(', ')}]`); break
      case 'text': lines.push(`- Text ${pos}: "${item.raw.slice(0, 60)}"`); break
      case 'image': lines.push(`- Image ${pos}: ${item.description} src=${item.source} [${item.tags.join(', ')}]`); break
      case 'link': lines.push(`- Link ${pos}: ${item.title || item.url} [${item.tags.join(', ')}]`); break
      case 'video': lines.push(`- Video ${pos}: ${item.subjectDesc} [${item.tags.join(', ')}]`); break
      case 'palette': lines.push(`- Palette ${pos}: "${item.label}" colors=${item.colors.map(c => c.hex).join(',')}`); break
      case 'gradient': lines.push(`- Gradient ${pos}: "${item.label}" ${item.stops.map(s => s.color).join('→')}`); break
      case 'font': lines.push(`- Font ${pos}: ${item.fontFamily} "${item.sampleText.slice(0, 30)}"`); break
      case 'swatch': lines.push(`- Swatch ${pos}: ${item.hex} ${item.name}`); break
      case 'sizeguide': lines.push(`- Size ${pos}: ${item.width}x${item.height}${item.unit} (${item.orientation})`); break
      case 'container': lines.push(`- Container ${pos}: "${item.label}" ${item.children.length} children, layout=${item.layout}`); break
    }
  }
  if (items.length > 25) lines.push(`... and ${items.length - 25} more items`)
  return lines.join('\n')
}

// ─── System Prompt ──────────────────────────────────────────────────

export function buildSystemPrompt(projectSummary: string, boardDescription: string, viewportName?: string): string {
  const vpInfo = viewportName ? `\nYou are currently working on the "${viewportName}" board.` : ''

  return `You are MoodBored's AI assistant — a creative collaborator that builds visual mood boards.
${vpInfo}
RULES:
1. Whenever the user describes ANYTHING, immediately add items via JSON blocks.
2. JSON blocks are HIDDEN from the user — they only see your conversational text.
3. Always add items. Every response should place 2-8 items on the canvas.
4. Use REAL Unsplash URLs for images: "source": "https://images.unsplash.com/photo-XXXXXXXXX?w=800"
5. For generated images, set "source": "generated" and include "genPrompt": "detailed prompt".
6. Spread items across the canvas. Use x: 50-900, y: 50-700. Vary positions.
7. Use containers to organize related items. Group by theme, type, or concept.
8. If the board is empty, populate it with items matching the user's request.
9. When asked to organize, use containers with appropriate layout modes.
10. When asked to transform content, generate markdown/list/table from board items.

ITEM TYPES:

**note** — text thoughts, quotes, key words
{"kind":"note","text":"...","purpose":"...","importance":"...","tags":[...],"pos":{...}}

**text** — raw content snippet
{"kind":"text","raw":"...","purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{...}}

**image** — visual reference (use real Unsplash URLs)
{"kind":"image","description":"...","source":"https://images.unsplash.com/photo-XXXXX?w=800","purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{"w":300,"h":200}}

**link** — reference URL
{"kind":"link","url":"...","title":"...","summary":"...","description":"...","purpose":"...","importance":"...","tags":[...],"pos":{...}}

**palette** — color palette with hex codes (renders as color swatches)
{"kind":"palette","label":"Ocean Sunset","colors":[{"hex":"#FF6B35","label":"Sunset Orange"},{"hex":"#004E89","label":"Deep Ocean"}],"purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{"w":320,"h":120}}

**gradient** — gradient preview (renders as smooth gradient bar)
{"kind":"gradient","label":"Dawn to Dusk","stops":[{"position":0,"color":"#FF6B35"},{"position":1,"color":"#2D1B69"}],"direction":90,"purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{"w":300,"h":80}}

**font** — typography preview (renders sample text in the actual font)
{"kind":"font","fontFamily":"Playfair Display","weights":[400,700],"sampleText":"The quick brown fox","purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{"w":320,"h":160}}

**swatch** — single color with usage notes
{"kind":"swatch","hex":"#FF6B35","name":"Sunset Orange","usage":"Primary accent, CTAs","purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{"w":160,"h":180}}

**sizeguide** — dimensions/orientation reference
{"kind":"sizeguide","width":1920,"height":1080,"unit":"px","label":"Hero Banner","orientation":"landscape","purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{"w":200,"h":160}}

**container** — groups of items (expandable, can nest other containers)
{"kind":"container","label":"Color Study","children":[<items>],"layout":"free","collapsed":false,"purpose":"...","importance":"...","tags":[...],"pos":{...},"size":{"w":400,"h":300}}
LAYOUT MODES: "free", "grid", "stack-h", "stack-v"
Use containers to organize related items. The user can expand/collapse them.

**connector** — line between items
{"kind":"connector","fromId":"<id>","toId":"<id>","label":"influences","style":"arrow","owner":"llm","purpose":"...","tags":[]}

ORGANIZATION:
- When the user asks to organize, group related items into containers
- Use appropriate layout modes: grid for palettes, stack for sequences, free for mood boards
- Name containers clearly: "Color Palette", "Typography", "References", etc.
- When asked to auto-organize, group items by kind or theme

CONTENT TRANSFORMATION:
When the user asks to transform board content into markdown, list, or table:
- Read all items on the board
- Generate structured output (markdown, table, list)
- Present it in the chat response
- Optionally create a "text" item on the board with the transformed content

CURRENT BOARD:
${projectSummary}

${boardDescription}

Always add items. Be creative. Use real image URLs. Organize into containers when appropriate.`
}

// ─── Content Transformation ─────────────────────────────────────────

export function boardToMarkdown(items: BoardItem[]): string {
  const lines: string[] = ['# Mood Board Export', '']

  for (const item of items) {
    if (item.kind === 'connector') continue

    switch (item.kind) {
      case 'note':
        lines.push(`## Note`)
        lines.push(item.text)
        if (item.purpose) lines.push(`*Purpose: ${item.purpose}*`)
        if (item.tags?.length) lines.push(`Tags: ${item.tags.join(', ')}`)
        lines.push('')
        break
      case 'text':
        lines.push(`## Text`)
        lines.push(item.raw)
        lines.push('')
        break
      case 'image':
        lines.push(`## Image`)
        lines.push(`![${item.description}](${item.source || item.thumbnail})`)
        if (item.description) lines.push(`*${item.description}*`)
        if (item.purpose) lines.push(`Purpose: ${item.purpose}`)
        lines.push('')
        break
      case 'link':
        lines.push(`## Link: ${item.title || item.url}`)
        lines.push(`URL: ${item.url}`)
        if (item.summary) lines.push(item.summary)
        lines.push('')
        break
      case 'palette':
        lines.push(`## Palette: ${item.label}`)
        for (const c of item.colors) {
          lines.push(`- ${c.hex} ${c.label || ''}`)
        }
        lines.push('')
        break
      case 'gradient':
        lines.push(`## Gradient: ${item.label}`)
        lines.push(item.stops.map(s => `${s.color} (${Math.round(s.position * 100)}%)`).join(' → '))
        lines.push('')
        break
      case 'font':
        lines.push(`## Font: ${item.fontFamily}`)
        lines.push(`Sample: "${item.sampleText}"`)
        lines.push('')
        break
      case 'swatch':
        lines.push(`## Color: ${item.name || item.hex}`)
        lines.push(`Hex: ${item.hex}`)
        if (item.usage) lines.push(`Usage: ${item.usage}`)
        lines.push('')
        break
      case 'sizeguide':
        lines.push(`## Size: ${item.label}`)
        lines.push(`${item.width}x${item.height}${item.unit} (${item.orientation})`)
        lines.push('')
        break
      case 'container':
        lines.push(`## Container: ${item.label}`)
        if (item.children?.length) {
          lines.push(`Contains ${item.children.length} items:`)
          for (const child of item.children) {
            if ('text' in child) lines.push(`  - ${child.kind}: ${(child as any).text?.slice(0, 50) || (child as any).description?.slice(0, 50) || ''}`)
          }
        }
        lines.push('')
        break
    }
  }

  return lines.join('\n')
}

export function boardToTable(items: BoardItem[]): string {
  const rows: string[] = ['| Kind | Content | Tags | Purpose |', '|------|---------|------|---------|']

  for (const item of items) {
    if (item.kind === 'connector' || !('pos' in item)) continue
    let content = ''
    switch (item.kind) {
      case 'note': content = item.text.slice(0, 60); break
      case 'text': content = item.raw.slice(0, 60); break
      case 'image': content = item.description?.slice(0, 60) || ''; break
      case 'link': content = item.title?.slice(0, 60) || item.url; break
      case 'palette': content = item.label + ': ' + item.colors.map(c => c.hex).join(', '); break
      case 'gradient': content = item.label; break
      case 'font': content = item.fontFamily + ': ' + item.sampleText.slice(0, 30); break
      case 'swatch': content = `${item.hex} ${item.name}`; break
      case 'sizeguide': content = `${item.width}x${item.height}${item.unit}`; break
      case 'container': content = `${item.label} (${item.children?.length || 0} items)`; break
    }
    const tags = ('tags' in item && item.tags) ? item.tags.join(', ') : ''
    const purpose = ('purpose' in item && item.purpose) ? item.purpose.slice(0, 40) : ''
    rows.push(`| ${item.kind} | ${content} | ${tags} | ${purpose} |`)
  }

  return rows.join('\n')
}

// ─── Search ─────────────────────────────────────────────────────────

export function searchItems(items: BoardItem[], query: string, tag?: string): BoardItem[] {
  const q = query.toLowerCase()
  return items.filter((item) => {
    const text = getSearchText(item).toLowerCase()
    const matchesQuery = !q || text.includes(q)
    const matchesTag = !tag || (item.kind !== 'connector' && 'tags' in item && item.tags?.includes(tag))
    return matchesQuery && matchesTag
  })
}

function getSearchText(item: BoardItem): string {
  switch (item.kind) {
    case 'text': return item.raw
    case 'image': return `${item.description} ${item.purpose} ${item.importance} ${item.source}`
    case 'link': return `${item.url} ${item.title} ${item.summary} ${item.description} ${item.purpose} ${item.importance}`
    case 'note': return `${item.text} ${item.purpose} ${item.importance}`
    case 'video': return `${item.source} ${item.subjectDesc} ${item.motionDesc} ${item.purpose} ${item.importance}`
    case 'palette': return `${item.label} ${item.colors.map(c => `${c.hex} ${c.label}`).join(' ')} ${item.purpose}`
    case 'gradient': return `${item.label} ${item.stops.map(s => s.color).join(' ')} ${item.purpose}`
    case 'font': return `${item.fontFamily} ${item.sampleText} ${item.purpose}`
    case 'swatch': return `${item.hex} ${item.name} ${item.usage} ${item.purpose}`
    case 'sizeguide': return `${item.label} ${item.width}x${item.height}${item.unit} ${item.purpose}`
    case 'container': return `${item.label} ${item.purpose} ${item.importance}`
    case 'connector': return `${item.label} ${item.fromId} ${item.toId}`
  }
}
