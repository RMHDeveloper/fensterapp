import { supabase } from '../lib/supabase'
import type { ManagedUser } from '../types'

const TABLE = 'fenster_managed_users'

export async function getAllManagedUsers(): Promise<ManagedUser[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as ManagedUser)
}

// Looks up the managed-user profile linked to a Supabase Auth session (auth.users.id).
export async function getManagedUserByAuthId(authUserId: string): Promise<ManagedUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(TABLE).select('data').eq('auth_user_id', authUserId).maybeSingle()
  if (error || !data) return null
  return data.data as ManagedUser
}

// Creates/updates the Supabase Auth account matching a managed user's mobile
// number + password — must go through the admin-user-sync Edge Function since
// that requires the service role key, which the browser must never hold.
// Best-effort: a failure here (e.g. the function isn't deployed yet) doesn't
// block saving the managed-user record, but the new/changed login won't work
// until this succeeds — surfaced to the caller so the UI can warn the admin.
export async function syncManagedUserAuth(
  managedUserId: string, mobile: string, password?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not configured.' }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'No active session.' }
  const { data, error } = await supabase.functions.invoke('admin-user-sync', {
    body: { managedUserId, mobile, password },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: data?.ok === true, error: data?.error }
}

export async function upsertManagedUser(user: ManagedUser): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id:         user.id,
    email:      user.email,
    full_name:  user.fullName,
    role:       user.role,
    status:     user.status,
    data:       user,            // full object including password for cross-device auth
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] user sync error:', error.message)
}

export async function upsertManagedUsers(users: ManagedUser[]): Promise<void> {
  if (!supabase || users.length === 0) return
  const rows = users.map(user => ({
    id:         user.id,
    email:      user.email,
    full_name:  user.fullName,
    role:       user.role,
    status:     user.status,
    data:       user,            // full object including password for cross-device auth
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id' })
  if (error) console.error('[Fenster] users bulk sync error:', error.message)
}
