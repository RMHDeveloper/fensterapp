import type { UserRole, Permission } from '../types'
import { ROLE_PERMISSIONS, SCREEN_PERMISSIONS } from '../data/permissions'

// Accepts either a single role or every role assigned to a multi-role user —
// permission is granted if ANY assigned role grants it.
export function hasPermission(role: UserRole | UserRole[], permission: Permission): boolean {
  const roles = Array.isArray(role) ? role : [role]
  return roles.some(r => ROLE_PERMISSIONS[r]?.includes(permission) ?? false)
}

export function canAccessScreen(role: UserRole | UserRole[], screenPath: string): boolean {
  const required = SCREEN_PERMISSIONS[screenPath]
  if (!required) return true
  return hasPermission(role, required)
}

export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'owner':           return '/home'
    case 'lead_manager':    return '/home'
    case 'site_engineer':   return '/tasks'
    case 'production_team': return '/production'
    case 'viewer':          return '/home'
    default:                return '/home'
  }
}

export function canUpdateTask(role: UserRole, taskType: string): boolean {
  switch (role) {
    case 'owner':              return true
    case 'lead_manager':       return ['call', 'other', 'payment', 'delivery', 'site_visit', 'production'].includes(taskType)
    case 'site_engineer':      return taskType === 'site_visit'
    case 'production_admin':   return taskType === 'production' || taskType === 'qc_check'
    case 'production_manager': return taskType === 'production' || taskType === 'qc_check'
    case 'production_team':    return taskType === 'production' || taskType === 'qc_check'
    case 'technician':         return taskType === 'installation'
    case 'installation_incharge': return taskType === 'installation'
    case 'viewer':             return false
    default:                   return false
  }
}
