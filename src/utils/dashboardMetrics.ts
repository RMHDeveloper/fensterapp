import type { Project, Task, StatusHistoryItem } from '../types'
import { inRange, parseFlexDate } from './dateRange'

// ─── Formatting ─────────────────────────────────────────────────────────────
export function formatINR(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return '₹0'
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

export function formatSqFt(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '0 sq.ft'
  return `${Math.round(value).toLocaleString('en-IN')} sq.ft`
}

// Bar width is capped at 100 (visual), the caller still shows the real percentage/value.
export function calculateProgress(completed: number, target: number): number {
  if (!target || target <= 0) return 0
  return Math.round((completed / target) * 100)
}

// ─── Project value / area / payment helpers ────────────────────────────────
export function getProjectValue(p: Project): number {
  return p.costBreakdown?.quotationAmount ?? p.quotationAmount ?? p.value ?? 0
}

export function getProjectArea(p: Project): number {
  return p.costBreakdown?.numberOfSqft ?? 0
}

// One evolving flow task per project — find it once, reuse everywhere below.
export function getProjectTask(projectId: string, tasks: Task[]): Task | undefined {
  return tasks.find(t => t.projectId === projectId)
}

export function getTotalPaid(projectId: string, tasks: Task[]): number {
  return getProjectTask(projectId, tasks)?.paidAmount ?? 0
}

export function getBalanceAmount(p: Project, tasks: Task[]): number {
  const task = getProjectTask(p.id, tasks)
  if (task?.balanceAmount != null) return task.balanceAmount
  const value = getProjectValue(p)
  const paid  = getTotalPaid(p.id, tasks)
  return value > 0 ? Math.max(0, value - paid) : 0
}

// ─── Stage-event lookups (from task.statusHistory) ─────────────────────────
// First time the task entered a given flow stage — used to know exactly when
// a project "moved to production" / "moved to dispatch" / "completed
// installation" happened, instead of trusting the ambiguous currentStage string.
export function stageEnteredAt(task: Task | undefined, stage: string): string | undefined {
  const entry = (task?.statusHistory ?? []).find(h => h.stage === stage)
  return entry?.updatedAt
}

function stageEntries(task: Task | undefined, stage: string, status?: string): StatusHistoryItem[] {
  return (task?.statusHistory ?? []).filter(h => h.stage === stage && (!status || h.status === status))
}

// ─── Payment note parsing ───────────────────────────────────────────────────
// Advance/Partial/Final amounts aren't stored as separate ledger rows — each
// payment submission writes a fixed-format note onto the statusHistory entry
// (see DemoFlowSheet's submitAdvancePayment/submitFinalPayment). Parsing the
// incremental amount back out of that note is what lets the Collection card
// show a true per-period breakdown instead of just the task's current
// (cumulative, overwritten-on-every-payment) paidAmount field.
function parseRupeeAmount(note: string | undefined, prefix: string): number {
  if (!note) return 0
  const m = note.match(new RegExp(`${prefix}\\s*₹([\\d,]+)`))
  if (!m) return 0
  return Number(m[1].replace(/,/g, '')) || 0
}

export interface CollectionBreakdown {
  advance: number
  partial: number
  final: number
  total: number
}

export function getCollectionBreakdown(tasks: Task[], from: Date, to: Date): CollectionBreakdown {
  let advance = 0, partial = 0, final = 0
  for (const t of tasks) {
    for (const h of t.statusHistory ?? []) {
      if (!inRange(h.updatedAt, from, to)) continue
      if (h.stage === 'advance_payment' && h.status === 'completed') {
        advance += parseRupeeAmount(h.note, 'Advance')
      } else if (h.stage === 'final_payment' && h.status === 'partial_paid') {
        partial += parseRupeeAmount(h.note, 'Partial payment')
      } else if (h.stage === 'final_payment' && h.status === 'completed') {
        final += parseRupeeAmount(h.note, 'Final payment')
      }
    }
  }
  return { advance, partial, final, total: advance + partial + final }
}

// ─── Top dashboard cards ────────────────────────────────────────────────────
export interface CountAmountMetric {
  count: number
  completed: number
}

// Orders: sites whose flow task first entered production_assign (advance
// collected, job sheet sent to Admin) within the selected range.
export function getOrdersMetric(projects: Project[], tasks: Task[], from: Date, to: Date): CountAmountMetric {
  const items = projects.filter(p => {
    const d = stageEnteredAt(getProjectTask(p.id, tasks), 'production_assign')
    return d ? inRange(d, from, to) : false
  })
  return { count: items.length, completed: items.reduce((s, p) => s + getProjectValue(p), 0) }
}

// Production: sites whose flow task first entered dispatch_assign (production
// checklist finished, ready to dispatch) within the selected range.
export function getProductionMetric(projects: Project[], tasks: Task[], from: Date, to: Date): CountAmountMetric {
  const items = projects.filter(p => {
    const d = stageEnteredAt(getProjectTask(p.id, tasks), 'dispatch_assign')
    return d ? inRange(d, from, to) : false
  })
  return { count: items.length, completed: items.reduce((s, p) => s + getProjectArea(p), 0) }
}

// Installation: sites whose flow task first entered final_payment (installation
// marked complete, or a resolved mistake moved it to payment collection).
export function getInstallationMetric(projects: Project[], tasks: Task[], from: Date, to: Date): CountAmountMetric {
  const items = projects.filter(p => {
    const d = stageEnteredAt(getProjectTask(p.id, tasks), 'final_payment')
    return d ? inRange(d, from, to) : false
  })
  return { count: items.length, completed: items.reduce((s, p) => s + getProjectArea(p), 0) }
}

// Re-exported so callers building the "entries in range" style debug/detail
// views don't need to reach into statusHistory conventions themselves.
export { stageEntries }

// ─── Outstanding payment, bucketed by month ────────────────────────────────
export interface OutstandingMonthBucket {
  key: string      // '2026-01'
  label: string     // 'Jan 2026'
  amount: number
  projects: Project[]
}

// Month is taken from the project's due date, falling back to when it was
// last updated / created if no due date was ever set.
function outstandingMonthDate(p: Project, tasks: Task[]): Date | undefined {
  const task = getProjectTask(p.id, tasks)
  const candidates = [
    p.dueDate && p.dueDate !== '—' ? p.dueDate : undefined,
    task?.dueDate && task.dueDate !== 'Today' ? task.dueDate : undefined,
    p.updatedAt,
    p.createdAt,
  ]
  for (const c of candidates) {
    if (!c) continue
    const d = parseFlexDate(c)
    if (!isNaN(d.getTime())) return d
  }
  return undefined
}

export function getOutstandingByMonth(projects: Project[], tasks: Task[], monthsBack = 6): OutstandingMonthBucket[] {
  const buckets = new Map<string, OutstandingMonthBucket>()
  for (const p of projects) {
    const balance = getBalanceAmount(p, tasks)
    if (balance <= 0) continue
    const d = outstandingMonthDate(p, tasks)
    if (!d) continue
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    const bucket = buckets.get(key) ?? { key, label, amount: 0, projects: [] }
    bucket.amount += balance
    bucket.projects.push(p)
    buckets.set(key, bucket)
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-monthsBack)
}
