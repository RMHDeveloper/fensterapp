import type { UserRole, Permission } from '../types'
import { ROLE_PERMISSIONS, SCREEN_PERMISSIONS } from '../data/permissions'

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function canAccessScreen(role: UserRole, screenPath: string): boolean {
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
    case 'owner':           return true
    case 'lead_manager':    return ['call', 'other', 'payment', 'delivery', 'site_visit'].includes(taskType)
    case 'site_engineer':   return taskType === 'site_visit'
    case 'production_team': return taskType === 'production' || taskType === 'qc_check'
    case 'viewer':          return false
    default:                return false
  }
}
