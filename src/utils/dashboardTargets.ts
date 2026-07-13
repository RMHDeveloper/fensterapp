import type { DateFilter } from './dateRange'

// Targets are local-only (per browser), not synced across devices — the
// fenster_dashboard_targets table this used to try to sync to doesn't exist
// in Supabase (confirmed via a direct query), so every remote read/write was
// silently failing and falling back to local anyway. src/services/
// dashboardTargetsService.ts is left in place, ready to wire back in once
// that table is created.
const LOCAL_KEY = 'fc_dashboard_targets'
const OLD_LOCAL_KEY = 'fenster_dashboard_targets' // pre-rename key — migrated once below, then ignored

export interface PeriodTargets {
  ordersAmount: number
  productionSqft: number
  installationSqft: number
  collectionAmount: number
}

export interface DashboardTargets {
  daily:   PeriodTargets
  weekly:  PeriodTargets
  monthly: PeriodTargets
}

const DEFAULT_PERIOD: PeriodTargets = { ordersAmount: 0, productionSqft: 0, installationSqft: 0, collectionAmount: 0 }
const DEFAULT_TARGETS: DashboardTargets = { daily: { ...DEFAULT_PERIOD }, weekly: { ...DEFAULT_PERIOD }, monthly: { ...DEFAULT_PERIOD } }

function mergePeriod(saved: Partial<PeriodTargets> | undefined): PeriodTargets {
  return { ...DEFAULT_PERIOD, ...saved }
}

export function loadLocalTargets(): DashboardTargets {
  try {
    let raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) {
      // One-time carry-over from the old fenster_-prefixed key, which
      // runMigrations() wipes on an app-version bump — move it before that
      // happens rather than losing whatever targets were already set.
      const old = localStorage.getItem(OLD_LOCAL_KEY)
      if (old) { localStorage.setItem(LOCAL_KEY, old); raw = old }
    }
    if (!raw) return { daily: { ...DEFAULT_PERIOD }, weekly: { ...DEFAULT_PERIOD }, monthly: { ...DEFAULT_PERIOD } }
    const parsed = JSON.parse(raw) as Partial<DashboardTargets>
    return {
      daily:   mergePeriod(parsed.daily),
      weekly:  mergePeriod(parsed.weekly),
      monthly: mergePeriod(parsed.monthly),
    }
  } catch {
    return { daily: { ...DEFAULT_PERIOD }, weekly: { ...DEFAULT_PERIOD }, monthly: { ...DEFAULT_PERIOD } }
  }
}

function saveLocalTargets(targets: DashboardTargets): void {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(targets)) } catch { /* storage unavailable */ }
}

export async function loadDashboardTargets(): Promise<DashboardTargets> {
  return loadLocalTargets()
}

export async function saveDashboardTargets(targets: DashboardTargets): Promise<void> {
  saveLocalTargets(targets)
}

// Custom range falls back to daily × number of selected days.
export function getPeriodTargets(targets: DashboardTargets, filter: DateFilter, days: number): PeriodTargets {
  if (filter === 'today') return targets.daily
  if (filter === 'week')  return targets.weekly
  if (filter === 'month') return targets.monthly
  const n = Math.max(1, days)
  return {
    ordersAmount:      targets.daily.ordersAmount      * n,
    productionSqft:    targets.daily.productionSqft    * n,
    installationSqft:  targets.daily.installationSqft  * n,
    collectionAmount:  targets.daily.collectionAmount  * n,
  }
}

export { DEFAULT_TARGETS }
