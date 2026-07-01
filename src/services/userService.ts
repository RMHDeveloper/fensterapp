import { supabase } from '../lib/supabase'
import type { ManagedUser } from '../types'
import { loadFromStorage, saveToStorage, STORAGE_KEYS } from '../utils/storage'

const TABLE = 'fenster_managed_users'

export async function getAllManagedUsers(): Promise<ManagedUser[]> {
  if (!supabase) return loadFromStorage<ManagedUser[]>(STORAGE_KEYS.FENSTER_USERS, [])
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data || data.length === 0) return loadFromStorage<ManagedUser[]>(STORAGE_KEYS.FENSTER_USERS, [])
  const rows = data.map(r => r.data as ManagedUser)
  saveToStorage(STORAGE_KEYS.FENSTER_USERS, rows)
  return rows
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
