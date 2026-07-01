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
import type { Task } from '../../types'
import { isTaskForToday, isDateToday, isDateFuture } from '../../utils/taskFilters'

function sortRegular(tasks: Task[]): Task[] {
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
  installation_assign:'Installation assigned!',
  installation_update:'Installation updated!',
  final_payment:      'Payment updated!',
  final_completion:   'Full payment recorded!',
  completed:          '🎉 Project completed!',
}

export default function TodayTasksScreen() {
  const navigate               = useNavigate()
  const { tasks, updateTask }  = useAppData()
  const { user }               = useAuth()
  const [flowTask, setFlowTask]= useState<Task | null>(null)
  const [snack, setSnack]      = useState({ open: false, msg: '' })

  const role = user?.role ?? 'lead_manager'

  // All tasks with a flowStage
  const flowTasks = tasks.filter(t => t.flowStage != null)

  // Filter active flow tasks by role
  const activeFTs = flowTasks.filter(t => {
    if (t.flowStage === 'completed') return false

    if (role === 'site_engineer') {
      // SE only sees site_visit tasks — and only if visitDate is today or past (not future)
      if (t.flowStage !== 'site_visit') return false
      return !isDateFuture(t.visitDate)
    }
    if (role === 'owner') {
      // Owner sees tasks pending their approval and reschedule approvals on site_visit tasks
      return t.flowStage === 'owner_approval' ||
        (t.flowStage === 'site_visit' && t.flowStatus === 'reschedule_requested')
    }
    if (role === 'production_admin') {
      return t.flowStage === 'production_check'
    }
    if (role === 'production_manager') {
      return t.flowStage === 'production_work'
    }
    if (role === 'production_team') {
      return t.flowStage === 'production_check' || t.flowStage === 'production_work'
    }
    if (role === 'technician' || role === 'installation_incharge') {
      return t.flowStage === 'installation_assign' || t.flowStage === 'installation_update'
    }
    if (role === 'lead_manager') {
      // Hide reschedule_review tasks that have already been reviewed (legacy tasks)
      if (t.flowStage === 'reschedule_review' && (t.flowStatus === 'approved' || t.flowStatus === 'rejected')) return false
      // LM sees all flow tasks
      return true
    }
    return false // viewer sees no active flow tasks
  })

  const completedFTs = flowTasks.filter(t => t.flowStage === 'completed')

  // Regular tasks (no flowStage) for today
  const regular = sortRegular(
    tasks.filter(t => !t.flowStage && isTaskForToday(t))
  )
  const overdueR   = regular.filter(t => t.status === 'overdue')
  const startedR   = regular.filter(t => t.status === 'in_progress')
  const pendingR   = regular.filter(t => t.status === 'pending')
  const completedR = regular.filter(t => t.status === 'completed')

  function handleFlowUpdate(updates: Partial<Task>) {
    if (!flowTask) return
    updateTask(flowTask.id, updates)
    const nextStage = (updates.flowStage ?? flowTask.flowStage) as string
    setSnack({ open: true, msg: STAGE_MSG[nextStage] ?? 'Status updated!' })
    setFlowTask(null)
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-28">
      <AppHeader />
      <div className="px-4 pt-4 space-y-3">

        {/* ── Active flow tasks at top ── */}
        {activeFTs.length > 0 && (
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
              {role === 'owner' ? 'Pending Approvals' :
               role === 'site_engineer' ? 'My Site Visits' :
               role === 'production_team' ? 'Production Tasks' :
               'Active Projects'}
            </p>
            {activeFTs.map(t => (
              <FlowTaskCard key={t.id} task={t} onClick={() => setFlowTask(t)} />
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
               role === 'production_team' ? 'No production tasks at the moment.' :
               'No tasks for today. Qualify a lead to get started.'}
            </p>
          </div>
        )}

        {/* ── Completed flow tasks at bottom ── */}
        {completedFTs.length > 0 && (
          <div className="opacity-60">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Completed Projects</p>
            {completedFTs.map(t => (
              <FlowTaskCard key={t.id} task={t} onClick={() => {}} />
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

      {flowTask && (
        <DemoFlowSheet
          isOpen={!!flowTask}
          onClose={() => setFlowTask(null)}
          task={flowTask}
          onUpdate={handleFlowUpdate}
        />
      )}

      <Snackbar
        isOpen={snack.open}
        message={snack.msg}
        type="success"
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      />
    </div>
  )
}
