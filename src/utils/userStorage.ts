import type { ManagedUser, UserRole } from '../types'
import { loadFromStorage, saveToStorage, STORAGE_KEYS } from './storage'
import { upsertManagedUsers } from '../services/userService'
import { MOCK_USER_ACCOUNTS } from '../data/mockUsers'

export function loadManagedUsers(): ManagedUser[] {
  return loadFromStorage<ManagedUser[]>(STORAGE_KEYS.FENSTER_USERS, [])
}

export function saveManagedUsers(users: ManagedUser[]): void {
  saveToStorage(STORAGE_KEYS.FENSTER_USERS, users)
  // Sync to Supabase in background (no await — fire and forget)
  upsertManagedUsers(users).catch(() => {})
}

/** Returns true if the email is already taken by another managed user OR a demo account. */
export function isEmailTaken(email: string, excludeId?: string): boolean {
  const norm = email.trim().toLowerCase()
  // Check managed users (excluding the user being edited)
  if (loadManagedUsers().some(u => u.email.toLowerCase() === norm && u.id !== excludeId)) return true
  // Prevent reusing a built-in demo account email
  return MOCK_USER_ACCOUNTS.some(u => u.email.toLowerCase() === norm)
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

// Returns full names of active managed users with a given display role
export function getActiveManagedUsersByDisplayRole(displayRole: string): string[] {
  return loadManagedUsers()
    .filter(u => u.status === 'active' && u.displayRole === displayRole)
    .map(u => u.fullName)
}
