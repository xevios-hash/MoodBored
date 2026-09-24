import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSessionInfo, canEdit, canView, getShareUrl,
  type ShareRole, type PresenceUser,
} from './collaboration'

// Mock browser APIs
const store: Record<string, string> = {}
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
})

// Mock Supabase
vi.mock('./sync', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    channel: () => ({
      on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}), track: () => Promise.resolve() }) }) }),
    }),
    removeChannel: () => {},
  },
}))

describe('role enforcement', () => {
  it('viewers can view but not edit', () => {
    expect(canView('viewer')).toBe(true)
    expect(canEdit('viewer')).toBe(false)
  })

  it('editors can view and edit', () => {
    expect(canView('editor')).toBe(true)
    expect(canEdit('editor')).toBe(true)
  })
})

describe('share URL generation', () => {
  it('generates a URL with board ID and token', () => {
    const url = getShareUrl('board-123', 'abc123token')
    expect(url).toContain('/board/board-123')
    expect(url).toContain('token=abc123token')
  })

  it('uses window.location.origin when available', () => {
    const url = getShareUrl('b1', 't1')
    expect(url).toMatch(/^https?:\/\//)
  })
})

describe('anonymous session identity', () => {
  it('generates consistent session info within a session', () => {
    const info1 = getSessionInfo()
    const info2 = getSessionInfo()
    expect(info1.id).toBe(info2.id)
    expect(info1.name).toBe(info2.name)
    expect(info1.color).toBe(info2.color)
  })

  it('generates a valid session name format', () => {
    const info = getSessionInfo()
    // Should be "Adjective Animal" like "Blue Penguin"
    expect(info.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
  })

  it('generates a hex color', () => {
    const info = getSessionInfo()
    expect(info.color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('generates a UUID-like session ID', () => {
    const info = getSessionInfo()
    expect(info.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('presence user types', () => {
  it('PresenceUser has required fields', () => {
    const user: PresenceUser = {
      id: 'test-id',
      name: 'Blue Penguin',
      color: '#3b82f6',
      cursor: { x: 100, y: 200 },
      selectedItemId: null,
      joinedAt: Date.now(),
    }
    expect(user.id).toBe('test-id')
    expect(user.cursor?.x).toBe(100)
  })

  it('cursor can be null', () => {
    const user: PresenceUser = {
      id: 'test-id',
      name: 'Test',
      color: '#000',
      cursor: null,
      selectedItemId: 'item-1',
      joinedAt: Date.now(),
    }
    expect(user.cursor).toBeNull()
    expect(user.selectedItemId).toBe('item-1')
  })
})

describe('share roles', () => {
  it('ShareRole includes viewer and editor', () => {
    const viewer: ShareRole = 'viewer'
    const editor: ShareRole = 'editor'
    expect(viewer).toBe('viewer')
    expect(editor).toBe('editor')
  })
})