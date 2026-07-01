import { ChevronRight } from 'lucide-react'
import type { Task } from '../../types'

interface Props {
  task: Task
  onClick?: () => void
  onToggle?: (task: Task) => void
  isLast?: boolean
}

export function TodayTaskRow({ task, onClick, onToggle, isLast = false }: Props) {
  const isDone    = task.status === 'completed'
  const isOverdue = task.status === 'overdue'
  const isFollowup = task.taskKind === 'followup'

  // Build assignee/worker info line
  const infoLine = (() => {
    if (isFollowup && task.workerName) {
      return `${task.workerRole ?? 'Worker'}: ${task.workerName}`
    }
    if (task.taskKind === 'work') {
      return `Assigned to: ${task.assignee}`
    }
    return task.assignee
  })()

  return (
    <div className={`flex items-center gap-3 px-4 py-3 active:bg-slate-50 ${!isLast ? 'border-b border-slate-100' : ''}`}>
      <button
        onClick={e => { e.stopPropagation(); onToggle?.(task) }}
        className="flex-shrink-0 self-start mt-1"
        aria-label={isDone ? 'Mark incomplete' : 'Mark done'}
      >
        {isDone ? (
          <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
              <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <div className={`w-6 h-6 rounded-lg border-2 ${isOverdue ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
        )}
      </button>

      <button onClick={onClick} className="flex-1 min-w-0 text-left py-0.5">
        {/* Project name + followup chip */}
        <div className="flex items-center gap-1.5 mb-0.5">
          {task.projectName && (
            <p className={`text-[11px] font-bold truncate ${
              isDone ? 'text-slate-300' : isOverdue ? 'text-red-400' : 'text-blue-500'
            }`}>
              {task.projectName}
            </p>
          )}
          {isFollowup && !isDone && (
            <span className="flex-shrink-0 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Follow-up
            </span>
          )}
        </div>
        {/* Task title */}
        <p className={`text-sm font-semibold leading-snug ${
          isDone ? 'line-through text-slate-400' : isOverdue ? 'text-red-700' : 'text-slate-800'
        }`}>
          {task.title}
        </p>
        {/* Assignee/worker info */}
        {infoLine && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{infoLine}</p>
        )}
        {/* Location */}
        {task.location && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{task.location}</p>
        )}
      </button>

      <ChevronRight size={15} className="text-slate-300 flex-shrink-0 self-center" />
    </div>
  )
}
