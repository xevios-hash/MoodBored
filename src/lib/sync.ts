import { createClient } from '@supabase/supabase-js'
import type { Project } from '@/types'

const SUPABASE_URL = 'https://riryaptlqpbuswjtiivg.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_o4mTwfp_iYzFtWIMgWXZHA_KQZ2wpb-'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
  if (!userId) throw new Error('Not signed in — projects cannot be synced anonymously')
  const { error } = await supabase
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
  const { data, error } = await supabase
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
  // Anonymous users see nothing; signed-in users see their own projects.
  if (!userId) return []
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
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) console.error('[MoodBored] Failed to delete project:', error)
}

// ─── Real-time Subscription ─────────────────────────────────────────

export function subscribeToProject(
  projectId: string,
  onChange: (project: Project) => void
): () => void {
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
    supabase.removeChannel(channel)
  }
}

// ─── Auth Helpers ───────────────────────────────────────────────────

export async function signInAnonymously(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.error('[MoodBored] Anonymous sign-in failed:', error)
    return null
  }
  return data.user?.id ?? null
}

export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email })
  if (error) console.error('[MoodBored] Email sign-in failed:', error)
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
