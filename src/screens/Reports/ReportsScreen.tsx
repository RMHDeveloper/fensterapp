import { useMemo, useState } from 'react'
import { Calendar, BarChart3, TrendingUp, TrendingDown, IndianRupee, FolderOpen, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import { getLeadFlowBucket, isLeadConverted, isCompletedProject } from '../../utils/stageHelpers'
import { type DateFilter, DATE_FILTERS, getDateRange, inRange, leadDate } from '../../utils/dateRange'
import { getMonthlyRevenue, getBalanceAmount, formatINR } from '../../utils/dashboardMetrics'
import type { LeadSource } from '../../types'

const LEAD_SOURCE_ORDER: { value: LeadSource; label: string }[] = [
  { value: 'existing_customer', label: 'Existing Customer' },
  { value: 'instagram',         label: 'Instagram'         },
  { value: 'facebook',          label: 'Facebook'          },
  { value: 'whatsapp',          label: 'WhatsApp'          },
  { value: 'google',            label: 'Google'            },
  { value: 'walk_in',           label: 'Walk-in'           },
  { value: 'client_ref',        label: 'Client Reference'  },
  { value: 'cold_call',         label: 'Cold Call'         },
  { value: 'cni',               label: 'CNI'               },
  { value: 'bni',               label: 'BNI'               },
  { value: 'referral',          label: 'Referral'          },
  { value: 'online',            label: 'Online'            },
  { value: 'md_ref',            label: 'MD Reference'      },
  { value: 'ed_ref',            label: 'ED Reference'      },
  { value: 'other',             label: 'Other'             },
]

export default function ReportsScreen() {
  const { leads, projects, tasks, mistakes, isSupabaseReady, syncError } = useAppData()

  // Real revenue collected per month, for the 6 months ending this month —
  // computed from actual payment events on task statusHistory (the real
  // system of record — the separate `payments` collection isn't written to
  // by the advance/partial/final payment flows and is stale/unmaintained).
  const BAR_DATA = useMemo(() => getMonthlyRevenue(tasks, 6), [tasks])

  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const { from, to } = useMemo(
    () => getDateRange(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo]
  )

  // Date-sorted leads/projects — everything below derives from these, not the full unfiltered set
  const filteredLeads = useMemo(() => leads.filter(l => inRange(leadDate(l), from, to)), [leads, from, to])
  const filteredProjects = useMemo(
    () => projects.filter(p => inRange(p.createdAt, from, to)),
    [projects, from, to]
  )

  // Revenue collected — sum of every task's actual paidAmount (one evolving
  // task per project, so this is the true cumulative collected across all
  // projects). Outstanding — sum of each project's real balance (project
  // value minus paid), same rule the MD Dashboard's Outstanding card uses.
  const totalRevenue      = tasks.reduce((s, t) => s + (t.paidAmount ?? 0), 0)
  const totalOutstanding  = projects.reduce((s, p) => s + getBalanceAmount(p, tasks), 0)
  const activeProjects    = filteredProjects.filter(p => !isCompletedProject(p)).length
  const completedProjects = filteredProjects.filter(isCompletedProject).length
  const openMistakes      = mistakes.filter(m => m.status !== 'resolved').length
  const wonLeads          = filteredLeads.filter(isLeadConverted).length

  const maxBar = Math.max(1, ...BAR_DATA.map(b => b.value))

  const kpiCards = [
    { label: 'Revenue Collected', value: `₹${(totalRevenue / 100000).toFixed(1)}L`, sub: 'In selected period', icon: IndianRupee, color: 'bg-emerald-50 text-emerald-700', trend: 'up' },
    { label: 'Outstanding',       value: `₹${(totalOutstanding / 100000).toFixed(1)}L`, sub: 'Pending collection', icon: TrendingDown, color: 'bg-red-50 text-red-600', trend: 'down' },
    { label: 'Active Projects',   value: activeProjects.toString(), sub: `${completedProjects} completed`, icon: FolderOpen, color: 'bg-indigo-50 text-indigo-700', trend: 'neutral' },
    { label: 'Open Mistakes',     value: openMistakes.toString(), sub: 'Needs attention', icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', trend: 'down' },
    { label: 'Leads Converted',   value: wonLeads.toString(), sub: `of ${filteredLeads.length} in period`, icon: CheckCircle2, color: 'bg-teal-50 text-teal-700', trend: 'up' },
    { label: 'Conversion Rate',   value: filteredLeads.length > 0 ? `${Math.round((wonLeads / filteredLeads.length) * 100)}%` : '0%', sub: 'Leads to orders', icon: TrendingUp, color: 'bg-violet-50 text-violet-700', trend: 'up' },
  ]

  // Lead Source Conversion — real data from leads/projects, no hardcoded sample values
  const leadSourceRows = LEAD_SOURCE_ORDER.map(({ value, label }) => {
    const sourceLeads = filteredLeads.filter(l => l.source === value)
    const total = sourceLeads.length
    const contacted = sourceLeads.filter(l => l.status !== 'new').length
    const measurement = sourceLeads.filter(l => {
      if (isLeadConverted(l)) return true
      const bucket = getLeadFlowBucket(l, projects, tasks)
      return bucket === 'measurement' || bucket === 'quotation' || bucket === 'negotiation'
    }).length
    const quotation = sourceLeads.filter(l => {
      if (isLeadConverted(l)) return true
      const bucket = getLeadFlowBucket(l, projects, tasks)
      return bucket === 'quotation' || bucket === 'negotiation'
    }).length
    const converted = sourceLeads.filter(isLeadConverted)
    const convertedCount = converted.length
    const conversionPct = total > 0 ? (convertedCount / total) * 100 : 0
    const totalValue = converted.reduce((s, l) => {
      const proj = projects.find(p => p.leadId === l.id)
      return s + (proj ? (proj.costBreakdown?.quotationAmount ?? proj.quotationAmount ?? proj.value ?? 0) : 0)
    }, 0)
    return { label, total, contacted, measurement, quotation, convertedCount, conversionPct, totalValue }
  }).filter(r => r.total > 0)

  // Cached data (loaded synchronously from localStorage on mount) already
  // covers a normal refresh — only block when there's truly nothing cached.
  if (!isSupabaseReady && projects.length === 0 && leads.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 flex items-center justify-center">
        <p className="text-sm text-slate-400 font-semibold">Loading dashboard…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {syncError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
          <p className="text-[11px] font-semibold text-amber-700">Couldn't refresh from the server — showing last saved data.</p>
        </div>
      )}
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Reports</h1>
              <p className="text-xs text-slate-500">Business performance overview</p>
            </div>
          </div>
          <BarChart3 size={24} className="text-indigo-500" />
        </div>
      </div>

      {/* Date filter */}
      <div className="px-4 pt-4 space-y-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {DATE_FILTERS.map(f => (
            <button key={f.value} onClick={() => setDateFilter(f.value)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${dateFilter === f.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-100 text-slate-600'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 py-1">
            <Calendar size={13} className="text-slate-400 flex-shrink-0" />
            <input type="date" value={customFrom} max={customTo || undefined}
              onChange={e => setCustomFrom(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400" />
            <span className="text-xs text-slate-400 font-semibold flex-shrink-0">to</span>
            <input type="date" value={customTo} min={customFrom || undefined}
              onChange={e => setCustomTo(e.target.value)}
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-indigo-400" />
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {kpiCards.map(({ label, value, sub, icon: Icon, color, trend }) => (
            <div key={label} className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${color}`}>
                <Icon size={16} />
              </div>
              <p className="text-xl font-extrabold text-slate-800">{value}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{label}</p>
              <div className="flex items-center gap-1 mt-1">
                {trend === 'up' && <TrendingUp size={10} className="text-emerald-500" />}
                {trend === 'down' && <TrendingDown size={10} className="text-red-500" />}
                <p className={`text-[10px] ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400'}`}>{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Bar Chart */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-700">Monthly Revenue</p>
            <p className="text-[11px] text-slate-400">Last 6 months</p>
          </div>
          <div className="flex items-end gap-2 h-32">
            {BAR_DATA.map(({ month, value }) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '100px' }}>
                  <div className="w-full bg-indigo-500 rounded-t-md transition-all"
                    style={{ height: `${(value / maxBar) * 90}px` }}>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 font-medium">{month}</p>
                <p className="text-[9px] font-bold text-slate-600">{formatINR(value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Source Conversion */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
          <p className="text-sm font-bold text-slate-700 mb-4">Lead Source Conversion</p>
          {leadSourceRows.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No leads yet</p>
          ) : (
            <div className="space-y-3">
              {leadSourceRows.map(({ label, total, contacted, measurement, quotation, convertedCount, conversionPct, totalValue }) => (
                <div key={label} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">{label}</span>
                    <span className="text-xs font-extrabold text-emerald-600">{conversionPct.toFixed(0)}%</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {[
                      { l: 'Leads',       v: total },
                      { l: 'Contacted',   v: contacted },
                      { l: 'Measure.',    v: measurement },
                      { l: 'Quotation',   v: quotation },
                      { l: 'Converted',   v: convertedCount },
                    ].map(({ l, v }) => (
                      <div key={l} className="bg-slate-50 rounded-lg py-1.5">
                        <p className="text-xs font-extrabold text-slate-700">{v}</p>
                        <p className="text-[9px] text-slate-400">{l}</p>
                      </div>
                    ))}
                  </div>
                  {totalValue > 0 && (
                    <p className="text-[11px] text-slate-400 mt-2">Converted project value: <span className="font-semibold text-slate-600">₹{totalValue.toLocaleString('en-IN')}</span></p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Pipeline */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">Lead Pipeline</p>
          <div className="space-y-2">
            {[
              { label: 'New Leads',    value: filteredLeads.filter(l => l.status === 'new').length,       color: 'bg-slate-400' },
              { label: 'Contacted',    value: filteredLeads.filter(l => l.status === 'contacted').length, color: 'bg-blue-400' },
              { label: 'Qualified',    value: filteredLeads.filter(l => l.status === 'qualified').length, color: 'bg-indigo-400' },
              { label: 'Proposal Sent',value: filteredLeads.filter(l => l.status === 'proposal').length,  color: 'bg-violet-500' },
              { label: 'Converted',    value: filteredLeads.filter(isLeadConverted).length,                color: 'bg-emerald-500' },
              { label: 'Lost',         value: filteredLeads.filter(l => l.status === 'lost').length,      color: 'bg-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 w-24 flex-shrink-0">{label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className={`h-full rounded-lg flex items-center px-2 ${color}`} style={{ width: `${filteredLeads.length > 0 ? Math.max((value / filteredLeads.length) * 100, 8) : 0}%` }}>
                    <span className="text-[9px] font-bold text-white">{value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export */}
        <button className="w-full border-2 border-dashed border-indigo-200 rounded-2xl py-4 flex items-center justify-center gap-2 text-indigo-600 font-semibold text-sm active:bg-indigo-50">
          <BarChart3 size={16} /> Export Report (PDF)
        </button>
      </div>
    </div>
  )
}
