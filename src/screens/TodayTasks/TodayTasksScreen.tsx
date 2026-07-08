import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Play, Clock } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { TodayTaskRow } from '../../components/cards/TodayTaskRow'
import { FlowTaskCard } from '../../components/cards/FlowTaskCard'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { FilterChips } from '../../components/forms/FilterChips'
import type { Task } from '../../types'
import { isDateFuture, isTaskForToday } from '../../utils/taskFilters'

type SortBy = 'status' | 'priority' | 'date'

const SORT_CHIPS: { value: SortBy; label: string }[] = [
  { value: 'status',   label: 'Status'   },
  { value: 'priority', label: 'Priority' },
  { value: 'date',     label: 'Newest'   },
]

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function sortRegular(tasks: Task[], sortBy: SortBy): Task[] {
  if (sortBy === 'priority') {
    return [...tasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
  }
  if (sortBy === 'date') {
    return [...tasks].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }
  const order: Record<string, number> = { overdue: 0, in_progress: 1, pending: 2, completed: 3 }
  return [...tasks].sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2))
}

const STAGE_MSG: Record<string, string> = {
  site_assign:        'Status updated!',
  site_visit:         'Site visit updated!',
  reschedule_review:  'Reschedule reviewed!',
  site_review:        'Quotation sent to Owner!',
  owner_approval:     'Owner approval updated!',
  send_to_client:     'Quotation sent to client!',
  production_assign:  'Assigned to production!',
  production_check:   'Product availability updated!',
  advance_payment:    'Payment updated!',
  production_work:    'Production status updated!',
  dispatch_assign:          'Assigned to dispatch!',
  admin_availability_check: 'Availability checked!',
  site_lead_approval:       'Installation approved!',
  installation_assign:'Installation assigned!',
  installation_update:'Installation updated!',
  final_payment:      'Payment updated!',
  final_completion:   'Full payment recorded!',
  completed:          '🎉 Project completed!',
}

