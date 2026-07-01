import { supabase } from '../lib/supabase'

const TABLE = 'fenster_activity_logs'

export interface ActivityLog {
  id: string
  projectId?: string
  taskId?: string
  action: string
  description: string
  data?: Record<string, unknown>
  createdBy: string
  createdByRole: string
  createdAt: string
}

export async function logActivity(log: Omit<ActivityLog, 'id'>): Promise<void> {
  if (!supabase) return
  const entry: ActivityLog = { ...log, id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
  const { error } = await supabase.from(TABLE).insert({
    id:              entry.id,
    project_id:      entry.projectId,
    task_id:         entry.taskId,
    action:          entry.action,
    description:     entry.description,
    data:            entry.data ?? {},
    created_by:      entry.createdBy,
    created_by_role: entry.createdByRole,
    created_at:      entry.createdAt,
  })
  if (error) console.error('[Fenster] activity log error:', error.message)
}
