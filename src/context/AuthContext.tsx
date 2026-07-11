import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { AuthUser, UserRole, Permission } from '../types'
import { hasPermission } from '../utils/permissions'
import { authenticateUser } from '../data/mockUsers'
import { loadManagedUsers, initUsersFromSupabase, DEFAULT_PRODUCTION_USERS } from '../utils/userStorage'

const SESSION_KEY = 'fenster_session'

export interface LoginResult {
  success: boolean
  error?: string
}

interface AuthContextValue {
  user:                 AuthUser | null
  isLoggedIn:           boolean
  isAuthReady:          boolean
  loginWithCredentials: (mobile: string, password: string) => LoginResult
  login:                (role: UserRole) => void
  logout:               () => void
  can:                  (permission: Permission) => boolean
  updateProfile:        (updates: Partial<Pick<AuthUser, 'name' | 'photo'>>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (!saved) return null
      const parsed = JSON.parse(saved) as AuthUser
      if (parsed && (parsed.role as string) === 'installation_incharge') {
        return { ...parsed, role: 'technician' }
      }
      return parsed
    } catch { return null }
  })

  useEffect(() => {
    initUsersFromSupabase().finally(() => setIsAuthReady(true))
  }, [])

  useEffect(() => {
    try {
      if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {}
  }, [user])

  function loginWithCredentials(mobile: string, password: string): LoginResult {
    const result = authenticateUser(mobile, password)
    if (!result.ok) {
      if (result.reason === 'inactive') {
        return { success: false, error: 'This user is inactive. Please contact Admin.' }
      }
      return { success: false, error: 'Invalid phone number or password.' }
    }
    const account = result.user
    setUser({
      id:          account.id,
      role:        account.role as UserRole,
      name:        account.name,
      initials:    account.initials,
      email:       account.email,
      displayRole: account.displayRole,
      roles:       account.roles,
    })
    return { success: true }
  }

  function login(role: UserRole) {
    const users   = loadManagedUsers()
    const account = users.find(u => u.role === role)
      ?? DEFAULT_PRODUCTION_USERS.find(u => u.role === role)
    if (!account) return
    const initials = account.fullName.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    setUser({ id: account.id, role, name: account.fullName, initials, email: account.email, displayRole: account.displayRole })
  }

  function logout() {
    setUser(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  function can(permission: Permission): boolean {
    if (!user) return false
    return hasPermission(user.roles ?? user.role, permission)
  }

  function updateProfile(updates: Partial<Pick<AuthUser, 'name' | 'photo'>>) {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      if (updates.name) {
        next.initials = updates.name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
      }
      return next
    })
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isAuthReady, loginWithCredentials, login, logout, can, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
