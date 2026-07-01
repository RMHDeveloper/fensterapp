import { supabase } from '../lib/supabase'
import type { Project } from '../types'

const TABLE = 'fenster_projects'

export async function getAllProjects(): Promise<Project[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as Project)
}

export async function upsertProject(project: Project): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id:            project.id,
    name:          project.name,
    client:        project.client,
    current_stage: project.currentStage ?? '',
    status:        project.status,
    data:          project,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] project sync error:', error.message)
}

export async function deleteProject(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) console.error('[Fenster] project delete error:', error.message)
}
