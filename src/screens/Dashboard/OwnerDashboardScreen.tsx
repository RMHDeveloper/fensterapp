import { useState, useMemo, useRef } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { Calendar } from 'lucide-react'

type DateFilter = 'today' | 'week' | 'month' | 'custom'

function getDateRange(filter: DateFilter, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (filter === 'today') return { from: todayStart, to: todayEnd }

  if (filter === 'week') {
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1  // Monday = 0
    const weekStart = new Date(todayStart)
    weekStart.setDate(todayStart.getDate() - diff)
    return { from: weekStart, to: todayEnd }
  }

  if (filter === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return { from: monthStart, to: todayEnd }
  }

  // custom
  const from = customFrom ? new Date(customFrom + 'T00:00:00') : todayStart
  const to   = customTo   ? new Date(customTo   + 'T23:59:59') : todayEnd
  return { from, to }
}

function inRange(dateStr: string | undefined, from: Date, to: Date): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= from && d <= to
}

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'today',  label: 'Today'      },
  { value: 'week',   label: 'This Week'  },
  { value: 'month',  label: 'This Month' },
  { value: 'custom', label: 'Custom'     },
]

export default function OwnerDashboardScreen() {
  const { projects, tasks, mistakes } = useAppData()
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const { from, to } = useMemo(
    () => getDateRange(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo]
  )

  // Filter projects created within range
  const filteredProjects = useMemo(
    () => projects.filter(p => inRange(p.createdAt, from, to)),
    [projects, from, to]
  )

  // Build set of filtered project IDs for task lookup
  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map(p => p.id)),
    [filteredProjects]
  )

  // Tasks belonging to filtered projects (for payment data)
  const filteredTasks = useMemo(
    () => tasks.filter(t => t.projectId && filteredProjectIds.has(t.projectId)),
    [tasks, filteredProjectIds]
  )

  // Filter mistakes within range
  const filteredMistakes = useMemo(
    () => mistakes.filter(m => inRange((m as { createdAt?: string }).createdAt, from, to)),
    [mistakes, from, to]
  )

  const CLIENT_APPROVED_STAGES = new Set([
    'client_approved', 'advance_payment', 'production_admin_check',
    'waiting_material_availability', 'production_manager_work',
    'ready_to_dispatch', 'installation', 'installation_assigned',
    'final_payment', 'completed',
  ])

  // ── Project Overview ──────────────────────────────────────────────────────
  const totalProjects  = filteredProjects.filter(p => !p.isCompleted && p.currentStage !== 'completed').length
  const totalArea      = filteredProjects.reduce((s, p) => s + (p.costBreakdown?.numberOfSqft ?? 0), 0)
  const proposedAmount = filteredProjects
    .filter(p => p.currentStage && CLIENT_APPROVED_STAGES.has(p.currentStage))
    .reduce((s, p) => s + (p.costBreakdown?.quotationAmount ?? p.value ?? 0), 0)

  // ── Production Overview ───────────────────────────────────────────────────
  const movedToProductionStages = new Set([
    'production_admin_check','waiting_material_availability',
    'production_manager_work','ready_to_dispatch',
    'installation','installation_assigned','final_payment','completed'
  ])
  const productionMoved  = filteredProjects.filter(p => p.currentStage && movedToProductionStages.has(p.currentStage)).length
  const producedAreaStages = new Set(['production_manager_work','ready_to_dispatch','installation','installation_assigned','final_payment','completed'])
  const producedArea     = filteredProjects
    .filter(p => p.currentStage && producedAreaStages.has(p.currentStage ?? ''))
    .reduce((s, p) => s + (p.costBreakdown?.numberOfSqft ?? 0), 0)
  const productionValue = filteredProjects
    .filter(p => p.currentStage && movedToProductionStages.has(p.currentStage ?? ''))
    .reduce((s, p) => {
      const cb = p.costBreakdown
      if (!cb) return s
      return s + (cb.materialCost ?? 0) + (cb.productionCost ?? 0) + (cb.installationCost ?? 0) + (cb.transportCost ?? 0)
    }, 0)
  const completedCount = filteredProjects.filter(p => p.isCompleted || p.currentStage === 'completed').length

  // ── Payment Summary ───────────────────────────────────────────────────────
  const totalClientAmount = filteredProjects
    .filter(p => p.currentStage && CLIENT_APPROVED_STAGES.has(p.currentStage))
    .reduce((s, p) => s + (p.costBreakdown?.quotationAmount ?? p.value ?? 0), 0)
  const totalPaid    = filteredTasks.reduce((s, t) => s + (t.paidAmount ?? 0), 0)
  const pendingAmount = Math.max(0, totalClientAmount - totalPaid)
  const fullyPaidAmt = filteredProjects
    .filter(p => p.isCompleted || p.currentStage === 'completed')
    .reduce((s, p) => s + (p.costBreakdown?.quotationAmount ?? p.value ?? 0), 0)

  // ── Stage Counts ──────────────────────────────────────────────────────────
  const stageCounts = {
    measurement:  filteredProjects.filter(p => ['measurement','site_visit_assigned','site_visit_completed','quotation_preparation'].includes(p.currentStage ?? '')).length,
    quotation:    filteredProjects.filter(p => ['quotation_sent_owner','owner_approved','sent_to_client'].includes(p.currentStage ?? '')).length,
    production:   filteredProjects.filter(p => ['production_admin_check','production_manager_work','ready_to_dispatch'].includes(p.currentStage ?? '')).length,
    installation: filteredProjects.filter(p => ['installation','installation_assigned'].includes(p.currentStage ?? '')).length,
    payment:      filteredProjects.filter(p => ['final_payment','partial_paid'].includes(p.currentStage ?? '')).length,
    completed:    filteredProjects.filter(p => p.isCompleted || p.currentStage === 'completed').length,
  }

  const openMistakes = filteredMistakes.filter(m => (m as { status?: string }).status === 'open').length

  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
    n >= 1000   ? `₹${(n / 1000).toFixed(0)}K`   : `₹${n}`

  // Label for current range
  const rangeLabel = useMemo(() => {
    const fmtD = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    if (dateFilter === 'today') return `Today — ${fmtD(from)}`
    if (dateFilter === 'week')  return `${fmtD(from)} – ${fmtD(to)}`
    if (dateFilter === 'month') return `${from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
    if (customFrom || customTo) return `${customFrom || '…'} to ${customTo || '…'}`
    return 'Select date range'
  }, [dateFilter, from, to, customFrom, customTo])

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <AppHeader />

      {/* Date filter chips */}
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

        {/* Custom date pickers */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 py-1">
            <Calendar size={13} className="text-slate-400 flex-shrink-0" />
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={e => setCustomFrom(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-400"
            />
            <span className="text-xs text-slate-400 font-semibold flex-shrink-0">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={e => setCustomTo(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-400"
            />
          </div>
        )}

        {/* Current range label */}
        <p className="text-[10px] text-slate-400 font-semibold pb-1">{rangeLabel}</p>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* No data notice */}
        {totalProjects === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-6 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm font-semibold text-slate-600">No projects in this period</p>
            <p className="text-xs text-slate-400 mt-1">Try a different date range</p>
          </div>
        )}

        {/* Project Overview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Project Overview</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Projects',    value: String(totalProjects),                    color: 'text-blue-600'   },
              { label: 'Total Area (sqft)', value: totalArea > 0 ? String(totalArea) : '—', color: 'text-teal-600'   },
              { label: 'Proposed Amount',   value: fmt(proposedAmount),                      color: 'text-violet-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Production Overview */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Production Overview</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Moved to Production', value: String(productionMoved),                         color: 'text-amber-600'  },
              { label: 'Produced Area',        value: producedArea > 0 ? `${producedArea} sqft` : '—',color: 'text-orange-600' },
              { label: 'Production Value',     value: fmt(productionValue),                            color: 'text-emerald-600'},
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={`text-lg font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center justify-between mt-2">
            <p className="text-xs text-emerald-600 font-semibold">Projects Completed</p>
            <p className="text-lg font-extrabold text-emerald-700">{completedCount}</p>
          </div>
        </div>

        {/* Payment Cards */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Payment Summary</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Payment Collected',  value: fmt(totalPaid),         bg: 'bg-emerald-50', border: 'border-emerald-200', color: 'text-emerald-700' },
              { label: 'Pending Amount',     value: fmt(pendingAmount),     bg: 'bg-amber-50',   border: 'border-amber-200',   color: 'text-amber-700'   },
              { label: 'Total Client Amt',   value: fmt(totalClientAmount), bg: 'bg-blue-50',    border: 'border-blue-200',    color: 'text-blue-700'    },
              { label: 'Fully Paid',         value: fmt(fullyPaidAmt),      bg: 'bg-green-50',   border: 'border-green-200',   color: 'text-green-700'   },
            ].map(({ label, value, bg, border, color }) => (
              <div key={label} className={`${bg} border ${border} rounded-2xl p-4`}>
                <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                <p className="text-[11px] text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Project Status */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Project Status</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Measurement', value: stageCounts.measurement,  color: 'text-cyan-700',   bg: 'bg-cyan-50   border-cyan-200'   },
              { label: 'Quotation',   value: stageCounts.quotation,    color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
              { label: 'Production',  value: stageCounts.production,   color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200'  },
              { label: 'Installation',value: stageCounts.installation, color: 'text-rose-700',   bg: 'bg-rose-50   border-rose-200'   },
              { label: 'Payment',     value: stageCounts.payment,      color: 'text-green-700',  bg: 'bg-green-50  border-green-200'  },
              { label: 'Completed',   value: stageCounts.completed,    color: 'text-slate-700',  bg: 'bg-slate-50  border-slate-200'  },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`border rounded-2xl p-3 text-center ${bg}`}>
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Efficiency */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Operational Efficiency</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">On-time Delivery</p>
                <p className="text-xs text-slate-500 mt-0.5">Projects delivered within expected date</p>
              </div>
              <p className="text-2xl font-extrabold text-emerald-600">94%</p>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }} />
            </div>
            <p className="text-xs text-slate-500 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              Overall project turnaround time has improved by 15% this month.
            </p>
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
    </div>
  )
}
