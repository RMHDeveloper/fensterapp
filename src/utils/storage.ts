import type { Task, ProductionItem, Lead, Payment, Project, Mistake } from '../types'
import { TASKS, PRODUCTION_ITEMS, LEADS, PAYMENTS, PROJECTS, MISTAKES } from '../data/mockData'

// Bump whenever demo data changes — forces a reset on all browsers
const DATA_VERSION = 'fencraft-v9-empty-start'

export const STORAGE_KEYS = {
  AUTH_USER:    'fencraft_auth_user',
  TASKS:        'fencraft_tasks',
  PRODUCTION:   'fencraft_production',
  LEADS:        'fencraft_leads',
  PAYMENTS:     'fencraft_payments',
  PROJECTS:     'fencraft_projects',
  MISTAKES:     'fencraft_mistakes',
  QUOTATIONS:   'fencraft_quotations',
  DATA_VERSION: 'fencraft_data_version',
  FENSTER_USERS:'fenster_users',
} as const

export function saveToStorage<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { }
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

export function resetMockData(): void {
  saveToStorage(STORAGE_KEYS.TASKS,      [])
  saveToStorage(STORAGE_KEYS.PRODUCTION, [])
  saveToStorage(STORAGE_KEYS.LEADS,      [])
  saveToStorage(STORAGE_KEYS.PAYMENTS,   [])
  saveToStorage(STORAGE_KEYS.PROJECTS,   [])
  saveToStorage(STORAGE_KEYS.MISTAKES,   [])
  saveToStorage(STORAGE_KEYS.DATA_VERSION, DATA_VERSION)
}

export function clearAllData(): void {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('fencraft_') || key.startsWith('fenster_')) {
      localStorage.removeItem(key)
    }
  })
  saveToStorage(STORAGE_KEYS.DATA_VERSION, DATA_VERSION)
}

export function initStorageIfEmpty(): void {
  const storedVersion = localStorage.getItem(STORAGE_KEYS.DATA_VERSION)
  if (storedVersion !== DATA_VERSION) {
    resetMockData()
    return
  }
  if (!localStorage.getItem(STORAGE_KEYS.TASKS))      saveToStorage(STORAGE_KEYS.TASKS,      TASKS)
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTION)) saveToStorage(STORAGE_KEYS.PRODUCTION, PRODUCTION_ITEMS)
  if (!localStorage.getItem(STORAGE_KEYS.LEADS))      saveToStorage(STORAGE_KEYS.LEADS,      LEADS)
  if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS))   saveToStorage(STORAGE_KEYS.PAYMENTS,   PAYMENTS)
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS))   saveToStorage(STORAGE_KEYS.PROJECTS,   PROJECTS)
  if (!localStorage.getItem(STORAGE_KEYS.MISTAKES))   saveToStorage(STORAGE_KEYS.MISTAKES,   MISTAKES)
}

export const loadTasks      = (): Task[]           => loadFromStorage(STORAGE_KEYS.TASKS,      TASKS)
export const loadProduction = (): ProductionItem[] => loadFromStorage(STORAGE_KEYS.PRODUCTION, PRODUCTION_ITEMS)
export const loadLeads      = (): Lead[]            => loadFromStorage(STORAGE_KEYS.LEADS,      LEADS)
export const loadPayments   = (): Payment[]         => loadFromStorage(STORAGE_KEYS.PAYMENTS,   PAYMENTS)
export const loadProjects   = (): Project[]         => loadFromStorage(STORAGE_KEYS.PROJECTS,   PROJECTS)
export const loadMistakes   = (): Mistake[]         => loadFromStorage(STORAGE_KEYS.MISTAKES,   MISTAKES)
