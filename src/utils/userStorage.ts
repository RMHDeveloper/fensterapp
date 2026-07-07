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

// One-time migration: seeded production accounts' mobile numbers were
// regenerated when login switched from email to phone number
const SEED_MOBILE_MIGRATION: Record<string, string> = {
  prod_owner_md:    '7010356801',
  prod_lead_mgr:    '8892147365',
  prod_site_eng:    '9345678210',
  prod_prod_admin:  '7789234561',
  prod_prod_mgr:    '8123456790',
  prod_tech:        '9987612345',
  prod_viewer:      '7654321098',
}

export async function initUsersFromSupabase(): Promise<void> {
  const users = await getAllManagedUsers()
  if (users.length > 0) {
    // One-time migration: update owner email + name from haroon→deepak
    const migrated = users.map(u => {
      if (u.id === 'prod_owner_md' && (u.email === 'haroon@fenster.in' || u.fullName === 'Haroon Khan')) {
        return { ...u, email: 'deepak@fenster.in', fullName: 'Deepak', updatedAt: new Date().toISOString() }
      }
      // One-time migration: default Project Incharge renamed to Santhanam
      if (u.id === 'prod_prod_admin' && u.fullName === 'Kavitha R') {
        return { ...u, fullName: 'Santhanam', email: 'santhanam@fenster.in', updatedAt: new Date().toISOString() }
      }
      // One-time migration: "Production Incharge" users created before the
      // DISPLAY_ROLE_TO_INTERNAL fix were saved with role: production_manager
      if (u.displayRole === 'Production Incharge' && u.role === 'production_manager') {
        return { ...u, role: 'production_admin' as UserRole, updatedAt: new Date().toISOString() }
      }
      const newMobile = SEED_MOBILE_MIGRATION[u.id]
      if (newMobile && u.mobile !== newMobile) {
        return { ...u, mobile: newMobile, updatedAt: new Date().toISOString() }
      }
      return u
    })
    const changed = migrated.some((u, i) => u !== users[i])
    _cache = migrated
    if (changed) upsertManagedUsers(migrated).catch(() => {})
  } else {
    seedDefaultUsers()
  }
}

export function isEmailTaken(email: string, excludeId?: string): boolean {
  const norm = email.trim().toLowerCase()
  return _cache.some(u => u.email.toLowerCase() === norm && u.id !== excludeId)
}

export function isMobileTaken(mobile: string, excludeId?: string): boolean {
  const norm = mobile.replace(/\D/g, '')
  return _cache.some(u => u.mobile.replace(/\D/g, '') === norm && u.id !== excludeId)
}

// ─── Production users — one per role ──────────────────────────────────────────

const SEED_DATE = '2025-01-01T00:00:00.000Z'

export const DEFAULT_PRODUCTION_USERS: ManagedUser[] = [
  {
    id:            'prod_owner_md',
    fullName:      'Deepak',
    mobile:        '7010356801',
    email:         'deepak@fenster.in',
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
    mobile:        '8892147365',
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
    mobile:        '9345678210',
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
    id:            'prod_prod_admin',
    fullName:      'Santhanam',
    mobile:        '7789234561',
    email:         'santhanam@fenster.in',
    password:      'Fenster@PI25',
    role:          'production_admin',
    displayRole:   'Production Incharge',
    department:    'Production',
    status:        'active',
    createdBy:     'system',
    createdByRole: 'owner',
    createdAt:     SEED_DATE,
    updatedAt:     SEED_DATE,
  },
  {
    id:            'prod_prod_mgr',
    fullName:      'Mohan Das',
    mobile:        '8123456790',
    email:         'mohan@fenster.in',
    password:      'Fenster@PM25',
    role:          'production_manager',
    displayRole:   'Production Manager',
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
    mobile:        '9987612345',
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
    mobile:        '7654321098',
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
  'Production Manager',
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
  'Production Incharge':          'production_admin',
  'Production Manager':           'production_manager',
  'Installation Incharge':        'technician',
  'Installation Technician':      'technician',
}

export function getActiveManagedUsersByDisplayRole(displayRole: string): string[] {
  return _cache
    .filter(u => u.status === 'active' && u.displayRole === displayRole)
    .map(u => u.fullName)
}
