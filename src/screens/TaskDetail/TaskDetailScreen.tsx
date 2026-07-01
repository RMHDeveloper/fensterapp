import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Clock, Phone, RefreshCw, MessageSquare, History } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { StatusUpdateSheet } from '../../components/feedback/StatusUpdateSheet'
import { WorkflowStatusSheet } from './WorkflowStatusSheet'
import { ProofBadge } from '../../components/badges/ProofBadge'
import { Snackbar } from '../../components/feedback/Snackbar'
import { taskTypeToModule, getStatusesForRole, mapDisplayStatusToTaskStatus } from '../../data/statusOptions'
import type { TaskStatus, UserRole, StatusHistoryItem, FlowStage } from '../../types'

// Roles each viewer is allowed to see history entries from
const HISTORY_VISIBLE_FOR: Partial<Record<string, string[]>> = {
  site_engineer:      ['site_engineer', 'owner', 'lead_manager'],
  production_manager: ['production_manager', 'admin', 'owner', 'lead_manager'],
  admin:              ['production_manager', 'admin', 'owner', 'lead_manager'],
  technician:         ['technician', 'installation_incharge', 'owner', 'lead_manager'],
}

const TYPE_ICON: Record<string, string> = {
  site_visit: '📍', qc_check: '🔍', production: '🔧',
  payment: '💰', delivery: '🚚', call: '📞', other: '📋',
}
const TYPE_LABEL: Record<string, string> = {
  site_visit: 'Site Visit', qc_check: 'Quality Check', production: 'Production',
  payment: 'Payment Collection', delivery: 'Delivery', call: 'Customer Call', other: 'Task',
}

