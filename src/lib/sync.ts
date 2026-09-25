import { createClient } from '@supabase/supabase-js'
import type { Project } from '@/types'

// @ts-expect-error import.meta.env is Vite-specific
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || ''
// @ts-expect-error import.meta.env is Vite-specific
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.info('[MoodBored] Supabase not configured — cloud sync disabled. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable.')
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  return supabase
}

// ─── Project Sync ───────────────────────────────────────────────────

export interface RemoteProject {
  id: string
  name: string
  data: Project
  owner_id: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

// Never sync secrets — the API key is local-only per device.
function sanitizeForRemote(project: Project): Project {
  return {
    ...project,
    settings: { ...project.settings, apiKey: '' },
  }
}

export async function pushProject(project: Project, userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  if (!userId) throw new Error('Not signed in — projects cannot be synced anonymously')
  const { error } = await requireSupabase()
    .from('projects')
    .upsert({
      id: project.id,
      name: project.name,
      data: sanitizeForRemote(project),
      owner_id: userId,
      is_public: false,
      updated_at: new Date().toISOString(),
    })
    .select()

  if (error) {
    console.error('[MoodBored] Failed to push project:', error)
    throw error
  }
}

export async function pullProject(id: string): Promise<Project | null> {
  const { data, error } = await requireSupabase()
    .from('projects')
    .select('data')
    .eq('id', id)
    .single()

  if (error || !data) return null
  const project = data.data as Project
  if (project?.settings) project.settings.apiKey = ''
  return project
}

export async function listRemoteProjects(userId?: string): Promise<RemoteProject[]> {
  if (!supabase || !userId) return []
  let query = supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)

  const { data, error } = await query
  if (error) {
    console.error('[MoodBored] Failed to list projects:', error)
    return []
  }
  return (data ?? []) as RemoteProject[]
}

export async function deleteRemoteProject(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) console.error('[MoodBored] Failed to delete project:', error)
}

// ─── Real-time Subscription ─────────────────────────────────────────

export function subscribeToProject(
  projectId: string,
  onChange: (project: Project) => void
): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`project:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`,
      },
      (payload) => {
        if (payload.new && 'data' in payload.new) {
          onChange((payload.new as any).data as Project)
        }
      }
    )
    .subscribe()

  return () => {
    requireSupabase().removeChannel(channel)
  }
}

// ─── Auth Helpers ───────────────────────────────────────────────────

export async function signInAnonymously(): Promise<string | null> {
  try {
    const { data, error } = await requireSupabase().auth.signInAnonymously()
    if (error) {
      console.error('[MoodBored] Anonymous sign-in failed:', error)
      return null
    }
    return data.user?.id ?? null
  } catch { return null }
}

export async function signInWithEmail(email: string): Promise<void> {
  try {
    const { error } = await requireSupabase().auth.signInWithOtp({ email })
    if (error) console.error('[MoodBored] Email sign-in failed:', error)
  } catch {}
}

export async function signOut(): Promise<void> {
  try { await requireSupabase().auth.signOut() } catch {}
}

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await requireSupabase().auth.getUser()
    return data.user?.id ?? null
  } catch { return null }
}
