import { supabase } from '../lib/supabase'
import type { Lead } from '../types'
import { loadFromStorage, saveToStorage, STORAGE_KEYS } from '../utils/storage'

const TABLE = 'fenster_leads'

export async function getAllLeads(): Promise<Lead[]> {
  if (!supabase) return loadFromStorage<Lead[]>(STORAGE_KEYS.LEADS, [])
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data || data.length === 0) return loadFromStorage<Lead[]>(STORAGE_KEYS.LEADS, [])
  const rows = data.map(r => r.data as Lead)
  saveToStorage(STORAGE_KEYS.LEADS, rows)
  return rows
}

export async function upsertLead(lead: Lead): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id:         lead.id,
    status:     lead.status,
    data:       lead,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] lead sync error:', error.message)
}