export default function TaskDetailScreen() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks, updateTaskStatus, updateTask, completeWorkflowStep } = useAppData()
  const { user } = useAuth()
  const task     = tasks.find(t => t.id === id) ?? tasks[0]

  const [checklist, setChecklist]   = useState(task.checklistItems ?? [])
  const [status, setStatus]         = useState<TaskStatus>(task.status)
  const [showStatus, setShowStatus] = useState(false)
  const [snack, setSnack]           = useState({ open: false, msg: '' })

  const isViewer = user?.role === 'viewer'
  const isDone   = status === 'completed'
  const hasPhone = task.type === 'payment' || task.type === 'call'

  const toggleItem = (itemId: string) => {
    setChecklist(prev => prev.map(c => c.id === itemId ? { ...c, done: !c.done } : c))
  }
  const doneCount = checklist.filter(c => c.done).length

  const handleStatusSave = (newStatus: string, note: string, proofFiles: string[]) => {
    const mapped: TaskStatus = mapDisplayStatusToTaskStatus(newStatus)
    setStatus(mapped)

    const updates: Record<string, unknown> = {
      status: mapped,
      proofUploads: proofFiles.length ? [...(task.proofUploads ?? []), ...proofFiles] : task.proofUploads,
    }

    if (note.trim()) {
      const entry: StatusHistoryItem = {
        stage: (task.flowStage ?? 'site_assign') as FlowStage,
        status: mapped,
        note: note.trim(),
        files: proofFiles.length > 0 ? proofFiles : undefined,
        updatedBy: user?.name ?? 'User',
        updatedRole: user?.role ?? 'viewer',
        updatedAt: new Date().toLocaleString('en-IN'),
      }
      updates.statusHistory = [...(task.statusHistory ?? []), entry]
    }

    updateTask(task.id, updates as Parameters<typeof updateTask>[1])
    setShowStatus(false)
    setSnack({ open: true, msg: mapped === 'completed' ? 'Task completed!' : 'Status updated!' })
  }

  function mapOutcomeToStatus(outcome: string): TaskStatus {
    switch (outcome) {
      case 'completed': case 'approved': case 'available': case 'assigned': return 'completed'
      case 'not_available': case 'rejected': case 'client_rejected': case 'problem': return 'overdue'
      case 'sent_to_owner': case 'sent_to_client': case 'in_progress': return 'in_progress'
      default: return 'pending'
    }
  }

  const handleWorkflowComplete = (outcome: string, extraData: Record<string, unknown>) => {
    if (outcome === 'pending') {
      setShowStatus(false)
      return
    }
    const mapped = mapOutcomeToStatus(outcome)
    setStatus(mapped)
    completeWorkflowStep(task, outcome, extraData)
    updateTaskStatus(task.id, mapped)
    setShowStatus(false)
    setSnack({ open: true, msg: mapped === 'completed' ? 'Task completed!' : 'Status updated!' })
  }

  const headerBg = isDone ? 'bg-emerald-600'
    : status === 'in_progress' ? 'bg-blue-600'
    : status === 'overdue'     ? 'bg-red-600'
    : 'bg-blue-700'

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">

      {/* Header */}
      <div className={`px-4 pt-12 pb-5 flex-shrink-0 ${headerBg}`}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center active:bg-white/30"
            aria-label="Go back">
            <ArrowLeft size={19} className="text-white" aria-hidden="true" />
          </button>
          <span className="text-white/70 text-sm font-medium">Back</span>
          <div className="ml-auto">
            {isDone
              ? <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Completed</span>
              : status === 'in_progress'
              ? <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" aria-hidden="true" /> In Progress
                </span>
              : status === 'overdue'
              ? <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Overdue</span>
              : <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">Pending</span>
            }
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl" aria-hidden="true">
            {TYPE_ICON[task.type]}
          </div>
          <div>
            <p className="text-white/70 text-xs font-medium mb-1">{TYPE_LABEL[task.type]}</p>
            <h1 className="text-xl font-extrabold text-white leading-snug">{task.title}</h1>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Proof badge — shown when task needs proof and not yet done */}
        {task.requiredProofType && task.requiredProofType !== 'none' && !isDone && (
          <div className="flex justify-end">
            <ProofBadge requiredProofType={task.requiredProofType} proofUploads={task.proofUploads ?? []} />
          </div>
        )}

        {/* Info card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          {task.customer && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-lg" aria-hidden="true">👤</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Customer</p>
                <p className="text-base font-bold text-slate-800">{task.customer}</p>
              </div>
              {hasPhone && (
                <a href="tel:9876543210"
                  className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center active:bg-teal-100"
                  aria-label="Call customer">
                  <Phone size={17} className="text-teal-600" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-lg" aria-hidden="true">📁</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Project</p>
              <p className="text-sm font-semibold text-slate-700">{task.projectName}</p>
            </div>
          </div>
          {task.dueTime && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock size={17} className="text-amber-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Time</p>
                <p className="text-sm font-semibold text-slate-700">{task.dueDate}, {task.dueTime}</p>
              </div>
            </div>
          )}
          {task.location && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin size={17} className="text-teal-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Location</p>
                <p className="text-sm font-semibold text-slate-700">{task.location}</p>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">What to do</p>
            <p className="text-sm text-slate-700 leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Steps</p>
              <span className="text-sm font-extrabold text-blue-600">{doneCount}/{checklist.length}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3.5">
              <div className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%` }} />
            </div>
            <div className="space-y-2.5">
              {checklist.map((item, idx) => (
                <button key={item.id} onClick={() => toggleItem(item.id)}
                  className="w-full flex items-center gap-3 text-left active:opacity-70 py-0.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold
                    ${item.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {item.done ? '✓' : idx + 1}
                  </div>
                  <span className={`text-sm font-medium ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completed proof — shown when done */}
        {isDone && (task.proofUploads?.length ?? 0) > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-emerald-700 mb-1">Photo Proof Submitted</p>
            {task.proofUploads?.map(f => (
              <p key={f} className="text-xs text-emerald-600">{f}</p>
            ))}
          </div>
        )}

        {/* Notes & Activity */}
        {(task.statusHistory?.length ?? 0) > 0 && (() => {
          const allowedRoles = user?.role ? HISTORY_VISIBLE_FOR[user.role] : undefined
          const visibleHistory = allowedRoles
            ? (task.statusHistory ?? []).filter(e => allowedRoles.includes(e.updatedRole))
            : (task.statusHistory ?? [])
          if (visibleHistory.length === 0) return null
          return (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-slate-400" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes &amp; Activity</p>
            </div>
            <div className="space-y-3 divide-y divide-slate-100">
              {[...visibleHistory].reverse().map((entry, i) => (
                <div key={i} className={`flex gap-2.5 ${i > 0 ? 'pt-3' : ''}`}>
                  <div className="flex flex-col items-center pt-1 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-600 capitalize">
                      {entry.stage.replace(/_/g, ' ')} — {entry.status}
                    </p>
                    {entry.note && (
                      <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{entry.note}</p>
                    )}
                    {entry.files && entry.files.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {entry.files.slice(0, 3).map((f, fi) => (
                          <p key={fi} className="text-[10px] text-slate-400">📎 {f}</p>
                        ))}
                        {entry.files.length > 3 && (
                          <p className="text-[10px] text-slate-400">+{entry.files.length - 3} more</p>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {entry.updatedBy} · {entry.updatedAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )
        })()}

        {/* Bottom spacer — clears sticky bar + nav */}
        <div className="h-28" />
      </div>

      {/* Compact sticky bar — 2 buttons */}
      {!isViewer && (
        <div className="fixed bottom-16 lg:bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-slate-200 px-4 py-3 z-30">
          {isDone ? (
            <div className="bg-emerald-50 text-emerald-700 rounded-xl py-3 text-sm font-extrabold text-center border border-emerald-200">
              ✓ Work Completed
            </div>
          ) : (
            <div className="flex gap-2.5">
              {/* Left: Call or Add Note (via status sheet) */}
              {hasPhone ? (
                <a
                  href="tel:9876543210"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold border-2 border-slate-200 text-slate-600 active:bg-slate-50 min-h-[48px]"
                >
                  <Phone size={15} aria-hidden="true" /> Call
                </a>
              ) : (
                <button
                  onClick={() => setShowStatus(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold border-2 border-slate-200 text-slate-600 active:bg-slate-50 min-h-[48px]"
                >
                  <MessageSquare size={15} aria-hidden="true" /> Add Note
                </button>
              )}
              {/* Right: Update Status */}
              <button
                onClick={() => setShowStatus(true)}
                className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold bg-blue-600 text-white active:bg-blue-700 min-h-[48px]"
              >
                <RefreshCw size={15} aria-hidden="true" /> Update Status
              </button>
            </div>
          )}
        </div>
      )}

      {/* Workflow sheet (for tasks with workflowStep) */}
      {task.workflowStep ? (
        <WorkflowStatusSheet
          isOpen={showStatus}
          onClose={() => setShowStatus(false)}
          task={task}
          role={(user?.role ?? 'viewer') as UserRole}
          onComplete={handleWorkflowComplete}
        />
      ) : (
        <StatusUpdateSheet
          isOpen={showStatus}
          onClose={() => setShowStatus(false)}
          onSave={handleStatusSave}
          taskTitle={task.title}
          taskMeta={task.customer ?? task.projectName}
          currentStatus={status}
          allowedStatuses={getStatusesForRole(taskTypeToModule(task.type), (user?.role ?? 'viewer') as UserRole)}
          requiredProofType={task.requiredProofType}
          role={user?.role ?? 'viewer'}
          canAddNote
        />
      )}

      <Snackbar isOpen={snack.open} message={snack.msg} type="success"
        onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
