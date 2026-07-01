import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { AuthUser, UserRole, Permission } from '../types'
import { hasPermission } from '../utils/permissions'
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from '../utils/storage'
import { authenticateUser, MOCK_USER_ACCOUNTS } from '../data/mockUsers'

export interface LoginResult {
  success: boolean
  error?: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoggedIn: boolean
  loginWithCredentials: (email: string, password: string) => LoginResult
  login: (role: UserRole) => void  // kept for settings role switcher
  logout: () => void
  can: (permission: Permission) => boolean
  updateProfile: (updates: Partial<Pick<AuthUser, 'name' | 'photo'>>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = loadFromStorage<AuthUser | null>(STORAGE_KEYS.AUTH_USER, null)
    // Migrate legacy role name
    if (saved && (saved.role as string) === 'installation_incharge') {
      return { ...saved, role: 'technician' }
    }
    return saved
  })

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.AUTH_USER, user)
  }, [user])

  function loginWithCredentials(email: string, password: string): LoginResult {
    const result = authenticateUser(email, password)
    if (!result.ok) {
      if (result.reason === 'inactive') {
        return { success: false, error: 'This user is inactive. Please contact Admin.' }
      }
      return { success: false, error: 'Invalid email or password.' }
    }
    const account = result.user
    setUser({
      id:          account.id,
      role:        account.role as UserRole,
      name:        account.name,
      initials:    account.initials,
      email:       account.email,
      displayRole: account.displayRole,
    })
    return { success: true }
  }

  function login(role: UserRole) {
    const account = MOCK_USER_ACCOUNTS.find(u => u.role === role)
    if (!account) return
    setUser({ id: account.id, role, name: account.name, initials: account.initials, email: account.email })
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER)
  }

  function can(permission: Permission): boolean {
    if (!user) return false
    return hasPermission(user.role, permission)
  }

  function updateProfile(updates: Partial<Pick<AuthUser, 'name' | 'photo'>>) {
    setUser(prev => prev ? { ...prev, ...updates } : prev)
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, loginWithCredentials, login, logout, can, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
