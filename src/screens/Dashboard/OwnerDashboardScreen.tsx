import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { Calendar, ChevronDown, ChevronRight, X, SlidersHorizontal } from 'lucide-react'
import { loadManagedUsers } from '../../utils/userStorage'
import { getLeadFlowBucket, isCompletedProject } from '../../utils/stageHelpers'
import { type DateFilter, DATE_FILTERS, getDateRange, inRange, leadDate } from '../../utils/dateRange'
import {
  formatINR, formatSqFt, calculateProgress,
  getProjectValue, getProjectArea, getBalanceAmount, getTotalPaid,
  getOrdersMetric, getProductionMetric, getInstallationMetric, getCollectionBreakdown,
  getOutstandingByMonth, type OutstandingMonthBucket,
} from '../../utils/dashboardMetrics'
import {
  loadDashboardTargets, saveDashboardTargets, getPeriodTargets, DEFAULT_TARGETS,
  type DashboardTargets, type PeriodTargets,
} from '../../utils/dashboardTargets'
import type { Project, Task, Lead } from '../../types'

// ── LO Performance — Negotiation / Production / Done ─────────────────────────
type LOStage = 'negotiation' | 'production' | 'done'

const LO_STAGE_LABEL: Record<LOStage, string> = {
  negotiation: 'Negotiation', production: 'Production', done: 'Done',
}
const LO_STAGE_COLOR: Record<LOStage, string> = {
  negotiation: 'text-violet-600', production: 'text-amber-600', done: 'text-emerald-600',
}
const LO_STAGE_BAR: Record<LOStage, string> = {
  negotiation: 'bg-violet-500', production: 'bg-amber-500', done: 'bg-emerald-500',
}

interface LORow {
  id: string
  customerName: string
  stageLabel: string
  amount: number
  lastUpdated: string
  path: string
}

interface LOPanelProps {
  loName: string
  negotiationLeads: Lead[]
  productionProjects: Project[]
  doneProjects: Project[]
  allProjects: Project[]
  initialStage: LOStage
  onClose: () => void
}

