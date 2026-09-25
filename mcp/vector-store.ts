// In-memory vector store for semantic search.
// Stores text embeddings alongside board items for cosine-similarity retrieval.
// Uses OpenAI embeddings API (via OpenRouter or direct).
//
// Each item gets a text representation: "kind description purpose tags"
// which is embedded and stored. On search, the query is embedded and
// cosine-similarity ranked against all stored vectors.
//
// The store persists to disk as a JSON file alongside the board.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

interface VectorEntry {
  id: string
  kind: string
  text: string
  vector: number[]
  metadata: Record<string, any>
}

const DIMENSION = 1536 // text-embedding-3-small dimension
const MAX_ENTRIES = 2000

export class VectorStore {
  private entries: Map<string, VectorEntry> = new Map()
  private indexPath: string
  private apiKey: string
  private dirty = false

  constructor(indexPath: string, apiKey: string) {
    this.indexPath = indexPath
    this.apiKey = apiKey
    this.loadFromDisk()
  }

  private loadFromDisk() {
    try {
      if (existsSync(this.indexPath)) {
        const raw = JSON.parse(readFileSync(this.indexPath, 'utf-8'))
        for (const entry of raw) {
          this.entries.set(entry.id, entry)
        }
      }
    } catch {}
  }

  private saveToDisk() {
    if (!this.dirty) return
    try {
      const dir = dirname(this.indexPath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.indexPath, JSON.stringify([...this.entries.values()], null, 2))
      this.dirty = false
    } catch {}
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.apiKey) return null
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://moodbored.app',
          'X-Title': 'MoodBored',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: text.slice(0, 8000),
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.data?.[0]?.embedding ?? null
    } catch {
      return null
    }
  }

  async indexItem(item: any) {
    const text = this.itemToText(item)
    if (!text) return
    const vector = await this.embed(text)
    if (!vector) return

    this.entries.set(item.id, {
      id: item.id,
      kind: item.kind,
      text,
      vector,
      metadata: {
        kind: item.kind,
        description: item.description || '',
        tags: item.tags || [],
        hex: item.hex || '',
        label: item.label || '',
      },
    })
    this.dirty = true

    // Evict oldest if over limit
    if (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value
      if (oldest) this.entries.delete(oldest)
    }
  }

  async search(query: string, limit = 10): Promise<Array<{ id: string; score: number; text: string; metadata: any }>> {
    const qVector = await this.embed(query)
    if (!qVector) return []

    const scored = [...this.entries.values()]
      .map(e => ({ id: e.id, score: cosineSimilarity(qVector, e.vector), text: e.text, metadata: e.metadata }))
      .filter(e => e.score > 0.1) // minimum relevance
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored
  }

  async related(itemId: string, limit = 5): Promise<Array<{ id: string; score: number; text: string }>> {
    const entry = this.entries.get(itemId)
    if (!entry) return []

    return [...this.entries.values()]
      .filter(e => e.id !== itemId)
      .map(e => ({ id: e.id, score: cosineSimilarity(entry.vector, e.vector), text: e.text }))
      .filter(e => e.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  removeItem(id: string) {
    this.entries.delete(id)
    this.dirty = true
  }

  clear() {
    this.entries.clear()
    this.dirty = true
  }

  get size() { return this.entries.size }

  persist() { this.saveToDisk() }

  private itemToText(item: any): string {
    const parts = [item.kind]
    if (item.text) parts.push(item.text)
    if (item.raw) parts.push(item.raw)
    if (item.description) parts.push(item.description)
    if (item.purpose) parts.push(item.purpose)
    if (item.importance) parts.push(item.importance)
    if (item.label) parts.push(item.label)
    if (item.url) parts.push(item.url)
    if (item.title) parts.push(item.title)
    if (item.summary) parts.push(item.summary)
    if (item.fontFamily) parts.push(`font ${item.fontFamily}`)
    if (item.hex) parts.push(`color ${item.hex} ${item.name || ''}`)
    if (item.colors) parts.push(item.colors.map((c: any) => `color ${c.hex} ${c.label || ''}`).join(' '))
    if (item.tags?.length) parts.push(item.tags.join(' '))
    return parts.filter(Boolean).join(' ')
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
