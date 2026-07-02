import { useState } from 'react'
import { AlertTriangle, Plus, User, ChevronDown } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { PriorityBadge } from '../../components/badges/PriorityBadge'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import { loadManagedUsers } from '../../utils/userStorage'
import type { Mistake, MistakeStatus, Priority } from '../../types'

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

const SEND_TO_ROLES = [
  { value: 'site_engineer',      label: 'Site Engineer'      },
  { value: 'production_manager', label: 'Production Manager' },
  { value: 'production_admin',   label: 'Production Admin'   },
  { value: 'technician',         label: 'Technician'         },
]

const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400'

export default function MistakesScreen() {
  const { mistakes, updateMistake, addMistake, projects } = useAppData()
  const { user, can } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Mistake | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  // Detail sheet action state
  const [sendToRole, setSendToRole]     = useState('')
  const [whoMadeIt, setWhoMadeIt]       = useState('')
  const [extraCostVal, setExtraCostVal] = useState('')
  const [showSendToRole, setShowSendToRole]   = useState(false)
  const [showWhoMadeIt, setShowWhoMadeIt]     = useState(false)

  // New mistake form
  const [fProject,  setFProject]  = useState('')
  const [fTitle,    setFTitle]    = useState('')
  const [fDesc,     setFDesc]     = useState('')
  const [fCategory, setFCategory] = useState<string>('measurement')
  const [fPriority, setFPriority] = useState<Priority>('medium')
  const [fAssign,   setFAssign]   = useState('')

  const managedUsers = loadManagedUsers().filter(u => u.status === 'active')
  const isManager    = user?.role === 'owner' || user?.role === 'lead_manager'

  const filtered = mistakes.filter(m => filter === 'all' || m.status === filter)
  const open     = mistakes.filter(m => m.status === 'open' || m.status === 'in_progress').length
  const rework   = mistakes.filter(m => m.status === 'rework').length

  function openDetail(m: Mistake) {
    setSelected(m)
    setSendToRole(m.sentToRole ?? '')
    setWhoMadeIt(m.madeBy ?? '')
    setExtraCostVal(m.extraCost != null ? String(m.extraCost) : '')
    setShowSendToRole(false)
    setShowWhoMadeIt(false)
  }

  function closeDetail() {
    setSelected(null)
  }

  function handleMarkRework() {
    if (!selected) return
    updateMistake(selected.id, { status: 'rework' })
    setSnack({ open: true, msg: 'Marked as rework!' })
    closeDetail()
  }

  function handleMarkResolved() {
    if (!selected) return
    updateMistake(selected.id, { status: 'resolved', resolvedAt: new Date().toISOString().slice(0, 10) })
    setSnack({ open: true, msg: 'Mistake resolved!' })
    closeDetail()
  }

  function handleSendToRole() {
    if (!selected || !sendToRole) return
    updateMistake(selected.id, { sentToRole: sendToRole, status: 'in_progress' })
    setSnack({ open: true, msg: `Sent to ${SEND_TO_ROLES.find(r => r.value === sendToRole)?.label ?? sendToRole}!` })
    closeDetail()
  }

  function handleSaveWhoMadeIt() {
    if (!selected || !whoMadeIt) return
    const mu = managedUsers.find(u => u.fullName === whoMadeIt || u.id === whoMadeIt)
    updateMistake(selected.id, { madeBy: mu?.fullName ?? whoMadeIt, madeByRole: mu?.role ?? '' })
    setShowWhoMadeIt(false)
    setSnack({ open: true, msg: 'Responsibility recorded!' })
  }

  function handleSaveExtraCost() {
    if (!selected) return
    const cost = parseFloat(extraCostVal)
    if (isNaN(cost) || cost < 0) return
    updateMistake(selected.id, { extraCost: cost })
    setSnack({ open: true, msg: 'Extra cost saved!' })
  }

  function handleCreate() {
    if (!fTitle.trim()) return
    addMistake({
      projectId:   fProject || 'unknown',
      projectName: projects.find(p => p.id === fProject)?.name ?? fProject,
      category:    fCategory as Mistake['category'],
      title:       fTitle.trim(),
      description: fDesc.trim(),
      priority:    fPriority,
      status:      'open',
      reportedBy:  user?.name ?? 'Unknown',
      assignedTo:  fAssign || undefined,
      reportedAt:  new Date().toISOString().slice(0, 10),
    })
    setShowNew(false)
    setFProject(''); setFTitle(''); setFDesc(''); setFCategory('measurement'); setFPriority('medium'); setFAssign('')
    setSnack({ open: true, msg: 'Mistake logged and team notified!' })
  }

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
              <p className="text-xs text-slate-500">{mistakes.length} total · {open} open · {rework} rework</p>
            </div>
          </div>
          {can('create_mistake') && (
            <button onClick={() => setShowNew(true)}
              className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center shadow-fab active:bg-red-600">
              <Plus size={19} className="text-white" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {open > 0 && (
          <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2.5 mb-3 border border-red-100">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-red-600">{open} open issue{open > 1 ? 's' : ''} need attention</p>
          </div>
        )}

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
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-12">No mistakes in this category</p>
        )}
        {filtered.map(m => (
          <button key={m.id} onClick={() => openDetail(m)}
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
              <span className="flex items-center gap-1"><User size={10} /> {m.reportedBy}</span>
              {m.madeBy && <span className="text-red-500 font-semibold">By: {m.madeBy}</span>}
              {m.extraCost && m.extraCost > 0 ? <span className="ml-auto text-red-500 font-bold">+₹{m.extraCost.toLocaleString('en-IN')}</span> : null}
              {!m.extraCost && m.assignedTo && <span className="ml-auto text-indigo-600 font-medium">→ {m.assignedTo}</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={closeDetail} title="Mistake Detail" height="full">
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
                { label: 'Project',     value: selected.projectName },
                { label: 'Reported by', value: selected.reportedBy  },
                { label: 'Assigned to', value: selected.assignedTo ?? '—' },
                { label: 'Date',        value: selected.reportedAt  },
                ...(selected.madeBy      ? [{ label: 'Made by',   value: `${selected.madeBy}${selected.madeByRole ? ` (${selected.madeByRole.replace(/_/g,' ')})` : ''}` }] : []),
                ...(selected.sentToRole  ? [{ label: 'Sent to',   value: SEND_TO_ROLES.find(r => r.value === selected.sentToRole)?.label ?? selected.sentToRole }] : []),
                ...(selected.extraCost != null && selected.extraCost > 0 ? [{ label: 'Extra Cost', value: `₹${selected.extraCost.toLocaleString('en-IN')}` }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className={`text-xs font-semibold ${label === 'Extra Cost' ? 'text-red-600' : 'text-slate-700'}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Manager-only actions */}
            {isManager && selected.status !== 'resolved' && (
              <div className="space-y-3">
                {/* Who made this? */}
                <div>
                  <button onClick={() => setShowWhoMadeIt(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 active:bg-slate-100">
                    <span>{selected.madeBy ? `Made by: ${selected.madeBy}` : 'Who made this mistake?'}</span>
                    <ChevronDown size={14} className={`transition-transform ${showWhoMadeIt ? 'rotate-180' : ''}`} />
                  </button>
                  {showWhoMadeIt && (
                    <div className="mt-1.5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <select value={whoMadeIt} onChange={e => setWhoMadeIt(e.target.value)}
                        className="w-full px-4 py-3 text-sm bg-transparent focus:outline-none">
                        <option value="">— Select person —</option>
                        {managedUsers.map(u => (
                          <option key={u.id} value={u.fullName}>{u.fullName} ({u.displayRole ?? u.role})</option>
                        ))}
                      </select>
                      <div className="px-3 pb-3">
                        <button onClick={handleSaveWhoMadeIt} disabled={!whoMadeIt}
                          className="w-full py-2.5 rounded-xl bg-slate-700 text-white text-xs font-bold disabled:opacity-40 active:bg-slate-800">
                          Save Responsibility
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extra cost */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Extra Cost Incurred (₹)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={extraCostVal}
                      onChange={e => setExtraCostVal(e.target.value)}
                      placeholder="0"
                      className={`${inp} flex-1`}
                    />
                    <button onClick={handleSaveExtraCost} disabled={!extraCostVal}
                      className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-200 active:bg-red-100 disabled:opacity-40">
                      Save
                    </button>
                  </div>
                </div>

                {/* Send to Role */}
                <div>
                  <button onClick={() => setShowSendToRole(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-700 active:bg-indigo-100">
                    <span>{sendToRole ? `Send to: ${SEND_TO_ROLES.find(r => r.value === sendToRole)?.label}` : 'Send to Role for Rework'}</span>
                    <ChevronDown size={14} className={`transition-transform ${showSendToRole ? 'rotate-180' : ''}`} />
                  </button>
                  {showSendToRole && (
                    <div className="mt-1.5 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <select value={sendToRole} onChange={e => setSendToRole(e.target.value)}
                        className="w-full px-4 py-3 text-sm bg-transparent focus:outline-none">
                        <option value="">— Select role —</option>
                        {SEND_TO_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <div className="px-3 pb-3">
                        <button onClick={handleSendToRole} disabled={!sendToRole}
                          className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 active:bg-indigo-700">
                          Send for Rework →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mark Rework / Mark Resolved */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleMarkRework}
                    className="bg-amber-500 text-white rounded-xl py-3 text-sm font-bold active:bg-amber-600">
                    Mark Rework
                  </button>
                  <button onClick={handleMarkResolved}
                    className="bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold active:bg-emerald-700">
                    Mark Resolved
                  </button>
                </div>
              </div>
            )}

            {/* Non-manager: read-only resolved state */}
            {!isManager && selected.status !== 'resolved' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-700">Your manager will review and action this mistake.</p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* New Mistake Sheet */}
      <BottomSheet isOpen={showNew} onClose={() => setShowNew(false)} title="Log Mistake" height="full">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Project *</label>
            <select value={fProject} onChange={e => setFProject(e.target.value)} className={inp}>
              <option value="">— Select project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} · {p.client}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Title *</label>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)}
              placeholder="Short description of the issue" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Category</label>
            <select value={fCategory} onChange={e => setFCategory(e.target.value)} className={inp}>
              {Object.keys(CATEGORY_ICON).map(c => (
                <option key={c} value={c}>{CATEGORY_ICON[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Priority</label>
              <select value={fPriority} onChange={e => setFPriority(e.target.value as Priority)} className={inp}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Assign To</label>
              <select value={fAssign} onChange={e => setFAssign(e.target.value)} className={inp}>
                <option value="">— Unassigned —</option>
                {managedUsers.map(u => <option key={u.id} value={u.fullName}>{u.fullName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Full Description</label>
            <textarea rows={4} value={fDesc} onChange={e => setFDesc(e.target.value)}
              placeholder="Describe the issue in detail…"
              className={`${inp} resize-none`} />
          </div>

          <button onClick={handleCreate} disabled={!fTitle.trim()}
            className="w-full bg-red-500 text-white rounded-xl py-3.5 text-sm font-bold active:bg-red-600 disabled:opacity-40">
            Log Mistake
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
