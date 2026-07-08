import { supabase } from '../lib/supabase'
import type { DashboardTargets } from '../utils/dashboardTargets'

const TABLE  = 'fenster_dashboard_targets'
const ROW_ID = 'default'

export async function getDashboardTargetsRemote(): Promise<DashboardTargets | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(TABLE).select('data').eq('id', ROW_ID).maybeSingle()
  if (error || !data) return null
  return data.data as DashboardTargets
}

export async function saveDashboardTargetsRemote(targets: DashboardTargets): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id: ROW_ID,
    data: targets,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] dashboard targets sync error:', error.message)
}
