import { supabase } from '../lib/supabase'
import type { ProductionItem } from '../types'

const TABLE = 'fenster_production'

export async function getAllProduction(): Promise<ProductionItem[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as ProductionItem)
}

export async function upsertProduction(item: ProductionItem): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id:         item.id,
    project_id: item.projectId,
    stage:      item.stage,
    status:     item.status ?? 'pending',
    data:       item,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] production sync error:', error.message)
}
