import type { LeaveApplication } from '../types'
import { getAllLeaveApplications, upsertLeaveApplications } from '../services/leaveService'
import { isSupabaseConfigured } from '../lib/supabase'

const LOCAL_KEY = 'fenster_leave_applications'

let _cache: LeaveApplication[] = []

function loadFromLocalStorage(): LeaveApplication[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) as LeaveApplication[] : []
  } catch {
    return []
  }
}

function saveToLocalStorage(list: LeaveApplication[]): void {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)) } catch { /* ignore quota errors */ }
}

export function loadLeaveApplications(): LeaveApplication[] {
  return _cache
}

function persist(list: LeaveApplication[]): void {
  _cache = list
  saveToLocalStorage(list)
  if (isSupabaseConfigured) upsertLeaveApplications(list).catch(() => {})
}

// Data source priority: Supabase (if configured) → in-memory cache → localStorage
export async function initLeaveApplicationsFromSupabase(): Promise<void> {
  if (isSupabaseConfigured) {
    const remote = await getAllLeaveApplications()
    if (remote.length > 0) {
      _cache = remote
      saveToLocalStorage(remote)
      return
    }
  }
  _cache = loadFromLocalStorage()
}

export function addLeaveApplication(entry: {
  technicianName: string
  fromDate: string
  toDate: string
  reason: string
  notes?: string
  createdBy: string
}): LeaveApplication {
  const now = new Date().toISOString()
  const newEntry: LeaveApplication = {
    id: `leave_${Date.now()}`,
    technicianName: entry.technicianName,
    fromDate: entry.fromDate,
    toDate: entry.toDate,
    reason: entry.reason,
    notes: entry.notes,
    status: 'pending',
    createdBy: entry.createdBy,
    createdAt: now,
    updatedAt: now,
  }
  persist([newEntry, ..._cache])
  return newEntry
}

export function updateLeaveApplicationStatus(id: string, status: LeaveApplication['status']): void {
  persist(_cache.map(l => l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l))
}