export default function TodayTasksScreen() {
  const navigate                          = useNavigate()
  const { tasks, projects, updateTask }   = useAppData()
  const { user }                          = useAuth()
  const [flowTaskId, setFlowTaskId]       = useState<string | null>(null)
  const flowTask = flowTaskId ? (tasks.find(t => t.id === flowTaskId) ?? null) : null
  const [snack, setSnack]                 = useState({ open: false, msg: '', type: 'success' as 'success' | 'error' })
  const [sortBy, setSortBy]               = useState<SortBy>('status')

  const role = user?.role ?? 'lead_manager'

  // Projects owned by this lead_manager (by ID)
  const myProjectIds = new Set(projects.filter(p => p.ownerId === user?.id).map(p => p.id))

  // Helper: is a regular or flow task assigned to the current user?
  const isAssignedToMe = (t: Task) =>
    t.assignedTo === user?.name || t.assignedTo === user?.id ||
    t.assignee   === user?.name || t.assignee   === user?.id ||
    t.siteEngineerName === user?.name

  // All tasks with a flowStage
  const flowTasks = tasks.filter(t => t.flowStage != null)

  // Filter active flow tasks by role — with per-user scoping
  const activeFTs = flowTasks.filter(t => {
    if (t.flowStage === 'completed') return false

    if (role === 'site_engineer') {
      if (t.flowStage !== 'site_visit') return false
      if (isDateFuture(t.visitDate)) return false
      return isAssignedToMe(t)
    }
    if (role === 'owner') {
      return t.flowStage === 'owner_approval' ||
        t.flowStage === 'installation_assign' ||
        t.flowStage === 'reschedule_review' ||
        t.flowStage === 'dispatch_assign' ||
        t.flowStage === 'admin_availability_check' ||
        t.flowStage === 'site_lead_approval' ||
        (t.flowStage === 'site_visit' && t.flowStatus === 'reschedule_requested')
    }
    if (role === 'production_admin') {
      return t.flowStage === 'production_check' || t.flowStage === 'installation_assign' || t.flowStage === 'admin_availability_check'
    }
    if (role === 'production_manager') {
      return t.flowStage === 'production_work'
    }
    if (role === 'production_team') {
      return t.flowStage === 'production_check' || t.flowStage === 'production_work'
    }
    if (role === 'site_engineer_lead') {
      return t.flowStage === 'site_lead_approval'
    }
    if (role === 'technician' || role === 'installation_incharge') {
      if (t.flowStage !== 'installation_assign' && t.flowStage !== 'installation_update') return false
      return isAssignedToMe(t)
    }
    if (role === 'lead_manager') {
      if (t.flowStage === 'reschedule_review' && (t.flowStatus === 'approved' || t.flowStatus === 'rejected')) return false
      return myProjectIds.has(t.projectId)
    }
    return false
  })

  // Completed flow tasks — owner sees all, LM sees only their projects'
  const completedFTs = role === 'owner'
    ? flowTasks.filter(t => t.flowStage === 'completed')
    : role === 'lead_manager'
    ? flowTasks.filter(t => t.flowStage === 'completed' && myProjectIds.has(t.projectId))
    : []

  // Regular tasks (no flowStage) — only today's + overdue + in-progress, per-user scoping
  const regular = sortRegular(
    tasks.filter(t => {
      if (t.flowStage) return false
      if (role === 'viewer') return false
      if (t.status !== 'overdue' && t.status !== 'in_progress' && !isTaskForToday(t)) return false
      if (role === 'owner') return true
      const hasAssignee = t.assignedTo || t.assignee
      return !hasAssignee || isAssignedToMe(t)
    }),
    sortBy
  )
  const overdueR   = regular.filter(t => t.status === 'overdue')
  const startedR   = regular.filter(t => t.status === 'in_progress')
  const pendingR   = regular.filter(t => t.status === 'pending')
  const completedR = regular.filter(t => t.status === 'completed')

  function handleFlowUpdate(updates: Partial<Task>) {
    if (!flowTask) return
    updateTask(flowTask.id, updates)
    const nextStage = (updates.flowStage ?? flowTask.flowStage) as string
    setSnack({ open: true, msg: STAGE_MSG[nextStage] ?? 'Status updated!', type: 'success' })
    setFlowTaskId(null)
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-28">
      <AppHeader />
      <div className="px-4 pt-4 space-y-3">

        {/* ── Sort by ── */}
        <FilterChips chips={SORT_CHIPS} active={sortBy} onChange={setSortBy} />

        {/* ── Active flow tasks at top ── */}
        {activeFTs.length > 0 && (
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
              {role === 'owner' ? 'Pending Approvals' :
               role === 'site_engineer' ? 'My Site Visits' :
               role === 'site_engineer_lead' ? 'Installation Availability Approvals' :
               role === 'production_admin' ? 'Production Checks' :
               role === 'production_manager' || role === 'production_team' ? 'Production Tasks' :
               role === 'technician' || role === 'installation_incharge' ? 'Installations' :
               'Active Projects'}
            </p>
            {activeFTs.map(t => (
              <FlowTaskCard key={t.id} task={t} role={role} onClick={() => setFlowTaskId(t.id)} />
            ))}
          </div>
        )}

        {/* ── Regular overdue ── */}
        {overdueR.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={11} className="text-red-600" />
              </div>
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Overdue</p>
            </div>
            <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
              {overdueR.map((t, i) => (
                <TodayTaskRow key={t.id} task={t} onClick={() => navigate(`/task/${t.id}`)} isLast={i === overdueR.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── Regular in progress ── */}
        {startedR.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                <Play size={10} className="text-blue-600" />
              </div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">In Progress</p>
            </div>
            <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden">
              {startedR.map((t, i) => (
                <TodayTaskRow key={t.id} task={t} onClick={() => navigate(`/task/${t.id}`)} isLast={i === startedR.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── Regular pending ── */}
        {pendingR.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center">
                <Clock size={11} className="text-slate-500" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {pendingR.map((t, i) => (
                <TodayTaskRow key={t.id} task={t} onClick={() => navigate(`/task/${t.id}`)} isLast={i === pendingR.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {activeFTs.length === 0 && overdueR.length === 0 && startedR.length === 0 && pendingR.length === 0 && (
          <div className="mt-10 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-700 mb-2">All Clear!</h2>
            <p className="text-sm text-slate-400 mb-5">
              {role === 'owner' ? 'No quotations pending your approval.' :
               role === 'site_engineer' ? 'No site visits assigned to you.' :
               role === 'site_engineer_lead' ? 'No installation availability approvals pending.' :
               role === 'production_admin' ? 'No production checks at the moment.' :
               role === 'production_manager' || role === 'production_team' ? 'No production tasks at the moment.' :
               role === 'technician' || role === 'installation_incharge' ? 'No installations assigned to you.' :
               'No tasks for today. Qualify a lead to get started.'}
            </p>
          </div>
        )}

        {/* ── Completed flow tasks at bottom ── */}
        {completedFTs.length > 0 && (
          <div className="opacity-60">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Completed Projects</p>
            {completedFTs.map(t => (
              <FlowTaskCard key={t.id} task={t} role={role} onClick={() => {}} />
            ))}
          </div>
        )}

        {completedR.length > 0 && (
          <div className="opacity-60">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 size={11} className="text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Done</p>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
              {completedR.map((t, i) => (
                <TodayTaskRow key={t.id} task={t} onClick={() => navigate(`/task/${t.id}`)} isLast={i === completedR.length - 1} />
              ))}
            </div>
          </div>
        )}
      </div>

      {flowTask && (() => {
        const idx = activeFTs.findIndex(t => t.id === flowTask.id)
        return (
          <DemoFlowSheet
            isOpen={!!flowTask}
            onClose={() => setFlowTaskId(null)}
            task={flowTask}
            onUpdate={handleFlowUpdate}
            onNavigate={dir => {
              const nextIdx = dir === 'prev' ? idx - 1 : idx + 1
              const nextTask = activeFTs[nextIdx]
              if (nextTask) setFlowTaskId(nextTask.id)
            }}
            hasPrev={idx > 0}
            hasNext={idx >= 0 && idx < activeFTs.length - 1}
          />
        )
      })()}

      <Snackbar
        isOpen={snack.open}
        message={snack.msg}
        type={snack.type}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      />
    </div>
  )
}
