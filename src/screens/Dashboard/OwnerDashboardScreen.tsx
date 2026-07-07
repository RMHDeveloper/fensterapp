import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { Calendar, ChevronDown, ChevronRight, X } from 'lucide-react'
import { loadManagedUsers } from '../../utils/userStorage'
import type { Project } from '../../types'

type DateFilter = 'today' | 'week' | 'month' | 'custom'

function getDateRange(filter: DateFilter, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (filter === 'today') return { from: todayStart, to: todayEnd }
  if (filter === 'week') {
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const weekStart = new Date(todayStart)
    weekStart.setDate(todayStart.getDate() - diff)
    return { from: weekStart, to: todayEnd }
  }
  if (filter === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: todayEnd }
  }
  const from = customFrom ? new Date(customFrom + 'T00:00:00') : todayStart
  const to   = customTo   ? new Date(customTo   + 'T23:59:59') : todayEnd
  return { from, to }
}

function inRange(dateStr: string | undefined, from: Date, to: Date): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return !isNaN(d.getTime()) && d >= from && d <= to
}

function leadDate(l: { createdAt?: string; lastContact?: string }): string | undefined {
  return l.createdAt || l.lastContact
}

function projectArea(p: Project): number {
  return p.costBreakdown?.numberOfSqft ?? (p as { totalArea?: number }).totalArea ?? 0
}
function projectQuota(p: Project): number {
  return p.costBreakdown?.quotationAmount ?? p.quotationAmount ?? p.value ?? 0
}
function isCompleted(p: Project): boolean {
  return p.isCompleted === true || p.currentStage === 'completed' ||
    !!p.completedAt || !!p.actualCompletedDate
}

