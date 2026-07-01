import { useState } from 'react'
import { Wrench, Plus, MapPin } from 'lucide-react'
import { INSTALLATIONS } from '../../data/mockData'
import { useAuth } from '../../context/AuthContext'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { Installation, InstallationStatus } from '../../types'

type Filter = 'all' | InstallationStatus

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all',          label: 'All'          },
  { value: 'scheduled',    label: 'Scheduled'    },
  { value: 'in_progress',  label: 'In Progress'  },
  { value: 'completed',    label: 'Completed'    },
  { value: 'rescheduled',  label: 'Rescheduled'  },
]

export default function InstallationScreen() {
  const { can } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Installation | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  const filtered = INSTALLATIONS.filter(i => filter === 'all' || i.status === filter)

  const scheduled  = INSTALLATIONS.filter(i => i.status === 'scheduled' || i.status === 'in_progress').length
  const completed  = INSTALLATIONS.filter(i => i.status === 'completed').length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Installation</h1>
              <p className="text-xs text-slate-500">{scheduled} upcoming · {completed} completed</p>
            </div>
          </div>
          <button onClick={() => setShowNew(true)}
            className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-fab active:bg-indigo-700">
            <Plus size={19} className="text-white" strokeWidth={2.5} />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CHIPS.map(c => (
            <button key={c.value} onClick={() => setFilter(c.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === c.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-2.5">
        {filtered.map(install => (
          <button key={install.id} onClick={() => setSelected(install)}
            className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 active:scale-[0.98] transition-transform">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate">{install.projectName}</h3>
                <p className="text-xs text-slate-500">{install.clientName}</p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400">
                  <MapPin size={10} />
                  <span className="truncate">{install.address}</span>
                </div>
              </div>
              <StatusBadge status={install.status} size="xs" />
            </div>

            <div className="flex items-center gap-3 mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              <Wrench size={11} />
              <span>📅 {install.scheduledDate}</span>
              <span>⏰ {install.scheduledTime}</span>
              <span className="ml-auto">👷 {install.team.join(', ')}</span>
            </div>

            {install.status === 'completed' && install.customerSignature && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5">
                <span>✓ Customer signed off</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title="Installation Details" height="full">
        {selected && (
          <div className="space-y-4">
            <StatusBadge status={selected.status} size="md" />
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Project',   value: selected.projectName },
                { label: 'Client',    value: selected.clientName },
                { label: 'Address',   value: selected.address },
                { label: 'Date',      value: selected.scheduledDate },
                { label: 'Time',      value: selected.scheduledTime },
                { label: 'Team',      value: selected.team.join(', ') },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700 text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                <p className="text-xs text-amber-600">{selected.notes}</p>
              </div>
            )}

            {selected.status === 'scheduled' && can('update_installation') && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Installation started!' }) }}
                  className="bg-amber-500 text-white rounded-xl py-3 text-sm font-bold active:bg-amber-600">
                  Start Installation
                </button>
                <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Installation rescheduled.' }) }}
                  className="border border-slate-300 text-slate-600 rounded-xl py-3 text-sm font-semibold active:bg-slate-50">
                  Reschedule
                </button>
              </div>
            )}
            {selected.status === 'in_progress' && can('update_installation') && (
              <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Installation completed! 🎉' }) }}
                className="w-full bg-emerald-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-emerald-700">
                Mark Completed ✓
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Schedule Sheet */}
      <BottomSheet isOpen={showNew} onClose={() => setShowNew(false)} title="Schedule Installation" height="full">
        <div className="space-y-4">
          {[
            { label: 'Project *', placeholder: 'Select project' },
            { label: 'Site Address *', placeholder: 'Full installation address' },
          ].map(({ label, placeholder }) => (
            <div key={label}>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">{label}</label>
              <input placeholder={placeholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Date</label>
              <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Time</label>
              <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Team Members</label>
            <input placeholder="e.g. Ravi K, Kumar M"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes</label>
            <textarea rows={3} placeholder="Special instructions…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <button onClick={() => { setShowNew(false); setSnack({ open: true, msg: 'Installation scheduled!' }) }}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700">
            Schedule Installation
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
