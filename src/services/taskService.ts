import { supabase } from '../lib/supabase'
import type { Task } from '../types'

const TABLE = 'fenster_tasks'

export async function getAllTasks(): Promise<Task[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as Task)
}

export async function upsertTask(task: Task): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id:           task.id,
    project_id:   task.projectId,
    flow_stage:   task.flowStage ?? '',
    status:       task.status,
    data:         task,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] task sync error:', error.message)
}

export async function upsertTasks(tasks: Task[]): Promise<void> {
  if (!supabase || tasks.length === 0) return
  const rows = tasks.map(task => ({
    id:         task.id,
    project_id: task.projectId,
    flow_stage: task.flowStage ?? '',
    status:     task.status,
    data:       task,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id' })
  if (error) console.error('[Fenster] tasks bulk sync error:', error.message)
}
