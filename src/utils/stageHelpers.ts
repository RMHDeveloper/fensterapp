import type { Project, Task, UserRole } from '../types'

// Normalizes free-text role variants (PM, Production Manager, Production Incharge,
// Project Incharge, Installation Technician, etc.) into the canonical UserRole used
// for permission/filter checks across the app.
export function normalizeRole(role?: string | null): UserRole | undefined {
  if (!role) return undefined
  const key = role.trim().toLowerCase().replace(/[\s_-]+/g, '_')
  const map: Record<string, UserRole> = {
    md: 'owner', ed: 'owner', admin: 'owner', owner: 'owner',
    lo: 'lead_manager', lead_owner: 'lead_manager', lead_manager: 'lead_manager', sales_team: 'lead_manager',
    site_engineer: 'site_engineer',
    pm: 'production_manager', production_manager: 'production_manager',
    production_incharge: 'production_admin', project_incharge: 'production_admin', production_admin: 'production_admin',
    installation_technician: 'technician', installation_incharge: 'technician', technician: 'technician',
    production_team: 'production_team',
    viewer: 'viewer',
  }
  return map[key] ?? (role as UserRole)
}

export function isCompletedProject(project: Project): boolean {
  return (
    project.status === 'completed' ||
    project.isCompleted === true ||
    Boolean(project.completedAt) ||
    project.workflowStatus === 'Finished' ||
    project.currentStage === 'completed'
  )
}

// A project created from a lead stays hidden everywhere until the LM clicks
// "Convert to Project" (pendingConversion flips to false). Projects created
// directly (no leadId) are always considered converted.
export function isConvertedProject(project: Project): boolean {
  return !project.leadId || project.pendingConversion !== true
}

export function isActiveProject(project: Project): boolean {
  return isConvertedProject(project) && !isCompletedProject(project)
}

export type ProjectFilterStage = 'pre_production' | 'production' | 'ready_to_dispatch' | 'installation' | 'collection' | null

// Bucketed by the project's actual active flow task, not project.currentStage —
// currentStage reuses the same string ('advance_payment') for both "waiting on
// advance payment" and "job sheet sent to Production Incharge", so it can't tell
// those apart. The flow task's stage/status can.
export function getProjectFilterStage(project: Project, tasks: Task[]): ProjectFilterStage {
  const activeTask = tasks.find(t => t.projectId === project.id && t.flowStage && t.flowStage !== 'completed')
  const stage  = activeTask?.flowStage
  const status = activeTask?.flowStatus
  if (stage === 'production_assign' || stage === 'production_check') return 'pre_production'
  if (stage === 'production_work') return status === 'ready_to_pack' ? 'ready_to_dispatch' : 'production'
  if (stage === 'installation_assign') return 'ready_to_dispatch'
  if (stage === 'installation_update') return 'installation'
  if (stage === 'final_payment' || stage === 'final_completion') return 'collection'
  return null
}
