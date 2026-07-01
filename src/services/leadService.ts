import { supabase } from '../lib/supabase'
import type { Lead } from '../types'

const TABLE = 'fenster_leads'

export async function getAllLeads(): Promise<Lead[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as Lead)
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