// Short rupee format
function fmt(n: number): string {
  if (!n || isNaN(n)) return '₹0'
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000)  return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n}`
}

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom',label: 'Custom' },
]

const STAGE_COLOR: Record<string, string> = {
  measurement:  'bg-cyan-400',
  quotation:    'bg-violet-400',
  production:   'bg-amber-400',
  installation: 'bg-rose-400',
  payment:      'bg-green-400',
  completed:    'bg-emerald-500',
}

const MEASUREMENT_STAGES = new Set(['new_project','measurement','site_visit_assigned','site_visit','site_visit_completed','waiting_site_visit_review','reschedule_requested','reschedule_approved','quotation_preparation','quotation_sent_owner','quotation_sent_md_ed','owner_approved','md_ed_approved','quotation_rework','sent_to_client','waiting_client_approval','client_approved','client_rejected','client_not_approved','negotiation'])
const PRODUCTION_STAGES  = new Set(['advance_payment','advance_payment_pending','waiting_advance_payment','production_sheet_preparation','production_admin_check','waiting_material_availability','production_manager_work','ready_to_dispatch'])
const INSTALL_STAGES     = new Set(['installation_assigned','installation','installation_in_progress','installation_not_completed','installation_mistake','installation_completed','final_payment','payment_pending','partial_paid','remaining_payment_pending'])

function getStageGroup(p: Project): keyof typeof STAGE_COLOR {
  if (isCompleted(p)) return 'completed'
  const s = p.currentStage ?? ''
  if (INSTALL_STAGES.has(s)) return s.includes('payment') || s.includes('paid') ? 'payment' : 'installation'
  if (PRODUCTION_STAGES.has(s)) return 'production'
  return 'measurement'
}

// ── LO Performance detail panel ──────────────────────────────────────────────
interface LOPanelProps {
  loName: string
  projects: Project[]
  onClose: () => void
}
function LOPanel({ loName, projects, onClose }: LOPanelProps) {
  const navigate = useNavigate()
  const groups = {
    measurement:  projects.filter(p => getStageGroup(p) === 'measurement'),
    quotation:    projects.filter(p => getStageGroup(p) === 'quotation'),
    production:   projects.filter(p => getStageGroup(p) === 'production'),
    installation: projects.filter(p => getStageGroup(p) === 'installation'),
    payment:      projects.filter(p => getStageGroup(p) === 'payment'),
    completed:    projects.filter(p => getStageGroup(p) === 'completed'),
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">LO Performance</p>
          <p className="text-base font-extrabold text-slate-800">{loName}</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
          <X size={16} className="text-slate-600" />
        </button>
      </div>

      {/* Stage summary chips */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
        {(Object.entries(groups) as [string, Project[]][]).map(([key, list]) => list.length > 0 && (
          <div key={key} className="flex-shrink-0 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
            <span className={`w-2 h-2 rounded-full ${STAGE_COLOR[key]}`} />
            <span className="text-xs font-semibold text-slate-600 capitalize">{key}</span>
            <span className="text-xs font-extrabold text-slate-800">{list.length}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2 pt-2">
        {projects.length === 0 ? (
          <p className="text-center text-sm text-slate-400 mt-8">No projects assigned</p>
        ) : (
          projects.map(p => {
            const stage = getStageGroup(p)
            const q     = projectQuota(p)
            return (
              <button key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-left active:bg-slate-50 flex items-center gap-3">
                <span className={`w-2 h-full min-h-[36px] rounded-full ${STAGE_COLOR[stage]} flex-shrink-0`} style={{ minWidth: 4, width: 4 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{p.name || p.client}</p>
                  <p className="text-xs text-slate-400 truncate">{p.client} · {p.stage || p.currentStage}</p>
                </div>
                {q > 0 && <p className="text-xs font-semibold text-slate-600 flex-shrink-0">{fmt(q)}</p>}
                <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function OwnerDashboardScreen() {
  const { projects: allProjects, tasks, leads, mistakes } = useAppData()
  // Not yet converted from their lead — stay off the MD dashboard until the LM converts them
  const projects = allProjects.filter(p => !p.pendingConversion)
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [selectedLO, setSelectedLO] = useState<string | null>(null)

  const { from, to } = useMemo(
    () => getDateRange(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo]
  )

  // ── Filtered LEADS (primary date entity) ──────────────────────────────────
  const filteredLeads = useMemo(
    () => leads.filter(l => inRange(leadDate(l), from, to)),
    [leads, from, to]
  )
  const filteredLeadIds = useMemo(() => new Set(filteredLeads.map(l => l.id)), [filteredLeads])

  // Projects linked to filtered leads
  const linkedProjects = useMemo(
    () => projects.filter(p => p.leadId && filteredLeadIds.has(p.leadId)),
    [projects, filteredLeadIds]
  )
  const linkedProjectIds = useMemo(() => new Set(linkedProjects.map(p => p.id)), [linkedProjects])

  // All tasks for linked projects
  const linkedTasks = useMemo(
    () => tasks.filter(t => t.projectId && linkedProjectIds.has(t.projectId)),
    [tasks, linkedProjectIds]
  )

  // Mistakes in date range
  const filteredMistakes = useMemo(
    () => mistakes.filter(m => inRange((m as { createdAt?: string }).createdAt, from, to)),
    [mistakes, from, to]
  )
  const openMistakes = filteredMistakes.filter(m => (m as { status?: string }).status === 'open').length

  // ── Section 1: Lead Overview ──────────────────────────────────────────────
  const totalLeads    = filteredLeads.length
  const totalLeadArea = linkedProjects.reduce((s, p) => s + projectArea(p), 0)
  const proposedAmt   = linkedProjects.reduce((s, p) => s + projectQuota(p), 0)

  // ── Section 2: Production Overview ───────────────────────────────────────
  const convertedProjects    = linkedProjects  // leads that became projects
  const movedToProject       = convertedProjects.length
  const convertedArea        = convertedProjects.reduce((s, p) => s + projectArea(p), 0)
  // Total collected from customers (sum paidAmount across all tasks of these projects)
  const totalCollected       = linkedTasks.reduce((s, t) => s + (t.paidAmount ?? 0), 0)
  const completedProjects    = convertedProjects.filter(isCompleted)
  const completedCount       = completedProjects.length

  // ── Section 3: Payment Summary ────────────────────────────────────────────
  // Helper: total paid for a project
  const projectPaid = (p: Project) =>
    linkedTasks.filter(t => t.projectId === p.id).reduce((s, t) => s + (t.paidAmount ?? 0), 0)

  // Helper: balance for a project
  const projectBalance = (p: Project) => {
    const taskWithBalance = [...linkedTasks.filter(t => t.projectId === p.id)]
      .reverse().find(t => t.balanceAmount != null)
    if (taskWithBalance?.balanceAmount != null) return taskWithBalance.balanceAmount
    const quota = projectQuota(p)
    const paid  = projectPaid(p)
    return quota > 0 ? Math.max(0, quota - paid) : 0
  }

  // Projects where any payment was collected
  const paidProjects        = convertedProjects.filter(p => projectPaid(p) > 0)
  const totalCollectedAmt   = paidProjects.reduce((s, p) => s + projectPaid(p), 0)

  // Projects with pending balance
  const pendingProjects     = convertedProjects.filter(p => projectBalance(p) > 0)
  const totalPendingAmt     = pendingProjects.reduce((s, p) => s + projectBalance(p), 0)

  // Projects with advance paid (paidAmount > 0 on any task)
  const advancePaidProjects = convertedProjects.filter(p => projectPaid(p) > 0)
  const totalAdvanceAmt     = advancePaidProjects.reduce((s, p) => s + projectPaid(p), 0)

  // Fully paid projects
  const fullyPaidProjects   = convertedProjects.filter(p => {
    if (p.paymentStatus === 'Full Paid' || p.paymentStatus === 'Fully Paid') return true
    if (projectBalance(p) === 0 && projectPaid(p) > 0) return true
    const quota = projectQuota(p)
    return quota > 0 && projectPaid(p) >= quota
  })
  const totalFullyPaidAmt   = fullyPaidProjects.reduce((s, p) => s + projectQuota(p), 0)

  // ── LO Performance ───────────────────────────────────────────────────────
  // Not memoized with an empty dep array on purpose: managed users load
  // asynchronously from Supabase and may still be empty on first mount.
  const allLOs = loadManagedUsers().filter(u => u.status === 'active' && u.role === 'lead_manager')

  // For each LO, get their projects from ALL projects (not just date-filtered) for performance view
  const loStats = useMemo(() => {
    return allLOs.map(lo => {
      const loProjects = projects.filter(p =>
        p.ownerId === lo.id ||
        p.ownerName === lo.fullName ||
        // Also match leads assigned to this LO
        (p.leadId && leads.find(l => l.id === p.leadId && l.assignee === lo.fullName))
      )
      const total     = loProjects.length
      const completed = loProjects.filter(isCompleted).length
      const inProd    = loProjects.filter(p => !isCompleted(p) && PRODUCTION_STAGES.has(p.currentStage ?? '')).length
      const inInstall = loProjects.filter(p => !isCompleted(p) && INSTALL_STAGES.has(p.currentStage ?? '')).length
      const inMeas    = loProjects.filter(p => !isCompleted(p) && !PRODUCTION_STAGES.has(p.currentStage ?? '') && !INSTALL_STAGES.has(p.currentStage ?? '')).length
      const totalValue = loProjects.reduce((s, p) => s + projectQuota(p), 0)
      return { lo, loProjects, total, completed, inProd, inInstall, inMeas, totalValue }
    }).filter(s => s.total > 0 || s.lo.status === 'active')
  }, [allLOs, projects, leads])

  const selectedLOData = selectedLO
    ? loStats.find(s => s.lo.id === selectedLO)
    : null

  // Range label
  const rangeLabel = useMemo(() => {
    const fmtD = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    if (dateFilter === 'today') return `Today — ${fmtD(from)}`
    if (dateFilter === 'week')  return `${fmtD(from)} – ${fmtD(to)}`
    if (dateFilter === 'month') return from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    if (customFrom || customTo) return `${customFrom || '…'} to ${customTo || '…'}`
    return 'Select date range'
  }, [dateFilter, from, to, customFrom, customTo])

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <AppHeader />

      {/* Date filter */}
      <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 sticky top-14 z-20 space-y-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {DATE_FILTERS.map(f => (
            <button key={f.value} onClick={() => setDateFilter(f.value)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors
                ${dateFilter === f.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 py-1">
            <Calendar size={13} className="text-slate-400 flex-shrink-0" />
            <input type="date" value={customFrom} max={customTo || undefined}
              onChange={e => setCustomFrom(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none focus:border-blue-400" />
            <span className="text-xs text-slate-400 font-semibold flex-shrink-0">to</span>
            <input type="date" value={customTo} min={customFrom || undefined}
              onChange={e => setCustomTo(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none focus:border-blue-400" />
          </div>
        )}
        <p className="text-[10px] text-slate-400 font-semibold pb-1">{rangeLabel}</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {filteredLeads.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-6 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm font-semibold text-slate-600">No leads in this period</p>
            <p className="text-xs text-slate-400 mt-1">Try a different date range</p>
          </div>
        )}

        {/* ── Lead Overview ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Lead Overview</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Leads',      value: String(totalLeads),                              color: 'text-blue-600'   },
              { label: 'Total Area (sqft)', value: totalLeadArea > 0 ? `${totalLeadArea}` : '0',  color: 'text-teal-600'   },
              { label: 'Proposed Amount',  value: fmt(proposedAmt),                                color: 'text-violet-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={`text-lg font-extrabold ${color} break-all`}>{value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Production Overview ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Production Overview</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Moved to Project', value: String(movedToProject),                             color: 'text-amber-600'   },
              { label: 'Area (sqft)',       value: convertedArea > 0 ? `${convertedArea}` : '0',       color: 'text-orange-600'  },
              { label: 'Production Amt',   value: fmt(totalCollected),                                 color: 'text-emerald-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={`text-lg font-extrabold ${color} break-all`}>{value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center justify-between mt-2">
            <p className="text-xs text-emerald-600 font-semibold">Projects Completed</p>
            <p className="text-lg font-extrabold text-emerald-700">{completedCount}</p>
          </div>
        </div>

        {/* ── Payment Summary ───────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Payment Summary</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Payment Collected',
                count: paidProjects.length,
                amt:   totalCollectedAmt,
                bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-700',
              },
              {
                label: 'Pending',
                count: pendingProjects.length,
                amt:   totalPendingAmt,
                bg: 'bg-amber-50',   border: 'border-amber-200',   color: 'text-amber-700',
              },
              {
                label: 'Advance Paid',
                count: advancePaidProjects.length,
                amt:   totalAdvanceAmt,
                bg: 'bg-blue-50',    border: 'border-blue-200',    color: 'text-blue-700',
              },
              {
                label: 'Fully Paid',
                count: fullyPaidProjects.length,
                amt:   totalFullyPaidAmt,
                bg: 'bg-green-50',   border: 'border-green-200',   color: 'text-green-700',
              },
            ].map(({ label, count, amt, bg, border, color }) => (
              <div key={label} className={`${bg} border ${border} rounded-2xl p-4`}>
                <p className={`text-2xl font-extrabold ${color} leading-none`}>{count}</p>
                <p className="text-xs text-slate-500 mt-0.5 font-semibold">({fmt(amt)})</p>
                <p className="text-[11px] text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Individual LO Performance ─────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">LO Performance</p>
          <div className="space-y-3">
            {loStats.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-center">
                <p className="text-sm text-slate-400">No Lead Owners found</p>
              </div>
            )}
            {loStats.map(({ lo, loProjects, total, completed, inProd, inInstall, inMeas, totalValue }) => {
              const pctCompleted = total > 0 ? (completed / total) * 100 : 0
              const pctProd      = total > 0 ? (inProd    / total) * 100 : 0
              const pctInstall   = total > 0 ? (inInstall / total) * 100 : 0
              const pctMeas      = total > 0 ? (inMeas    / total) * 100 : 0

              return (
                <button key={lo.id}
                  onClick={() => setSelectedLO(lo.id)}
                  className="w-full bg-white rounded-2xl border border-slate-200 p-4 text-left active:bg-slate-50 shadow-sm">

                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-extrabold">
                          {lo.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-slate-800">{lo.fullName}</p>
                        <p className="text-[11px] text-slate-400">{total} project{total !== 1 ? 's' : ''} · {fmt(totalValue)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-emerald-600">{completed}</p>
                        <p className="text-[10px] text-slate-400">done</p>
                      </div>
                      <ChevronDown size={14} className="text-slate-300" />
                    </div>
                  </div>

                  {/* Bar chart */}
                  {total > 0 && (
                    <>
                      <div className="h-3 rounded-full overflow-hidden bg-slate-100 flex">
                        {pctMeas    > 0 && <div className="bg-cyan-400 h-full transition-all"    style={{ width: `${pctMeas}%` }} />}
                        {pctProd    > 0 && <div className="bg-amber-400 h-full transition-all"   style={{ width: `${pctProd}%` }} />}
                        {pctInstall > 0 && <div className="bg-rose-400 h-full transition-all"    style={{ width: `${pctInstall}%` }} />}
                        {pctCompleted > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${pctCompleted}%` }} />}
                      </div>
                      <div className="flex gap-3 mt-2 flex-wrap">
                        {[
                          { label: 'Pre-prod', count: inMeas,    color: 'bg-cyan-400'    },
                          { label: 'Production',count: inProd,   color: 'bg-amber-400'   },
                          { label: 'Install',   count: inInstall,color: 'bg-rose-400'    },
                          { label: 'Done',      count: completed, color: 'bg-emerald-500' },
                        ].filter(i => i.count > 0).map(({ label, count, color }) => (
                          <div key={label} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${color}`} />
                            <span className="text-[10px] text-slate-500">{label} <span className="font-bold text-slate-700">{count}</span></span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {total === 0 && (
                    <p className="text-xs text-slate-400 italic">No projects yet</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Open Mistakes */}
        {openMistakes > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-wide">Open Mistakes</p>
                <p className="text-2xl font-extrabold text-red-700 mt-1">{openMistakes}</p>
              </div>
              <p className="text-[11px] text-red-500">Needs attention</p>
            </div>
          </div>
        )}

      </div>

      {/* LO Detail Panel (full-screen overlay) */}
      {selectedLOData && (
        <LOPanel
          loName={selectedLOData.lo.fullName}
          projects={selectedLOData.loProjects}
          onClose={() => setSelectedLO(null)}
        />
      )}
    </div>
  )
}
