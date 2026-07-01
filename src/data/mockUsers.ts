import type { UserRole, ManagedUser } from '../types'

export interface MockUser {
  id: string
  email: string
  password: string
  name: string
  initials: string
  role: UserRole
  displayRole?: string
}

// All users are created via Settings → User Management (MD only).
// No hardcoded demo accounts in production.

export type AuthResult =
  | { ok: true;  user: MockUser }
  | { ok: false; reason: 'not_found' | 'inactive' }

export function authenticateUser(email: string, password: string): AuthResult {
  const norm = email.trim().toLowerCase()
  try {
    const raw  = localStorage.getItem('fenster_users')
    const managed: ManagedUser[] = raw ? (JSON.parse(raw) as ManagedUser[]) : []
    const found = managed.find(u => u.email.toLowerCase() === norm)
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
  } catch {
    return { ok: false, reason: 'not_found' }
  }
}
