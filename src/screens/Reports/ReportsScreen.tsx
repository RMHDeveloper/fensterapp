import { useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown, IndianRupee, FolderOpen, CheckCircle2, AlertTriangle } from 'lucide-react'
import { PROJECTS, MISTAKES } from '../../data/mockData'
import { useAppData } from '../../context/AppDataContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'

type Period = 'this_month' | 'last_month' | 'quarter' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  this_month:  'This Month',
  last_month:  'Last Month',
  quarter:     'Quarter',
  year:        'This Year',
}

const BAR_DATA = [
  { month: 'Jan', value: 42 },
  { month: 'Feb', value: 58 },
  { month: 'Mar', value: 51 },
  { month: 'Apr', value: 73 },
  { month: 'May', value: 65 },
  { month: 'Jun', value: 89 },
]

export default function ReportsScreen() {
  const { payments, leads } = useAppData()
  const [period, setPeriod] = useState<Period>('this_month')

  const totalRevenue      = payments.reduce((s, p) => s + p.received, 0)
  const totalOutstanding  = payments.reduce((s, p) => s + p.pending, 0)
  const activeProjects    = PROJECTS.filter(p => p.status === 'active').length
  const completedProjects = PROJECTS.filter(p => p.status === 'completed').length
  const openMistakes      = MISTAKES.filter(m => m.status !== 'resolved').length
  const wonLeads          = leads.filter(l => l.status === 'won').length

  const maxBar = Math.max(...BAR_DATA.map(b => b.value))

  const kpiCards = [
    { label: 'Revenue Collected', value: `₹${(totalRevenue / 100000).toFixed(1)}L`, sub: '+12% vs last month', icon: IndianRupee, color: 'bg-emerald-50 text-emerald-700', trend: 'up' },
    { label: 'Outstanding',       value: `₹${(totalOutstanding / 100000).toFixed(1)}L`, sub: '3 overdue', icon: TrendingDown, color: 'bg-red-50 text-red-600', trend: 'down' },
    { label: 'Active Projects',   value: activeProjects.toString(), sub: `${completedProjects} completed`, icon: FolderOpen, color: 'bg-indigo-50 text-indigo-700', trend: 'neutral' },
    { label: 'Open Mistakes',     value: openMistakes.toString(), sub: 'Needs attention', icon: AlertTriangle, color: 'bg-amber-50 text-amber-700', trend: 'down' },
    { label: 'Leads Won',         value: wonLeads.toString(), sub: `of ${leads.length} total`, icon: CheckCircle2, color: 'bg-teal-50 text-teal-700', trend: 'up' },
    { label: 'Conversion Rate',   value: `${Math.round((wonLeads / leads.length) * 100)}%`, sub: 'Leads to orders', icon: TrendingUp, color: 'bg-violet-50 text-violet-700', trend: 'up' },
  ]

  const productBreakdown = [
    { label: 'UPVC Windows', percent: 45, color: 'bg-indigo-500' },
    { label: 'UPVC Doors',   percent: 28, color: 'bg-teal-500'   },
    { label: 'Aluminium',    percent: 18, color: 'bg-amber-500'  },
    { label: 'Glass Work',   percent: 9,  color: 'bg-violet-500' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
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

      {/* Period selector */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-1 flex gap-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-semibold transition-colors ${period === p ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
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
            <p className="text-sm font-bold text-slate-700">Monthly Revenue (₹L)</p>
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
                <p className="text-[9px] font-bold text-slate-600">{value}K</p>
              </div>
            ))}
          </div>
        </div>

        {/* Product Breakdown */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
          <p className="text-sm font-bold text-slate-700 mb-4">Product Mix</p>
          <div className="space-y-3">
            {productBreakdown.map(({ label, percent, color }) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600">{label}</span>
                  <span className="text-xs font-bold text-slate-700">{percent}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Pipeline */}
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
          <p className="text-sm font-bold text-slate-700 mb-3">Lead Pipeline</p>
          <div className="space-y-2">
            {[
              { label: 'New Leads',    value: leads.filter(l => l.status === 'new').length,       color: 'bg-slate-400' },
              { label: 'Contacted',    value: leads.filter(l => l.status === 'contacted').length, color: 'bg-blue-400' },
              { label: 'Qualified',    value: leads.filter(l => l.status === 'qualified').length, color: 'bg-indigo-400' },
              { label: 'Proposal Sent',value: leads.filter(l => l.status === 'proposal').length,  color: 'bg-violet-500' },
              { label: 'Won',          value: leads.filter(l => l.status === 'won').length,       color: 'bg-emerald-500' },
              { label: 'Lost',         value: leads.filter(l => l.status === 'lost').length,      color: 'bg-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 w-24 flex-shrink-0">{label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className={`h-full rounded-lg flex items-center px-2 ${color}`} style={{ width: `${Math.max((value / leads.length) * 100, 8)}%` }}>
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
