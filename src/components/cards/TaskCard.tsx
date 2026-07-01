import { MapPin, Clock, Phone, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'
import type { Task } from '../../types'
import { ProofBadge } from '../badges/ProofBadge'
import { useAuth } from '../../context/AuthContext'

interface Props {
  task: Task
  onClick?: () => void
  onAction?: (task: Task) => void
  compact?: boolean
}

const TYPE_ICON: Record<string, string> = {
  site_visit:  '📍',
  qc_check:    '🔍',
  production:  '🔧',
  payment:     '💰',
  delivery:    '🚚',
  call:        '📞',
  other:       '📋',
}

const TYPE_LABEL: Record<string, string> = {
  site_visit:  'Site Visit',
  qc_check:    'Quality Check',
  production:  'Production',
  payment:     'Payment',
  delivery:    'Delivery',
  call:        'Customer Call',
  other:       'Task',
}

function getActionLabel(task: Task): string {
  if (task.status === 'completed') return 'Done ✓'
  if (task.status === 'in_progress') return 'Continue'
  if (task.type === 'payment') return 'Call Customer'
  if (task.type === 'call') return 'Call Now'
  if (task.type === 'site_visit') return 'Start Visit'
  if (task.status === 'overdue') return 'Do Now'
  return 'Start'
}

function getActionColor(task: Task): string {
  if (task.status === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (task.priority === 'critical' || task.status === 'overdue') return 'bg-red-500 text-white'
  if (task.status === 'in_progress') return 'bg-blue-600 text-white'
  if (task.type === 'payment' || task.type === 'call') return 'bg-teal-600 text-white'
  return 'bg-indigo-600 text-white'
}

function getCardBorder(task: Task): string {
  if (task.status === 'completed') return 'border-slate-100 opacity-70'
  if (task.priority === 'critical' || task.status === 'overdue') return 'border-red-200 border-l-4 border-l-red-500'
  if (task.status === 'in_progress') return 'border-blue-200 border-l-4 border-l-blue-500'
  return 'border-slate-100'
}

export function TaskCard({ task, onClick, onAction, compact = false }: Props) {
  const { user } = useAuth()
  const isViewer  = user?.role === 'viewer'
  const isDone    = task.status === 'completed'
  const isOverdue = task.status === 'overdue'
  const isUrgent  = task.priority === 'critical' || task.priority === 'high'

  if (compact) {
    return (
      <button onClick={onClick}
        className={`w-full text-left bg-white rounded-2xl shadow-card border active:scale-[0.98] transition-transform p-3.5 ${getCardBorder(task)}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg
            ${isDone ? 'bg-emerald-50' : isOverdue ? 'bg-red-50' : 'bg-indigo-50'}`}>
            {isDone ? '✅' : TYPE_ICON[task.type]}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-snug ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
              {task.title}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {task.customer ?? task.projectName} {task.dueTime ? `· ${task.dueTime}` : ''}
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
        </div>
      </button>
    )
  }

  return (
    <div className={`w-full bg-white rounded-2xl shadow-card border ${getCardBorder(task)} ${isDone ? 'opacity-75' : ''}`}>
      {/* Overdue / Urgent banner */}
      {isOverdue && !isDone && (
        <div className="flex items-center gap-2 bg-red-500 rounded-t-2xl px-4 py-2">
          <AlertCircle size={14} className="text-white flex-shrink-0" />
          <span className="text-xs font-bold text-white">Urgent — Do this first!</span>
        </div>
      )}

      <div className="p-4">
        {/* Type label + status */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{TYPE_ICON[task.type]}</span>
            <span className="text-xs font-semibold text-slate-400">{TYPE_LABEL[task.type]}</span>
          </div>
          {isDone ? (
            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={12} />
              <span className="text-[11px] font-bold">Done</span>
            </div>
          ) : task.status === 'in_progress' ? (
            <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-bold">Started</span>
            </div>
          ) : (
            isUrgent && !isDone && (
              <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold
                ${task.priority === 'critical' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                {task.priority === 'critical' ? '🔴 Urgent' : '🟠 Important'}
              </div>
            )
          )}
        </div>

        {/* Task title */}
        <h3 className={`text-base font-extrabold leading-snug mb-3
          ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {task.title}
        </h3>

        {/* Customer + Project */}
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 mb-3 space-y-1.5">
          {task.customer && (
            <div className="flex items-center gap-2">
              <span className="text-[13px]">👤</span>
              <span className="text-sm font-semibold text-slate-700">{task.customer}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[13px]">📁</span>
            <span className="text-xs text-slate-500">{task.projectName}</span>
          </div>
        </div>

        {/* Time + Location */}
        <div className="flex flex-wrap gap-3 mb-3.5">
          {task.dueTime && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={13} className="text-indigo-400" />
              <span className="font-medium">{task.dueDate}, {task.dueTime}</span>
            </div>
          )}
          {task.location && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin size={13} className="text-teal-400" />
              <span>{task.location}</span>
            </div>
          )}
        </div>

        {/* Checklist progress if any */}
        {task.checklistItems && task.checklistItems.length > 0 && (
          <div className="mb-3.5">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Steps</span>
              <span className="font-semibold text-slate-600">
                {task.checklistItems.filter(c => c.done).length} / {task.checklistItems.length} done
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${(task.checklistItems.filter(c => c.done).length / task.checklistItems.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Proof badge */}
        {!isDone && (
          <div className="mb-3">
            <ProofBadge
              requiredProofType={task.requiredProofType}
              proofUploads={task.proofUploads}
            />
          </div>
        )}

        {/* Action button — hidden for viewer */}
        {!isViewer && (
          <button
            onClick={e => { e.stopPropagation(); onAction ? onAction(task) : onClick?.() }}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold active:opacity-80 transition-opacity ${getActionColor(task)}`}>
            {(task.type === 'payment' || task.type === 'call') && !isDone && <Phone size={15} />}
            {getActionLabel(task)}
          </button>
        )}
      </div>
    </div>
  )
}
