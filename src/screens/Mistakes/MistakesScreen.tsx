import { useState } from 'react'
import { AlertTriangle, Plus, User } from 'lucide-react'
import { MISTAKES } from '../../data/mockData'
import { useAuth } from '../../context/AuthContext'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { PriorityBadge } from '../../components/badges/PriorityBadge'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { Mistake, MistakeStatus } from '../../types'

type Filter = 'all' | MistakeStatus

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all',           label: 'All'           },
  { value: 'open',          label: 'Open'          },
  { value: 'in_progress',   label: 'In Progress'   },
  { value: 'rework',        label: 'Rework'        },
  { value: 'resolved',      label: 'Resolved'      },
]

const CATEGORY_ICON: Record<string, string> = {
  measurement: '📐', glass: '🪟', hardware: '🔩', finishing: '🎨', delivery: '🚚', design: '📋',
}

export default function MistakesScreen() {
  const { can } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Mistake | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  const filtered = MISTAKES.filter(m => filter === 'all' || m.status === filter)

  const open   = MISTAKES.filter(m => m.status === 'open' || m.status === 'in_progress').length
  const rework = MISTAKES.filter(m => m.status === 'rework').length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Mistakes</h1>
              <p className="text-xs text-slate-500">{MISTAKES.length} total · {open} open · {rework} rework</p>
            </div>
          </div>
          {can('create_mistake') && (
            <button onClick={() => setShowNew(true)}
              className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center shadow-fab active:bg-red-600">
              <Plus size={19} className="text-white" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Alert banner */}
        {open > 0 && (
          <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2.5 mb-3 border border-red-100">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-red-600">{open} open issue{open > 1 ? 's' : ''} need attention</p>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CHIPS.map(c => (
            <button key={c.value} onClick={() => setFilter(c.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === c.value ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-2.5">
        {filtered.map(m => (
          <button key={m.id} onClick={() => setSelected(m)}
            className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 active:scale-[0.98] transition-transform">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{CATEGORY_ICON[m.category] ?? '⚠️'}</span>
                  <span className="text-[11px] font-semibold text-slate-500 capitalize">{m.category}</span>
                  <PriorityBadge priority={m.priority} showLabel={false} />
                </div>
                <h3 className="text-sm font-bold text-slate-800 truncate">{m.title}</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{m.projectName}</p>
              </div>
              <StatusBadge status={m.status} size="xs" />
            </div>
            <p className="text-xs text-slate-400 mt-2 line-clamp-2">{m.description}</p>
            <div className="flex items-center gap-3 mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              <span>📅 {m.reportedAt}</span>
              <span className="flex items-center gap-1">
                <User size={10} /> {m.reportedBy}
              </span>
              {m.assignedTo && <span className="ml-auto text-indigo-600 font-medium">→ {m.assignedTo}</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title="Mistake Detail" height="full">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selected.status} size="md" />
              <PriorityBadge priority={selected.priority} size="md" />
              <span className="text-xs text-slate-400 capitalize">{selected.category}</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">{selected.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{selected.description}</p>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Project',    value: selected.projectName },
                { label: 'Reported by',value: selected.reportedBy },
                { label: 'Assigned to',value: selected.assignedTo ?? '—' },
                { label: 'Date',       value: selected.reportedAt },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>

            {selected.status !== 'resolved' && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Rework assigned!' }) }}
                  className="bg-amber-500 text-white rounded-xl py-3 text-sm font-bold active:bg-amber-600">
                  Mark Rework
                </button>
                <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Mistake resolved!' }) }}
                  className="bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold active:bg-emerald-700">
                  Mark Resolved
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* New Mistake Sheet */}
      <BottomSheet isOpen={showNew} onClose={() => setShowNew(false)} title="Log Mistake" height="full">
        <div className="space-y-4">
          {[
            { label: 'Project *', placeholder: 'Select project' },
            { label: 'Title *', placeholder: 'Short description of the issue' },
          ].map(({ label, placeholder }) => (
            <div key={label}>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">{label}</label>
              <input placeholder={placeholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Category</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
              {Object.keys(CATEGORY_ICON).map(c => (
                <option key={c} value={c}>{CATEGORY_ICON[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Priority</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Assign To</label>
              <input placeholder="Team member" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Full Description</label>
            <textarea rows={4} placeholder="Describe the issue in detail…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 resize-none" />
          </div>
          <button onClick={() => { setShowNew(false); setSnack({ open: true, msg: 'Mistake logged and team notified!' }) }}
            className="w-full bg-red-500 text-white rounded-xl py-3.5 text-sm font-bold active:bg-red-600">
            Log Mistake
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
