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

export const MOCK_USER_ACCOUNTS: MockUser[] = [
  // ── MD / ED / Admin (owner-level) ─────────────────────────────────────────
  { id: 'user_owner',    email: 'owner@fenster.app',          password: 'owner123',    name: 'Haroon Khan',   initials: 'HK', role: 'owner',                displayRole: 'Managing Director (MD)'      },
  { id: 'user_md',       email: 'md@fenster.app',             password: 'md123',       name: 'Haroon Khan',   initials: 'HK', role: 'owner',                displayRole: 'Managing Director (MD)'      },
  { id: 'user_ed',       email: 'ed@fenster.app',             password: 'ed123',       name: 'Ravi Kumar',    initials: 'RK', role: 'owner',                displayRole: 'Executive Director (ED)'     },
  { id: 'user_admin',    email: 'admin@fenster.app',          password: 'admin123',    name: 'Admin User',    initials: 'AU', role: 'owner',                displayRole: 'Admin / Purchase / Accounts' },

  // ── Sales Team / Lead Owner ────────────────────────────────────────────────
  { id: 'user_sales',    email: 'sales@fenster.app',          password: 'sales123',    name: 'Priya Sharma',  initials: 'PS', role: 'lead_manager',         displayRole: 'Sales Team / Lead Owner'     },
  { id: 'user_lead',     email: 'lead@fenster.app',           password: 'lead123',     name: 'Priya Sharma',  initials: 'PS', role: 'lead_manager',         displayRole: 'Sales Team / Lead Owner'     },

  // ── Site Engineer ─────────────────────────────────────────────────────────
  { id: 'user_engineer', email: 'engineer@fenster.app',       password: 'engineer123', name: 'Arjun Singh',   initials: 'AS', role: 'site_engineer',        displayRole: 'Site Engineer'               },

  // ── Production Incharge ───────────────────────────────────────────────────
  { id: 'user_production',email: 'production@fenster.app',   password: 'production123',name: 'Mohan Das',    initials: 'MD', role: 'production_manager',   displayRole: 'Production Incharge'         },
  { id: 'user_prodmgr',  email: 'manager@fenster.app',        password: 'manager123',  name: 'Mohan Das',     initials: 'MD', role: 'production_manager',   displayRole: 'Production Incharge'         },

  // ── Installation Incharge ─────────────────────────────────────────────────
  { id: 'user_install',  email: 'installincharge@fenster.app',password: 'install123',  name: 'Rajan Pillai',  initials: 'RP', role: 'technician', displayRole: 'Technician' },

  // ── Installation Technician ───────────────────────────────────────────────
  { id: 'user_tech',     email: 'technician@fenster.app',     password: 'tech123',     name: 'Ravi Kumar',    initials: 'RK', role: 'technician', displayRole: 'Technician' },

  // ── Viewer ────────────────────────────────────────────────────────────────
  { id: 'user_viewer',   email: 'viewer@fenster.app',         password: 'viewer123',   name: 'Guest User',    initials: 'GU', role: 'viewer'                },

  // ── Legacy aliases — kept so old saved sessions don't break ───────────────
  { id: 'user_install_old', email: 'install@fenster.app',     password: 'install123',  name: 'Rajan Pillai',  initials: 'RP', role: 'technician', displayRole: 'Technician' },
  { id: 'user_prodteam',    email: 'production_old@fenster.app', password: 'production123', name: 'Mohan Das', initials: 'MD', role: 'production_team'      },
]

export type AuthResult =
  | { ok: true;  user: MockUser }
  | { ok: false; reason: 'not_found' | 'inactive' }

export function authenticateUser(email: string, password: string): AuthResult {
  const norm = email.trim().toLowerCase()

  // 1. Check built-in demo accounts
  const demo = MOCK_USER_ACCOUNTS.find(u => u.email.toLowerCase() === norm && u.password === password)
  if (demo) return { ok: true, user: demo }

  // 2. Check managed users stored in localStorage (created via User Management)
  try {
    const raw = localStorage.getItem('fenster_users')
    const managed: ManagedUser[] = raw ? (JSON.parse(raw) as ManagedUser[]) : []
    const found = managed.find(u => u.email.toLowerCase() === norm)
    if (!found) return { ok: false, reason: 'not_found' }
    if (found.password !== password) return { ok: false, reason: 'not_found' }
    if (found.status === 'inactive') return { ok: false, reason: 'inactive' }

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
