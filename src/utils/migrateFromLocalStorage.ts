import { supabase } from '../lib/supabase'
import type { Task, ProductionItem, Lead, Payment, Project, Mistake, ManagedUser } from '../types'

const OLD_KEYS = {
  TASKS:        'fencraft_tasks',
  PRODUCTION:   'fencraft_production',
  LEADS:        'fencraft_leads',
  PAYMENTS:     'fencraft_payments',
  PROJECTS:     'fencraft_projects',
  MISTAKES:     'fencraft_mistakes',
  USERS:        'fenster_users',
}

function readOldKey<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export interface MigrationResult {
  projects:    number
  tasks:       number
  leads:       number
  payments:    number
  production:  number
  mistakes:    number
  users:       number
  errors:      string[]
}

export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  if (!supabase) throw new Error('Supabase is not configured.')

  const result: MigrationResult = { projects: 0, tasks: 0, leads: 0, payments: 0, production: 0, mistakes: 0, users: 0, errors: [] }

  const projects   = readOldKey<Project>(OLD_KEYS.PROJECTS)
  const tasks      = readOldKey<Task>(OLD_KEYS.TASKS)
  const leads      = readOldKey<Lead>(OLD_KEYS.LEADS)
  const payments   = readOldKey<Payment>(OLD_KEYS.PAYMENTS)
  const production = readOldKey<ProductionItem>(OLD_KEYS.PRODUCTION)
  const mistakes   = readOldKey<Mistake>(OLD_KEYS.MISTAKES)
  const users      = readOldKey<ManagedUser>(OLD_KEYS.USERS)

  if (projects.length) {
    const rows = projects.map(p => ({ id: p.id, name: p.name ?? '', client: p.client ?? '', current_stage: p.currentStage ?? '', status: p.status ?? 'active', data: p, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('fenster_projects').upsert(rows, { onConflict: 'id' })
    if (error) result.errors.push(`projects: ${error.message}`)
    else result.projects = projects.length
  }

  if (tasks.length) {
    const rows = tasks.map(t => ({ id: t.id, project_id: t.projectId ?? '', flow_stage: t.flowStage ?? '', status: t.status ?? 'pending', data: t, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('fenster_tasks').upsert(rows, { onConflict: 'id' })
    if (error) result.errors.push(`tasks: ${error.message}`)
    else result.tasks = tasks.length
  }

  if (leads.length) {
    const rows = leads.map(l => ({ id: l.id, status: l.status ?? 'new', data: l, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('fenster_leads').upsert(rows, { onConflict: 'id' })
    if (error) result.errors.push(`leads: ${error.message}`)
    else result.leads = leads.length
  }

  if (payments.length) {
    const rows = payments.map(p => ({ id: p.id, project_id: p.projectId ?? '', status: p.status ?? 'pending', data: p, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('fenster_payments').upsert(rows, { onConflict: 'id' })
    if (error) result.errors.push(`payments: ${error.message}`)
    else result.payments = payments.length
  }

  if (production.length) {
    const rows = production.map(p => ({ id: p.id, project_id: p.projectId ?? '', stage: p.stage ?? '', status: p.status ?? 'pending', data: p, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('fenster_production').upsert(rows, { onConflict: 'id' })
    if (error) result.errors.push(`production: ${error.message}`)
    else result.production = production.length
  }

  if (mistakes.length) {
    const rows = mistakes.map(m => ({ id: m.id, project_id: m.projectId ?? '', status: m.status ?? 'open', data: m, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('fenster_mistakes').upsert(rows, { onConflict: 'id' })
    if (error) result.errors.push(`mistakes: ${error.message}`)
    else result.mistakes = mistakes.length
  }

  if (users.length) {
    const rows = users.map(u => ({ id: u.id, email: u.email, full_name: u.fullName ?? '', role: u.role ?? 'viewer', status: u.status ?? 'active', data: u, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('fenster_managed_users').upsert(rows, { onConflict: 'id' })
    if (error) result.errors.push(`users: ${error.message}`)
    else result.users = users.length
  }

  return result
}

export function hasLocalStorageData(): boolean {
  return Object.values(OLD_KEYS).some(key => {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    try { const arr = JSON.parse(raw); return Array.isArray(arr) && arr.length > 0 } catch { return false }
  })
}
