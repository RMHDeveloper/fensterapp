import { supabase } from '../lib/supabase'
import type { Mistake } from '../types'

const TABLE = 'fenster_mistakes'

export async function getAllMistakes(): Promise<Mistake[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as Mistake)
}

export async function upsertMistake(mistake: Mistake): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id:         mistake.id,
    project_id: mistake.projectId,
    status:     mistake.status,
    data:       mistake,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] mistake sync error:', error.message)
}
