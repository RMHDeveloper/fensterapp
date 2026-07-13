import type { Project, Task, UserRole, Lead, FlowStage } from '../types'

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
    site_engineer_lead: 'site_engineer_lead', site_lead: 'site_engineer_lead',
    pm: 'production_manager', production_manager: 'production_manager',
    production_incharge: 'production_admin', project_incharge: 'production_admin', production_admin: 'production_admin',
    installation_technician: 'technician', installation_incharge: 'technician', technician: 'technician',
    production_team: 'production_team',
    viewer: 'viewer',
  }
  return map[key] ?? (role as UserRole)
}

// 'won' is kept as a legacy alias for leads converted before this status was renamed —
// treated identically to 'converted' everywhere in the app.
export function isLeadConverted(lead: Lead): boolean {
  return lead.status === 'won' || lead.status === 'converted'
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

// MD dropped the project (Project Detail's "Drop Project" button) — a reversible
// status flag, distinct from a normal completion.
export function isCancelledProject(project: Project): boolean {
  return project.status === 'cancelled'
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
  if (
    stage === 'dispatch_assign' || stage === 'admin_availability_check' ||
    stage === 'site_lead_approval' || stage === 'installation_assign'
  ) return 'ready_to_dispatch'
  if (stage === 'installation_update') return 'installation'
  if (stage === 'final_payment' || stage === 'final_completion') return 'collection'
  return null
}

// Real runtime order of flow stages (NOT the declaration order in FlowStage) —
// derived from how each stage's submit handler actually transitions to the next one.
export const FLOW_ORDER: FlowStage[] = [
  'site_assign', 'site_visit', 'reschedule_review', 'site_review',
  'owner_approval', 'send_to_client', 'advance_payment',
  'production_assign', 'production_check', 'production_work',
  'dispatch_assign', 'admin_availability_check', 'site_lead_approval', 'installation_assign',
  'installation_update', 'final_payment', 'final_completion', 'completed',
]
export function flowReached(stage: FlowStage | undefined, target: FlowStage): boolean {
  if (!stage) return false
  return FLOW_ORDER.indexOf(stage) >= FLOW_ORDER.indexOf(target)
}

// Measurement: from assigning the Site Engineer through the LM preparing the quotation
// (still hasn't been sent to MD/ED yet). Quotation: sitting with MD/ED for approval.
// Negotiation: sent to the client through advance received — right up until the LM
// clicks Convert to Project.
const LEAD_MEASUREMENT_FLOW_STAGES = new Set<FlowStage>(['site_assign', 'site_visit', 'reschedule_review', 'site_review'])

export type LeadFlowBucket = 'measurement' | 'quotation' | 'negotiation' | null

// A lead's "in-progress" bucket, derived from its linked (still pendingConversion)
// project's active flow task — mirrors getProjectFilterStage's approach of trusting
// the task's real flowStage instead of ambiguous stored stage strings.
export function getLeadFlowBucket(lead: Lead, projects: Project[], tasks: Task[]): LeadFlowBucket {
  if (lead.status !== 'qualified') return null
  const proj = projects.find(p => p.leadId === lead.id)
  if (!proj) return 'measurement'
  const activeTask = tasks.find(t => t.projectId === proj.id && t.flowStage && t.flowStage !== 'completed')
  const stage = activeTask?.flowStage
  if (!stage) return 'measurement'
  if (LEAD_MEASUREMENT_FLOW_STAGES.has(stage)) return 'measurement'
  if (stage === 'owner_approval') return 'quotation'
  return 'negotiation'
}

// Advance payment has been recorded once the linked project's active flow task has moved
// at or past the advance_payment stage — gates the "Convert to Project" button while the
// project is still pendingConversion.
export function isAdvanceReceived(projectId: string, tasks: Task[]): boolean {
  const activeTask = tasks.find(t => t.projectId === projectId && t.flowStage && t.flowStage !== 'completed')
  return flowReached(activeTask?.flowStage, 'advance_payment')
}
