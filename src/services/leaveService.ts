import { supabase } from '../lib/supabase'
import type { LeaveApplication } from '../types'

const TABLE = 'fenster_leave_applications'

export async function getAllLeaveApplications(): Promise<LeaveApplication[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as LeaveApplication)
}

export async function upsertLeaveApplications(entries: LeaveApplication[]): Promise<void> {
  if (!supabase || entries.length === 0) return
  const rows = entries.map(entry => ({
    id:         entry.id,
    status:     entry.status,
    data:       entry,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id' })
  if (error) console.error('[Fenster] leave application sync error:', error.message)
}
