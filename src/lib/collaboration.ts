// Collaboration layer — real-time presence, share links, and role enforcement.
// Built on Supabase Realtime. No sign-up required to join a board.
//
// Architecture:
// - Share links: moodbored.app/board/{boardId}?token={shareToken}
// - Roles: viewer (default), editor (set by sharer)
// - Presence: Supabase Realtime channels with cursor positions and user info
// - Anonymous users get random names + colors (like "Blue Penguin")
// - MCP clients get full access via the board URL

import { supabase } from './sync'
import type { RealtimeChannel } from '@supabase/supabase-js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// ─── Types ──────────────────────────────────────────────────────────

export type ShareRole = 'viewer' | 'editor'

export interface BoardShare {
  id: string
  board_id: string
  share_token: string
  role: ShareRole
  created_by: string | null
  created_at: string
  expires_at: string | null
  is_active: boolean
}

export interface PresenceUser {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  selectedItemId: string | null
  joinedAt: number
}

export interface CollaborationState {
  shareToken: string | null
  role: ShareRole
  users: PresenceUser[]
  channel: RealtimeChannel | null
  isConnected: boolean
}

// ─── Anonymous Identity ─────────────────────────────────────────────

const ANIMALS = ['Penguin', 'Panda', 'Fox', 'Owl', 'Dolphin', 'Tiger', 'Koala', 'Falcon', 'Otter', 'Wolf', 'Bear', 'Hawk', 'Seal', 'Lynx', 'Heron']
const ADJECTIVES = ['Blue', 'Crimson', 'Golden', 'Silver', 'Emerald', 'Coral', 'Indigo', 'Amber', 'Sage', 'Copper', 'Ivory', 'Slate', 'Ruby', 'Jade', 'Onyx']

const CURSOR_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
  '#e11d48', '#0ea5e9', '#84cc16', '#d946ef', '#64748b',
]

