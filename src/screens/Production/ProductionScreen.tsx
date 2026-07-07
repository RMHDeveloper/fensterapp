import { useState } from 'react'
import { AlertTriangle, Layers } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { FlowTaskCard } from '../../components/cards/FlowTaskCard'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { Task } from '../../types'

type Filter = 'all' | 'pending' | 'verified' | 'in_progress' | 'done' | 'overdue'

const STAGE_MSG: Record<string, string> = {
  production_check: 'Availability check updated!',
  production_work:  'Production status updated!',
}

function isVerified(t: Task): boolean {
  return t.flowStatus === 'all_available' || t.flowStatus === 'ordered' || t.flowStatus === 'verified'
}
function isOverdue(t: Task): boolean {
  return t.flowStatus === 'overdue' || !!t.productionOverdueReason
}
function isAllDone(t: Task): boolean {
  const cl = t.productionChecklist
  return !!cl && cl.length > 0 && cl.every(c => c.done)
}

export default function ProductionScreen() {
  const { tasks, updateTask } = useAppData()
  const { user } = useAuth()
  const [filter, setFilter]       = useState<Filter>('all')
  const [flowTaskId, setFlowTaskId] = useState<string | null>(null)
  const [snack, setSnack]         = useState({ open: false, msg: '', type: 'success' as 'success' | 'error' })

  const flowTask = flowTaskId ? (tasks.find(t => t.id === flowTaskId) ?? null) : null

  const role      = user?.role ?? 'production_admin'
  const isAdmin   = role === 'production_admin'
  const isManager = role === 'production_manager'

  // Gather relevant tasks by role
  const prodTasks = tasks.filter(t => {
    if (isAdmin)   return t.flowStage === 'production_check'
    if (isManager) return t.flowStage === 'production_work'
    // owner / others: see both stages
    return t.flowStage === 'production_check' || t.flowStage === 'production_work'
  })

  // Counts
  const totalCount   = prodTasks.length
  const overdueCount = prodTasks.filter(isOverdue).length
  const doneCount    = isAdmin
    ? prodTasks.filter(isVerified).length
    : prodTasks.filter(isAllDone).length
  const pendingCount = totalCount - doneCount - (isManager ? overdueCount : 0)

  // Filtered list
  const filtered = prodTasks.filter(t => {
    if (filter === 'all')         return true
    if (filter === 'pending')     return !isVerified(t)
    if (filter === 'verified')    return isVerified(t)
    if (filter === 'in_progress') return !isAllDone(t) && !isOverdue(t)
    if (filter === 'done')        return isAllDone(t)
    if (filter === 'overdue')     return isOverdue(t)
    return true
  })

  function handleFlowUpdate(updates: Partial<Task>) {
    if (!flowTask) return
    updateTask(flowTask.id, updates)
    const nextStage = (updates.flowStage ?? flowTask.flowStage) as string
    setSnack({ open: true, msg: STAGE_MSG[nextStage] ?? 'Production updated!', type: 'success' })
    setFlowTaskId(null)
  }

  // Summary card definitions
  type SummaryCard = { label: string; value: number; bg: string; num: string }
  const summaryCards: SummaryCard[] = isManager
    ? [
        { label: 'Total',       value: totalCount,   bg: 'bg-blue-50',    num: 'text-blue-600'    },
        { label: 'In Progress', value: pendingCount, bg: 'bg-amber-50',   num: 'text-amber-600'   },
        { label: 'Done',        value: doneCount,    bg: 'bg-emerald-50', num: 'text-emerald-600' },
        { label: 'Overdue',     value: overdueCount, bg: 'bg-red-50',     num: 'text-red-600'     },
      ]
    : [
        { label: 'Total',    value: totalCount,   bg: 'bg-blue-50',    num: 'text-blue-600'    },
        { label: 'Pending',  value: pendingCount, bg: 'bg-amber-50',   num: 'text-amber-600'   },
        { label: 'Verified', value: doneCount,    bg: 'bg-emerald-50', num: 'text-emerald-600' },
      ]

  // Filter chip definitions
  type Chip = { value: Filter; label: string; count: number; alertColor?: string }
  const chips: Chip[] = isManager
    ? [
        { value: 'all',         label: 'All',        count: totalCount   },
        { value: 'in_progress', label: 'In Progress', count: pendingCount },
        { value: 'done',        label: 'Done',        count: doneCount    },
        { value: 'overdue',     label: 'Overdue',     count: overdueCount, alertColor: 'text-red-700 bg-red-100' },
      ]
    : [
        { value: 'all',      label: 'All',      count: totalCount   },
        { value: 'pending',  label: 'Pending',  count: pendingCount },
        { value: 'verified', label: 'Verified', count: doneCount    },
      ]

  const activeChip = chips.find(c => c.value === filter)

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <AppHeader />

      {/* Sticky sub-header */}
      <div className="bg-white px-4 pt-4 pb-4 border-b border-slate-200 sticky top-14 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-xl font-extrabold text-slate-800">Production</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {isAdmin ? 'Availability check' : isManager ? 'Track production work' : 'Production overview'}
              </p>
            </div>
          </div>
          {overdueCount > 0 && (
            <button
              onClick={() => setFilter('overdue')}
              className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 active:opacity-80"
            >
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-sm font-bold text-red-600">{overdueCount} overdue</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">

        {/* Summary cards */}
        <div className={`grid gap-2.5 ${isManager ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {summaryCards.map(card => (
            <div key={card.label} className={`${card.bg} rounded-xl p-2.5 text-center`}>
              <p className={`text-2xl font-extrabold ${card.num}`}>{card.value}</p>
              <p className={`text-[11px] font-semibold mt-0.5 ${card.num} opacity-80`}>{card.label}</p>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {chips.map(chip => {
            const isActive = filter === chip.value
            return (
              <button
                key={chip.value}
                onClick={() => setFilter(chip.value)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition-colors
                  ${isActive ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                {chip.label}
                <span className={`text-xs font-bold min-w-[20px] text-center px-1.5 py-0.5 rounded-lg
                  ${isActive
                    ? 'bg-white/25 text-white'
                    : chip.alertColor ?? 'bg-slate-100 text-slate-600'
                  }`}>
                  {chip.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Task list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-slate-800">
              {activeChip ? activeChip.label : 'All'} Projects
            </h2>
            <span className="text-sm font-bold text-slate-400">
              {filtered.length} project{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">No projects in this stage</p>
              <p className="text-xs text-slate-400 mt-1">
                {isAdmin ? 'Projects will appear here when LM assigns production.' : 'Projects appear here once production admin verifies.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(t => (
                <FlowTaskCard key={t.id} task={t} role={role} onClick={() => setFlowTaskId(t.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {flowTask && (
        <DemoFlowSheet
          isOpen={!!flowTask}
          onClose={() => setFlowTaskId(null)}
          task={flowTask}
          onUpdate={handleFlowUpdate}
        />
      )}

      <Snackbar
        isOpen={snack.open}
        message={snack.msg}
        type={snack.type}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      />
    </div>
  )
}
