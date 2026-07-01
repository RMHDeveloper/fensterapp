import type { UserRole, ManagedUser } from '../types'
import { loadManagedUsers } from '../utils/userStorage'

export interface MockUser {
  id: string
  email: string
  password: string
  name: string
  initials: string
  role: UserRole
  displayRole?: string
}

export type AuthResult =
  | { ok: true;  user: MockUser }
  | { ok: false; reason: 'not_found' | 'inactive' }

export function authenticateUser(email: string, password: string): AuthResult {
  const norm    = email.trim().toLowerCase()
  const managed = loadManagedUsers()
  const found   = managed.find((u: ManagedUser) => u.email.toLowerCase() === norm)
  if (!found)                      return { ok: false, reason: 'not_found' }
  if (found.password !== password) return { ok: false, reason: 'not_found' }
  if (found.status === 'inactive') return { ok: false, reason: 'inactive'  }

  const initials = found.fullName
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return {
    ok: true,
    user: {
      id:          found.id,
      email:       found.email,
      password:    found.password,
      name:        found.fullName,
      initials,
      role:        found.role,
      displayRole: found.displayRole,
    },
  }
}
