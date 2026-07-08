import type { Task, UserRole } from '../types'

interface NavUser {
  id?: string
  name?: string
}

// Mirrors the per-role flow-task visibility already used on Home/Today's
// Tasks — centralized here so Previous/Next navigation (and any other task
// list consumer) doesn't re-implement the same per-role filtering.
export function getVisibleTasksForRole(tasks: Task[], role: UserRole, user: NavUser | null): Task[] {
  const isAssignedToMe = (t: Task) =>
    t.assignedTo === user?.name || t.assignedTo === user?.id ||
    t.assignee   === user?.name || t.assignee   === user?.id ||
    t.siteEngineerName === user?.name

  return tasks.filter(t => {
    if (t.flowStage == null || t.flowStage === 'completed') return false
    if (role === 'owner') return true
    if (role === 'site_engineer') return t.flowStage === 'site_visit' && isAssignedToMe(t)
    if (role === 'production_admin') return t.flowStage === 'production_check' || t.flowStage === 'admin_availability_check'
    if (role === 'production_manager') return t.flowStage === 'production_work'
    if (role === 'production_team') return t.flowStage === 'production_check' || t.flowStage === 'production_work'
    if (role === 'site_engineer_lead') return t.flowStage === 'site_lead_approval'
    if (role === 'technician' || role === 'installation_incharge') return (t.flowStage === 'installation_assign' || t.flowStage === 'installation_update') && isAssignedToMe(t)
    if (role === 'lead_manager') return true // caller is expected to have already scoped this to their own projects
    return false
  })
}

export type TaskSortOption = 'status' | 'priority' | 'date' | 'dueDate'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function getSortedTasks(tasks: Task[], sortOption?: TaskSortOption): Task[] {
  if (sortOption === 'priority') {
    return [...tasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
  }
  if (sortOption === 'date') {
    return [...tasks].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }
  // Default / 'dueDate': due date ascending, then priority high→low, then
  // created date newest first — matches the spec's fallback sort order.
  return [...tasks].sort((a, b) => {
    const dueA = a.dueDate && a.dueDate !== 'Today' ? a.dueDate : ''
    const dueB = b.dueDate && b.dueDate !== 'Today' ? b.dueDate : ''
    if (dueA !== dueB) return dueA.localeCompare(dueB)
    const prA = PRIORITY_ORDER[a.priority] ?? 2
    const prB = PRIORITY_ORDER[b.priority] ?? 2
    if (prA !== prB) return prA - prB
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
}

export interface TaskNavigationResult {
  currentIndex: number   // -1 if currentTaskId isn't in the list
  total: number
  previousTask: Task | null
  nextTask: Task | null
  hasPrevious: boolean
  hasNext: boolean
}

// Looks up where currentTaskId sits within an already filtered/sorted list —
// the list itself should already be whatever the caller was browsing
// (Pending tasks, Approvals, a project's task list, etc.) so Previous/Next
// stays inside that same context instead of jumping across the whole app.
export function getTaskNavigation(tasks: Task[], currentTaskId: string): TaskNavigationResult {
  const currentIndex = tasks.findIndex(t => t.id === currentTaskId)
  const total = tasks.length
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < total - 1
  return {
    currentIndex,
    total,
    previousTask: hasPrevious ? tasks[currentIndex - 1] : null,
    nextTask: hasNext ? tasks[currentIndex + 1] : null,
    hasPrevious,
    hasNext,
  }
}