function LOPanel({ loName, negotiationLeads, productionProjects, doneProjects, allProjects, initialStage, onClose }: LOPanelProps) {
  const navigate = useNavigate()
  const [stage, setStage]           = useState<LOStage>(initialStage)
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')

  const { from, to } = useMemo(
    () => getDateRange(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo]
  )

  const rows: LORow[] = useMemo(() => {
    if (stage === 'negotiation') {
      return negotiationLeads
        .filter(l => inRange(leadDate(l), from, to))
        .map(l => {
          const proj = allProjects.find(p => p.leadId === l.id)
          return {
            id: l.id,
            customerName: l.name,
            stageLabel: 'Negotiation',
            amount: proj ? getProjectValue(proj) : 0,
            lastUpdated: leadDate(l) ?? '—',
            path: `/leads`,
          }
        })
    }
    const list = stage === 'production' ? productionProjects : doneProjects
    return list
      .filter(p => inRange(p.updatedAt ?? p.createdAt, from, to))
      .map(p => ({
        id: p.id,
        customerName: p.client,
        stageLabel: stage === 'done' ? 'Completed' : (p.stage || 'In Progress'),
        amount: getProjectValue(p),
        lastUpdated: p.updatedAt ?? p.createdAt ?? '—',
        path: `/project/${p.id}`,
      }))
  }, [stage, negotiationLeads, productionProjects, doneProjects, allProjects, from, to])

  const totalAmt = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Sales Team Performance</p>
          <p className="text-base font-extrabold text-slate-800">{loName}</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
          <X size={16} className="text-slate-600" />
        </button>
      </div>

      {/* Stage selector */}
      <div className="px-4 pt-3 flex gap-2 flex-shrink-0">
        {(['negotiation', 'production', 'done'] as LOStage[]).map(s => (
          <button key={s} onClick={() => setStage(s)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${stage === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {LO_STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <div className="px-4 pt-3 flex-shrink-0 space-y-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {DATE_FILTERS.map(f => (
            <button key={f.value} onClick={() => setDateFilter(f.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${dateFilter === f.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2">
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
      </div>

      {/* Highlighted total */}
      <div className="px-4 pt-3 flex-shrink-0">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
          <p className={`text-2xl font-extrabold ${LO_STAGE_COLOR[stage]} leading-none`}>{formatINR(totalAmt)}</p>
          <p className="text-xs text-slate-500 mt-1">{rows.length} {stage === 'negotiation' ? 'lead' : 'project'}{rows.length !== 1 ? 's' : ''} · {LO_STAGE_LABEL[stage]}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 mt-8">Nothing in this period</p>
        ) : (
          rows.map(r => (
            <button key={r.id} onClick={() => navigate(r.path)}
              className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-left active:bg-slate-50 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{r.customerName}</p>
                <p className="text-xs text-slate-400 truncate">{r.stageLabel} · Updated {r.lastUpdated}</p>
              </div>
              {r.amount > 0 && <p className="text-xs font-semibold text-slate-600 flex-shrink-0">{formatINR(r.amount)}</p>}
              <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Performance target cards ─────────────────────────────────────────────────
type CardKey = 'orders' | 'production' | 'installation' | 'collection'

const CARD_COLORS: Record<CardKey, { badge: string; bar: string; text: string }> = {
  orders:       { badge: 'text-blue-600',    bar: 'bg-blue-500',    text: 'text-blue-700'    },
  production:   { badge: 'text-amber-600',   bar: 'bg-amber-500',   text: 'text-amber-700'   },
  installation: { badge: 'text-rose-600',    bar: 'bg-rose-500',    text: 'text-rose-700'    },
  collection:   { badge: 'text-emerald-600', bar: 'bg-emerald-500', text: 'text-emerald-700' },
}

function PerformanceCard({
  colorKey, title, subtitle, count, countLabel, completed, target, formatValue, children,
}: {
  colorKey: CardKey
  title: string
  subtitle?: string
  count: number
  countLabel: string
  completed: number
  target: number
  formatValue: (n: number) => string
  children?: React.ReactNode
}) {
  const c = CARD_COLORS[colorKey]
  const pct = calculateProgress(completed, target)
  const barPct = Math.min(100, pct)
  const exceeded = target > 0 && completed > target

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-0.5">
        <p className="text-sm font-extrabold text-slate-800">{title}</p>
        {countLabel && <span className={`text-xs font-bold ${c.badge} flex-shrink-0`}>{count} {countLabel}</span>}
      </div>
      {subtitle && <p className="text-[10px] text-slate-400 mb-3">{subtitle}</p>}

      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-2 mb-2">
        <div className={`h-full ${c.bar} transition-all`} style={{ width: `${barPct}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Target: <span className="font-bold text-slate-700">{formatValue(target)}</span></span>
        <span className="font-extrabold text-slate-800">{pct}%</span>
      </div>
      <div className="flex items-center justify-between text-xs mt-0.5">
        <span className="text-slate-500">Completed: <span className={`font-bold ${c.text}`}>{formatValue(completed)}</span></span>
        {exceeded && <span className="text-[10px] font-bold text-emerald-600">Target exceeded</span>}
      </div>

      {children}
    </div>
  )
}

// ── Edit Targets modal ───────────────────────────────────────────────────────
function EditTargetsModal({ targets, onClose, onSaved }: { targets: DashboardTargets; onClose: () => void; onSaved: (t: DashboardTargets) => void }) {
  const [draft, setDraft] = useState<DashboardTargets>(targets)
  const [saving, setSaving] = useState(false)

  function setField(period: keyof DashboardTargets, field: keyof PeriodTargets, value: string) {
    const n = Number(value.replace(/[^0-9]/g, '')) || 0
    setDraft(prev => ({ ...prev, [period]: { ...prev[period], [field]: n } }))
  }

  async function handleSave() {
    setSaving(true)
    await saveDashboardTargets(draft)
    setSaving(false)
    onSaved(draft)
  }

  const FIELDS: { key: keyof PeriodTargets; label: string; isSqft?: boolean }[] = [
    { key: 'ordersAmount',     label: 'Orders Target Amount (₹)' },
    { key: 'productionSqft',   label: 'Production Target Sq.ft', isSqft: true },
    { key: 'installationSqft', label: 'Installation Target Sq.ft', isSqft: true },
    { key: 'collectionAmount', label: 'Collection Target Amount (₹)' },
  ]
  const PERIODS: { key: keyof DashboardTargets; label: string }[] = [
    { key: 'daily',   label: 'Daily Targets'   },
    { key: 'weekly',  label: 'Weekly Targets'  },
    { key: 'monthly', label: 'Monthly Targets' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
        <p className="text-base font-extrabold text-slate-800">Edit Targets</p>
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
          <X size={16} className="text-slate-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {PERIODS.map(({ key: periodKey, label: periodLabel }) => (
          <div key={periodKey}>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{periodLabel}</p>
            <div className="space-y-2.5">
              {FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">{label}</label>
                  <input
                    type="text" inputMode="numeric"
                    value={draft[periodKey][key] || ''}
                    onChange={e => setField(periodKey, key, e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-slate-400">Custom date range targets use the daily target × number of selected days.</p>
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100">
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Targets'}
        </button>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function OwnerDashboardScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { projects: allProjects, tasks, leads, mistakes, isSupabaseReady } = useAppData()
  // Not yet converted from their lead — stay off the MD dashboard until the LM converts them
  const projects = allProjects.filter(p => !p.pendingConversion)

  // Visible to MD / ED / Owner only — all three map to the internal 'owner' role in this app
  useEffect(() => {
    if (user && user.role !== 'owner') navigate('/home', { replace: true })
  }, [user, navigate])

  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [selectedLO, setSelectedLO] = useState<string | null>(null)
  const [selectedLOStage, setSelectedLOStage] = useState<LOStage>('production')
  const [showEditTargets, setShowEditTargets] = useState(false)
  const [targets, setTargets] = useState<DashboardTargets>(DEFAULT_TARGETS)
  const [openMonth, setOpenMonth] = useState<string | null>(null)

  useEffect(() => { loadDashboardTargets().then(setTargets) }, [])

  const { from, to } = useMemo(
    () => getDateRange(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo]
  )
  const rangeDays = useMemo(
    () => Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1),
    [from, to]
  )
  const periodTargets = useMemo(
    () => getPeriodTargets(targets, dateFilter, rangeDays),
    [targets, dateFilter, rangeDays]
  )

  const periodWord =
    dateFilter === 'today' ? "Today's" :
    dateFilter === 'week'  ? "This Week's" :
    dateFilter === 'month' ? "This Month's" : ''

  // ── Top 4 performance cards ────────────────────────────────────────────────
  const ordersMetric       = useMemo(() => getOrdersMetric(projects, tasks, from, to),       [projects, tasks, from, to])
  const productionMetric   = useMemo(() => getProductionMetric(projects, tasks, from, to),   [projects, tasks, from, to])
  const installationMetric = useMemo(() => getInstallationMetric(projects, tasks, from, to), [projects, tasks, from, to])
  const collection         = useMemo(() => getCollectionBreakdown(tasks, from, to),          [tasks, from, to])

  // Mistakes in date range
  const filteredMistakes = useMemo(
    () => mistakes.filter(m => inRange((m as { createdAt?: string }).createdAt, from, to)),
    [mistakes, from, to]
  )
  const openMistakes = filteredMistakes.filter(m => (m as { status?: string }).status === 'open').length

  // ── LO Performance ───────────────────────────────────────────────────────
  // Not memoized with an empty dep array on purpose: managed users load
  // asynchronously from Supabase and may still be empty on first mount.
  const allLOs = loadManagedUsers().filter(u => u.status === 'active' && u.role === 'lead_manager')

  // For each LO: Negotiation (their leads still pre-conversion, quotation-stage),
  // Production (their converted, not-yet-completed projects), Done (completed projects).
  const loStats = useMemo(() => {
    return allLOs.map(lo => {
      const loLeads = leads.filter(l => l.assignee === lo.fullName)
      const negotiationLeads = loLeads.filter(l => {
        const bucket = getLeadFlowBucket(l, allProjects, tasks)
        return bucket === 'quotation' || bucket === 'negotiation'
      })
      const negotiationAmt = negotiationLeads.reduce((s, l) => {
        const proj = allProjects.find(p => p.leadId === l.id)
        return s + (proj ? getProjectValue(proj) : 0)
      }, 0)

      const loProjects = projects.filter(p =>
        p.ownerId === lo.id ||
        p.ownerName === lo.fullName ||
        (p.leadId && leads.find(l => l.id === p.leadId && l.assignee === lo.fullName))
      )
      const doneProjects       = loProjects.filter(isCompletedProject)
      const productionProjects = loProjects.filter(p => !isCompletedProject(p))
      const productionAmt = productionProjects.reduce((s, p) => s + getProjectValue(p), 0)
      const doneAmt        = doneProjects.reduce((s, p) => s + getProjectValue(p), 0)

      return {
        lo,
        totalLeads:  loLeads.length,
        negotiation: { count: negotiationLeads.length, amt: negotiationAmt, items: negotiationLeads },
        production:  { count: productionProjects.length, amt: productionAmt, items: productionProjects },
        done:        { count: doneProjects.length, amt: doneAmt, items: doneProjects },
      }
    }).filter(s => s.totalLeads > 0 || s.production.count > 0 || s.done.count > 0 || s.lo.status === 'active')
  }, [allLOs, projects, allProjects, leads, tasks])

  const selectedLOData = selectedLO
    ? loStats.find(s => s.lo.id === selectedLO)
    : null

  // ── Outstanding Payment — month-wise ───────────────────────────────────────
  const outstandingMonths = useMemo(() => getOutstandingByMonth(projects, tasks, 6), [projects, tasks])
  const openMonthData = openMonth ? outstandingMonths.find(m => m.key === openMonth) : null

  // Range label
  const rangeLabel = useMemo(() => {
    const fmtD = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    if (dateFilter === 'today') return `Today — ${fmtD(from)}`
    if (dateFilter === 'week')  return `${fmtD(from)} – ${fmtD(to)}`
    if (dateFilter === 'month') return from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    if (customFrom || customTo) return `${customFrom || '…'} to ${customTo || '…'}`
    return 'Select date range'
  }, [dateFilter, from, to, customFrom, customTo])

  // Cached data (loaded synchronously from localStorage on mount) already
  // covers a normal refresh — only block on the network fetch when there's
  // truly nothing to show yet (first-ever visit, empty cache).
  if (!isSupabaseReady && allProjects.length === 0 && tasks.length === 0) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pb-24 flex items-center justify-center">
        <AppHeader />
        <p className="text-sm text-slate-400 font-semibold">Loading dashboard…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <AppHeader />

      {/* Date filter */}
      <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 sticky top-14 z-20 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
            {DATE_FILTERS.map(f => (
              <button key={f.value} onClick={() => setDateFilter(f.value)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors
                  ${dateFilter === f.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowEditTargets(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 text-white text-xs font-bold active:bg-slate-700">
            <SlidersHorizontal size={12} /> Edit Targets
          </button>
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

        {/* ── 1. Orders Card ──────────────────────────────────────────────── */}
        <PerformanceCard
          colorKey="orders"
          title={dateFilter === 'custom' ? 'Orders' : `${periodWord} Orders`}
          subtitle="No. of sites moved to production"
          count={ordersMetric.count} countLabel="Sites"
          completed={ordersMetric.completed} target={periodTargets.ordersAmount}
          formatValue={formatINR}
        />

        {/* ── 2. Production Card ──────────────────────────────────────────── */}
        <PerformanceCard
          colorKey="production"
          title={dateFilter === 'custom' ? 'Production' : `${periodWord} Production`}
          subtitle="No. of sites moved to dispatch"
          count={productionMetric.count} countLabel="Sites"
          completed={productionMetric.completed} target={periodTargets.productionSqft}
          formatValue={formatSqFt}
        />

        {/* ── 3. Installation Card ────────────────────────────────────────── */}
        <PerformanceCard
          colorKey="installation"
          title={dateFilter === 'custom' ? 'Installation' : `${periodWord} Installation`}
          subtitle="No. of sites installed"
          count={installationMetric.count} countLabel="Sites"
          completed={installationMetric.completed} target={periodTargets.installationSqft}
          formatValue={formatSqFt}
        />

        {/* ── 4. Collection Card ──────────────────────────────────────────── */}
        <PerformanceCard
          colorKey="collection"
          title={dateFilter === 'custom' ? 'Collection' : `${periodWord} Collection`}
          count={0} countLabel=""
          completed={collection.total} target={periodTargets.collectionAmount}
          formatValue={formatINR}
        >
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
            {[
              { label: 'Advance Payment', amt: collection.advance },
              { label: 'Partial Payment', amt: collection.partial },
              { label: 'Final Payment',   amt: collection.final   },
            ].map(({ label, amt }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-2 text-center">
                <p className="text-xs font-extrabold text-slate-700">{formatINR(amt)}</p>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </PerformanceCard>

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

        {/* ── Sales Team Performance ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sales Team Performance</p>
            <button onClick={() => navigate('/reports')}
              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 active:text-indigo-700">
              View Full Report <ChevronRight size={12} />
            </button>
          </div>

          {/* Legend — shared across every LO's mini bar chart below */}
          {loStats.length > 0 && (
            <div className="flex items-center gap-4 mb-3 px-1">
              {(['negotiation', 'production', 'done'] as LOStage[]).map(key => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${LO_STAGE_BAR[key]}`} />
                  <span className="text-[10px] font-semibold text-slate-500">{LO_STAGE_LABEL[key]}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {loStats.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-center">
                <p className="text-sm text-slate-400">No Lead Owners found</p>
              </div>
            )}
            {loStats.map(({ lo, totalLeads, negotiation, production, done }) => {
              const bars = [
                { key: 'negotiation' as LOStage, label: 'Negotiation', amt: negotiation.amt, count: negotiation.count, unit: 'Leads'    },
                { key: 'production'  as LOStage, label: 'Production',  amt: production.amt,  count: production.count,  unit: 'Projects' },
                { key: 'done'        as LOStage, label: 'Done',        amt: done.amt,         count: done.count,       unit: 'Projects' },
              ]
              const maxAmt = Math.max(1, ...bars.map(b => b.amt))
              return (
                <button key={lo.id}
                  onClick={() => { setSelectedLO(lo.id); setSelectedLOStage('negotiation') }}
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
                        <p className="text-[11px] text-slate-400">{totalLeads} total lead{totalLeads !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <ChevronDown size={14} className="text-slate-300" />
                  </div>

                  {/* Mini bar chart — Negotiation / Production / Done, scaled to this LO's own max */}
                  <div className="flex items-end gap-3 px-1">
                    {bars.map(({ key, label, amt, count, unit }) => (
                      <div key={key}
                        onClick={e => { e.stopPropagation(); setSelectedLO(lo.id); setSelectedLOStage(key) }}
                        className="flex-1 flex flex-col items-center gap-1">
                        <p className={`text-[10px] font-extrabold ${LO_STAGE_COLOR[key]} leading-tight`}>{formatINR(amt)}</p>
                        <div className="w-full flex flex-col justify-end" style={{ height: '48px' }}>
                          <div className={`w-full rounded-t-md ${LO_STAGE_BAR[key]}`}
                            style={{ height: `${amt > 0 ? Math.max((amt / maxAmt) * 48, 6) : 2}px` }} />
                        </div>
                        <p className="text-[9px] text-slate-500 font-semibold mt-0.5">{label}</p>
                        <p className="text-[9px] text-slate-400">({count} {unit})</p>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Outstanding Payment ──────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Outstanding Payment</p>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {outstandingMonths.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No outstanding balance</p>
            ) : (
              outstandingMonths.map((m, i) => (
                <div key={m.key} className={i > 0 ? 'border-t border-slate-100' : ''}>
                  <button onClick={() => setOpenMonth(openMonth === m.key ? null : m.key)}
                    className="w-full flex items-center justify-between px-4 py-3 active:bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">{m.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-amber-600">{formatINR(m.amount)}</span>
                      <ChevronDown size={13} className={`text-slate-300 transition-transform ${openMonth === m.key ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {openMonth === m.key && (
                    <div className="px-4 pb-3 space-y-2 bg-slate-50">
                      {m.projects.map(p => {
                        const paid    = getTotalPaid(p.id, tasks)
                        const balance = getBalanceAmount(p, tasks)
                        return (
                          <button key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-left active:bg-slate-50">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                              <p className="text-xs font-extrabold text-amber-600 flex-shrink-0">{formatINR(balance)}</p>
                            </div>
                            <p className="text-[10px] text-slate-400 mb-1.5">{p.client} · {p.ownerName ?? '—'}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              <span>Value: <span className="font-semibold text-slate-600">{formatINR(getProjectValue(p))}</span></span>
                              <span>Paid: <span className="font-semibold text-slate-600">{formatINR(paid)}</span></span>
                              <span>Due: <span className="font-semibold text-slate-600">{p.dueDate && p.dueDate !== '—' ? p.dueDate : '—'}</span></span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* LO Detail Panel (full-screen overlay) */}
      {selectedLOData && (
        <LOPanel
          loName={selectedLOData.lo.fullName}
          negotiationLeads={selectedLOData.negotiation.items}
          productionProjects={selectedLOData.production.items}
          doneProjects={selectedLOData.done.items}
          allProjects={allProjects}
          initialStage={selectedLOStage}
          onClose={() => setSelectedLO(null)}
        />
      )}

      {/* Edit Targets modal */}
      {showEditTargets && (
        <EditTargetsModal
          targets={targets}
          onClose={() => setShowEditTargets(false)}
          onSaved={t => { setTargets(t); setShowEditTargets(false) }}
        />
      )}
    </div>
  )
}
