import type { ManagedUser, UserRole } from '../types'
import { getAllManagedUsers, upsertManagedUsers } from '../services/userService'

let _cache: ManagedUser[] = []

export function loadManagedUsers(): ManagedUser[] {
  return _cache
}

export function saveManagedUsers(users: ManagedUser[]): void {
  _cache = users
  upsertManagedUsers(users).catch(() => {})
}

export async function initUsersFromSupabase(): Promise<void> {
  const users = await getAllManagedUsers()
  if (users.length > 0) {
    _cache = users
  } else {
    seedDefaultUsers()
  }
}

export function isEmailTaken(email: string, excludeId?: string): boolean {
  const norm = email.trim().toLowerCase()
  return _cache.some(u => u.email.toLowerCase() === norm && u.id !== excludeId)
}

// ─── Production users — one per role ──────────────────────────────────────────

const SEED_DATE = '2025-01-01T00:00:00.000Z'

export const DEFAULT_PRODUCTION_USERS: ManagedUser[] = [
  {
    id:            'prod_owner_md',
    fullName:      'Haroon Khan',
    mobile:        '9000000001',
    email:         'haroon@fenster.in',
    password:      'Fenster@MD25',
    role:          'owner',
    displayRole:   'Managing Director (MD)',
    department:    'Management',
    status:        'active',
    createdBy:     'system',
    createdByRole: 'owner',
    createdAt:     SEED_DATE,
    updatedAt:     SEED_DATE,
  },
  {
    id:            'prod_lead_mgr',
    fullName:      'Priya Sharma',
    mobile:        '9000000002',
    email:         'priya@fenster.in',
    password:      'Fenster@LO25',
    role:          'lead_manager',
    displayRole:   'Sales Team / Lead Owner',
    department:    'Sales',
    status:        'active',
    createdBy:     'system',
    createdByRole: 'owner',
    createdAt:     SEED_DATE,
    updatedAt:     SEED_DATE,
  },
  {
    id:            'prod_site_eng',
    fullName:      'Arjun Singh',
    mobile:        '9000000003',
    email:         'arjun@fenster.in',
    password:      'Fenster@SE25',
    role:          'site_engineer',
    displayRole:   'Site Engineer',
    department:    'Site',
    status:        'active',
    createdBy:     'system',
    createdByRole: 'owner',
    createdAt:     SEED_DATE,
    updatedAt:     SEED_DATE,
  },
  {
    id:            'prod_prod_mgr',
    fullName:      'Mohan Das',
    mobile:        '9000000004',
    email:         'mohan@fenster.in',
    password:      'Fenster@PM25',
    role:          'production_manager',
    displayRole:   'Production Incharge',
    department:    'Production',
    status:        'active',
    createdBy:     'system',
    createdByRole: 'owner',
    createdAt:     SEED_DATE,
    updatedAt:     SEED_DATE,
  },
  {
    id:            'prod_tech',
    fullName:      'Rajan Pillai',
    mobile:        '9000000005',
    email:         'rajan@fenster.in',
    password:      'Fenster@TK25',
    role:          'technician',
    displayRole:   'Technician',
    department:    'Installation',
    status:        'active',
    createdBy:     'system',
    createdByRole: 'owner',
    createdAt:     SEED_DATE,
    updatedAt:     SEED_DATE,
  },
  {
    id:            'prod_viewer',
    fullName:      'Guest User',
    mobile:        '9000000006',
    email:         'guest@fenster.in',
    password:      'Fenster@GU25',
    role:          'viewer',
    displayRole:   'Viewer',
    department:    '',
    status:        'active',
    createdBy:     'system',
    createdByRole: 'owner',
    createdAt:     SEED_DATE,
    updatedAt:     SEED_DATE,
  },
]

export function seedDefaultUsers(): void {
  if (_cache.length > 0) return
  saveManagedUsers(DEFAULT_PRODUCTION_USERS)
}

// Display role labels shown in the Add User form
export const DISPLAY_ROLES: string[] = [
  'Managing Director (MD)',
  'Executive Director (ED)',
  'Admin / Purchase / Accounts',
  'Sales Team / Lead Owner',
  'Site Engineer',
  'Production Incharge',
  'Installation Incharge',
  'Installation Technician',
]

// Maps display role → internal UserRole for permissions
export const DISPLAY_ROLE_TO_INTERNAL: Record<string, UserRole> = {
  'Managing Director (MD)':       'owner',
  'Executive Director (ED)':      'owner',
  'Admin / Purchase / Accounts':  'owner',
  'Sales Team / Lead Owner':      'lead_manager',
  'Site Engineer':                'site_engineer',
  'Production Incharge':          'production_manager',
  'Installation Incharge':        'technician',
  'Installation Technician':      'technician',
}

export function getActiveManagedUsersByDisplayRole(displayRole: string): string[] {
  return _cache
    .filter(u => u.status === 'active' && u.displayRole === displayRole)
    .map(u => u.fullName)
}
