import type { UserRole } from '../types'

export type ModuleType =
  | 'general'
  | 'site_visit'
  | 'measurement'
  | 'lead'
  | 'quotation'
  | 'production'
  | 'payment'

export const MODULE_STATUSES: Record<ModuleType, string[]> = {
  general:     ['not_started', 'in_progress', 'waiting', 'completed', 'rework', 'dropped'],
  site_visit:  ['not_started', 'in_progress', 'waiting_client', 'completed', 'revisit_needed', 'problem'],
  measurement: ['not_started', 'in_progress', 'waiting_client', 'completed', 'rework', 'problem'],
  lead:        ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'],
  quotation:   ['draft', 'waiting_approval', 'sent_to_client', 'client_approved', 'client_rejected', 'rework', 'completed'],
  production:  ['not_started', 'in_progress', 'waiting', 'completed', 'rework', 'problem', 'delayed'],
  payment:     ['pending', 'part_paid', 'completed', 'overdue'],
}

const QUOTATION_OWNER = ['draft', 'waiting_approval', 'approved', 'rejected', 'sent_to_client', 'client_approved', 'client_rejected', 'rework', 'completed']
const QUOTATION_LEAD  = ['draft', 'waiting_approval', 'sent_to_client', 'client_approved', 'client_rejected', 'rework', 'completed']

export function getStatusesForRole(module: ModuleType, role: UserRole): string[] {
  if (module === 'quotation') return role === 'owner' ? QUOTATION_OWNER : QUOTATION_LEAD
  return MODULE_STATUSES[module] ?? MODULE_STATUSES.general
}

export function taskTypeToModule(taskType: string): ModuleType {
  switch (taskType) {
    case 'site_visit':   return 'site_visit'
    case 'production':   return 'production'
    case 'payment':      return 'payment'
    case 'measurement':  return 'measurement'
    default:             return 'general'
  }
}

export function mapDisplayStatusToTaskStatus(s: string): 'pending' | 'in_progress' | 'completed' | 'overdue' {
  switch (s) {
    case 'completed': case 'done': case 'won': case 'client_approved': case 'approved': return 'completed'
    case 'in_progress': case 'started': case 'rework': return 'in_progress'
    case 'waiting': case 'waiting_client': case 'not_started': case 'new':
    case 'contacted': case 'qualified': case 'proposal': case 'draft':
    case 'waiting_approval': case 'sent_to_client': case 'pending': return 'pending'
    default: return 'overdue'
  }
}