function generateAnonymousName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj} ${animal}`
}

function generateCursorColor(): string {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]
}

function getSessionId(): string {
  let id = sessionStorage.getItem('moodbored-session-id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('moodbored-session-id', id)
  }
  return id
}

function getSessionName(): string {
  let name = sessionStorage.getItem('moodbored-session-name')
  if (!name) {
    name = generateAnonymousName()
    sessionStorage.setItem('moodbored-session-name', name)
  }
  return name
}

function getSessionColor(): string {
  let color = sessionStorage.getItem('moodbored-session-color')
  if (!color) {
    color = generateCursorColor()
    sessionStorage.setItem('moodbored-session-color', color)
  }
  return color
}

// ─── Share Link Management ──────────────────────────────────────────

export async function createShareLink(
  boardId: string,
  role: ShareRole = 'viewer',
): Promise<BoardShare | null> {
  const userId = await getCurrentUserIdOrNull()
  const { data, error } = await requireSupabase()
    .from('board_shares')
    .insert({
      board_id: boardId,
      role,
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('[MoodBored] Failed to create share link:', error)
    return null
  }
  return data as BoardShare
}

export async function getShareByToken(token: string): Promise<BoardShare | null> {
  const { data, error } = await requireSupabase()
    .from('board_shares')
    .select('*')
    .eq('share_token', token)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data as BoardShare
}

export async function listShareLinks(boardId: string): Promise<BoardShare[]> {
  const { data, error } = await requireSupabase()
    .from('board_shares')
    .select('*')
    .eq('board_id', boardId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as BoardShare[]
}

export async function updateShareRole(shareId: string, role: ShareRole): Promise<boolean> {
  const { error } = await requireSupabase()
    .from('board_shares')
    .update({ role })
    .eq('id', shareId)

  return !error
}

export async function revokeShareLink(shareId: string): Promise<boolean> {
  const { error } = await requireSupabase()
    .from('board_shares')
    .update({ is_active: false })
    .eq('id', shareId)

  return !error
}

export function getShareUrl(boardId: string, token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://moodbored.app'
  return `${base}/board/${boardId}?token=${token}`
}

// ─── Real-time Presence ─────────────────────────────────────────────

export function joinBoard(
  boardId: string,
  shareToken: string | null,
  callbacks: {
    onUserJoin: (user: PresenceUser) => void
    onUserLeave: (userId: string) => void
    onCursorMove: (userId: string, cursor: { x: number; y: number }) => void
    onSelectionChange: (userId: string, itemId: string | null) => void
    onBoardChange: (data: any) => void
  },
): { channel: RealtimeChannel; leave: () => void } {
  const sessionId = getSessionId()
  const channelName = `board:${boardId}`

  if (!supabase) return { channel: null as any, leave: () => {} }
  const channel = supabase.channel(channelName, {
    config: { presence: { key: sessionId } },
  })

  // Track own presence
  const ownPresence: PresenceUser = {
    id: sessionId,
    name: getSessionName(),
    color: getSessionColor(),
    cursor: null,
    selectedItemId: null,
    joinedAt: Date.now(),
  }

  // Presence sync — called when users join/leave
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<PresenceUser>()
    const users: PresenceUser[] = []
    for (const key in state) {
      for (const pres of state[key]) {
        users.push(pres)
      }
    }
    // Deduplicate by id
    const seen = new Set<string>()
    for (const user of users) {
      if (!seen.has(user.id)) {
        seen.add(user.id)
        if (user.id !== sessionId) {
          callbacks.onUserJoin(user)
        }
      }
    }
  })

  channel.on('presence', { event: 'join' }, ({ newPresences }) => {
    for (const pres of newPresences as unknown as PresenceUser[]) {
      if (pres.id !== sessionId) {
        callbacks.onUserJoin(pres)
      }
    }
  })

  channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
    for (const pres of leftPresences as unknown as PresenceUser[]) {
      callbacks.onUserLeave(pres.id)
    }
  })

  // Broadcast events — cursor moves, selections, board mutations
  channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
    if (payload.id !== sessionId) {
      callbacks.onCursorMove(payload.id, payload.cursor)
    }
  })

  channel.on('broadcast', { event: 'selection' }, ({ payload }) => {
    if (payload.id !== sessionId) {
      callbacks.onSelectionChange(payload.id, payload.itemId)
    }
  })

  channel.on('broadcast', { event: 'board_mutation' }, ({ payload }) => {
    if (payload.id !== sessionId) {
      callbacks.onBoardChange(payload)
    }
  })

  // Subscribe and track presence
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track(ownPresence)
    }
  })

  const leave = () => {
    if (supabase) supabase.removeChannel(channel)
  }

  return { channel, leave }
}

// ─── Cursor Broadcasting ────────────────────────────────────────────

export function broadcastCursor(
  channel: RealtimeChannel | null,
  cursor: { x: number; y: number },
) {
  if (!channel) return
  channel.send({
    type: 'broadcast',
    event: 'cursor',
    payload: { id: getSessionId(), cursor },
  })
}

export function broadcastSelection(
  channel: RealtimeChannel | null,
  itemId: string | null,
) {
  if (!channel) return
  channel.send({
    type: 'broadcast',
    event: 'selection',
    payload: { id: getSessionId(), itemId },
  })
}

export function broadcastMutation(
  channel: RealtimeChannel | null,
  mutation: { type: string; payload: any },
) {
  if (!channel) return
  channel.send({
    type: 'broadcast',
    event: 'board_mutation',
    payload: { id: getSessionId(), ...mutation },
  })
}

// ─── Role Enforcement ───────────────────────────────────────────────

export function canEdit(role: ShareRole): boolean {
  return role === 'editor'
}

export function canView(role: ShareRole): boolean {
  return true // viewers can always view
}

// ─── Helpers ────────────────────────────────────────────────────────

async function getCurrentUserIdOrNull(): Promise<string | null> {
  try {
    if (!supabase) return null
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export function getSessionInfo(): { id: string; name: string; color: string } {
  return {
    id: getSessionId(),
    name: getSessionName(),
    color: getSessionColor(),
  }
}