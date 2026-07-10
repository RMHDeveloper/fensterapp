import type { UserRole, Permission } from '../types'

const OWNER_PERMS: Permission[] = [
  'view_home','view_today','view_projects','create_project','edit_project',
  'view_leads','create_lead','edit_lead',
  'view_site_visit','update_site_visit',
  'view_quotation','create_quotation','send_quotation_for_approval','approve_quotation','reject_quotation',
  'view_production','update_production',
  'view_delivery_qc','update_qc',
  'view_mistakes','create_mistake',
  'view_payments','update_payments',
  'view_orders',
  'view_files','upload_files',
  'view_reports','view_settings',
  'manage_users','approve_work','delete_data',
  'view_installation','update_installation',
  'view_profit',
]

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: OWNER_PERMS,

  lead_manager: [
    'view_home','view_today','view_projects','create_project','edit_project',
    'view_leads','create_lead','edit_lead',
    'view_site_visit','update_site_visit',
    'view_quotation','create_quotation','send_quotation_for_approval',
    'view_production',
    'view_delivery_qc',
    'view_mistakes','create_mistake',
    'view_payments','update_payments',
    'view_orders',
    'view_files','upload_files',
    'view_reports','view_settings',
    'view_installation','update_installation',
  ],

  site_engineer: [
    'view_home','view_today','view_projects',
    'view_site_visit','update_site_visit',
    'view_files','upload_files',
    'view_mistakes','create_mistake',
    'view_settings',
  ],

  // Approves/reassigns the installation person proposed by Admin — separate from
  // the regular Site Engineer's site-visit/measurement work
  site_engineer_lead: [
    'view_home','view_today','view_projects',
    'view_installation','update_installation',
    'view_files','upload_files',
    'view_settings',
  ],

  production_admin: [
    'view_home','view_today','view_projects',
    'view_production','update_production',
    'view_files','upload_files',
    'view_settings',
  ],

  production_manager: [
    'view_home','view_today','view_projects',
    'view_production','update_production',
    'view_delivery_qc','update_qc',
    'view_files','upload_files',
    'view_mistakes','create_mistake',
    'view_settings',
  ],

  technician: [
    'view_home','view_today','view_projects',
    'view_installation','update_installation',
    'view_files','upload_files',
    'view_mistakes','create_mistake',
    'view_settings',
  ],

  // Legacy alias — same as technician for backward compat
  installation_incharge: [
    'view_home','view_today','view_projects',
    'view_installation','update_installation',
    'view_files','upload_files',
    'view_mistakes','create_mistake',
    'view_settings',
  ],

  viewer: [
    'view_home','view_today','view_projects','view_quotation','view_files','view_reports','view_settings',
  ],

  // Legacy alias — same as production_manager for backward compat
  production_team: [
    'view_home','view_today','view_projects',
    'view_production','update_production',
    'view_delivery_qc','update_qc',
    'view_mistakes','create_mistake',
    'view_files','upload_files',
    'view_settings',
  ],
}

// production_admin's visible label is "Admin" (display-only — internal role
// value stays production_admin, and displayRole data still stores "Production Incharge")
export const ROLE_LABELS: Record<UserRole, string> = {
  owner:                'Managing Director (MD)',
  lead_manager:         'Sales Team / Lead Owner',
  site_engineer:        'Site Engineer',
  site_engineer_lead:   'Site Engineer Lead',
  production_admin:     'Admin',
  production_manager:   'Production Manager',
  technician:           'Installation Technician',
  installation_incharge:'Installation Technician',
  viewer:               'Viewer',
  production_team:      'Admin',
}

// Resolves the label to show for a user's role — prefers their stored displayRole
// (e.g. "Managing Director (MD)"), but renders legacy displayRole values that
// predate the role cleanup ("Production Incharge", "Installation Incharge") as
// their current equivalents everywhere in the UI. The stored displayRole data and
// DISPLAY_ROLE_TO_INTERNAL mapping are untouched.
export function getRoleDisplayLabel(role: UserRole, displayRole?: string): string {
  if (displayRole === 'Production Incharge')   return 'Admin'
  if (displayRole === 'Installation Incharge') return 'Installation Technician'
  return displayRole ?? ROLE_LABELS[role]
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner:                'Full access, MD/ED approvals, cost breakdown and profit visibility',
  lead_manager:         'Leads, projects, quotations, payments, assignments',
  site_engineer:        'Site visits, measurements, and photos',
  site_engineer_lead:   'Approves installation availability and assigns/changes the installer',
  production_admin:     'Material availability checks',
  production_manager:   'Production work and checklist updates',
  technician:           'Installation execution and status updates',
  installation_incharge:'Installation execution and status updates',
  viewer:               'View-only access',
  production_team:      'Production work updates (legacy)',
}

export const MOCK_USERS: Record<UserRole, { name: string; initials: string; email: string }> = {
  owner:                { name: 'Haroon Khan',   initials: 'HK', email: 'haroon@fenster.app'   },
  lead_manager:         { name: 'Priya Sharma',  initials: 'PS', email: 'priya@fenster.app'    },
  site_engineer:        { name: 'Arjun Singh',   initials: 'AS', email: 'arjun@fenster.app'    },
  site_engineer_lead:   { name: 'Site Lead',     initials: 'SL', email: 'sitelead@fenster.app' },
  production_admin:     { name: 'Kavitha R',     initials: 'KR', email: 'kavitha@fenster.app'  },
  production_manager:   { name: 'Mohan Das',     initials: 'MD', email: 'mohan@fenster.app'    },
  technician:           { name: 'Rajan Pillai',  initials: 'RP', email: 'rajan@fenster.app'    },
  installation_incharge:{ name: 'Rajan Pillai',  initials: 'RP', email: 'rajan@fenster.app'    },
  viewer:               { name: 'Guest User',    initials: 'GU', email: 'guest@fenster.app'    },
  production_team:      { name: 'Mohan Das',     initials: 'MD', email: 'mohan@fenster.app'    },
}

export const SCREEN_PERMISSIONS: Record<string, Permission> = {
  home:            'view_home',
  tasks:           'view_today',
  projects:        'view_projects',
  leads:           'view_leads',
  'site-visits':   'view_site_visit',
  quotations:      'view_quotation',
  orders:          'view_orders',
  production:      'view_production',
  'delivery-qc':   'view_delivery_qc',
  mistakes:        'view_mistakes',
  payments:        'view_payments',
  installation:    'view_installation',
  files:           'view_files',
  reports:         'view_reports',
  settings:        'view_settings',
  approvals:       'approve_work',
  'settings/users':'manage_users',
}
