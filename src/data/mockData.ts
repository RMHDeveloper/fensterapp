import type {
  Task, Project, Lead, Quotation, Order, Payment,
  ProductionItem, Mistake, Installation, SiteVisit, FileItem, TeamActivity, User,
} from '../types'

export const CURRENT_USER: User = {
  id: 'u1', name: 'Priya Sharma', phone: '9876543210',
  email: 'lead@fenster.app', role: 'lead_manager', initials: 'PS',
}

export const TASKS: Task[]       = []
export const PROJECTS: Project[] = []
export const LEADS: Lead[]       = []
export const QUOTATIONS: Quotation[]       = []
export const ORDERS: Order[]               = []
export const PAYMENTS: Payment[]           = []
export const PRODUCTION_ITEMS: ProductionItem[] = []
export const MISTAKES: Mistake[]           = []
export const INSTALLATIONS: Installation[] = []
export const SITE_VISITS: SiteVisit[]      = []
export const FILES: FileItem[]             = []
export const TEAM_ACTIVITY: TeamActivity[] = [
  { id: 'ta1', person: 'Priya Sharma', initials: 'PS', action: 'App ready for demo', time: 'Just now' },
]
