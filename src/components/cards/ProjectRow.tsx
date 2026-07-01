import { ChevronRight } from 'lucide-react'
import type { Project } from '../../types'

interface Props {
  project: Project
  onClick?: () => void
}

const STAGE_LABELS: Record<string, string> = {
  new_project: 'New', measurement: 'Measurement', site_visit_assigned: 'Site Visit',
  site_visit_completed: 'Site Visit Done', waiting_site_visit_review: 'Review Pending',
  quotation_preparation: 'Quotation', quotation_sent_owner: 'Awaiting MD/ED',
  owner_approved: 'MD/ED Approved', sent_to_client: 'Sent to Client',
  client_approved: 'Client Approved', client_rejected: 'Client Rejected',
  owner_disapproved: 'MD/ED Rejected', negotiation: 'Negotiation',
  advance_payment: 'Advance Payment', advance_payment_pending: 'Advance Pending',
  production_sheet_preparation: 'Production Setup', production_admin_check: 'Material Check',
  waiting_material_availability: 'Awaiting Material', production_manager_work: 'In Production',
  ready_to_dispatch: 'Dispatch Ready', installation: 'Installation',
  installation_assigned: 'Installer Assigned', installation_in_progress: 'Installing',
  installation_not_completed: 'Install Incomplete', installation_mistake: 'Install Issue',
  final_payment: 'Final Payment', payment_pending: 'Payment Pending',
  partial_paid: 'Partial Paid', completed: 'Completed',
}

const STAGE_COLORS: Record<string, string> = {
  new_project: 'bg-slate-100 text-slate-600',
  measurement: 'bg-blue-100 text-blue-700', site_visit_assigned: 'bg-blue-100 text-blue-700',
  site_visit_completed: 'bg-blue-100 text-blue-700', waiting_site_visit_review: 'bg-blue-100 text-blue-700',
  quotation_preparation: 'bg-indigo-100 text-indigo-700', quotation_sent_owner: 'bg-indigo-100 text-indigo-700',
  owner_approved: 'bg-violet-100 text-violet-700', sent_to_client: 'bg-violet-100 text-violet-700',
  client_approved: 'bg-teal-100 text-teal-700', client_rejected: 'bg-red-100 text-red-700',
  owner_disapproved: 'bg-red-100 text-red-700', negotiation: 'bg-orange-100 text-orange-700',
  advance_payment: 'bg-emerald-100 text-emerald-700', advance_payment_pending: 'bg-amber-100 text-amber-700',
  production_sheet_preparation: 'bg-amber-100 text-amber-700', production_admin_check: 'bg-amber-100 text-amber-700',
  waiting_material_availability: 'bg-amber-100 text-amber-700', production_manager_work: 'bg-amber-100 text-amber-700',
  ready_to_dispatch: 'bg-orange-100 text-orange-700', installation: 'bg-rose-100 text-rose-700',
  installation_assigned: 'bg-rose-100 text-rose-700', installation_in_progress: 'bg-rose-100 text-rose-700',
  installation_not_completed: 'bg-red-100 text-red-700', installation_mistake: 'bg-red-100 text-red-700',
  final_payment: 'bg-emerald-100 text-emerald-700', payment_pending: 'bg-amber-100 text-amber-700',
  partial_paid: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700',
}

function getDaysLabel(dueDate?: string): { text: string; color: string } | null {
  if (!dueDate || dueDate === '—') return null
  const due = new Date(dueDate)
  if (isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff > 0)  return { text: `${diff}d left`,    color: diff <= 7 ? 'text-amber-600' : 'text-emerald-600' }
  if (diff < 0)  return { text: `${-diff}d overdue`, color: 'text-red-500' }
  return              { text: 'Due today',           color: 'text-orange-600' }
}

export function ProjectRow({ project, onClick }: Props) {
  const stage      = project.currentStage ?? project.stage ?? ''
  const stageLabel = STAGE_LABELS[stage] ?? (stage.replace(/_/g, ' ') || 'Active')
  const stageCls   = STAGE_COLORS[stage] ?? 'bg-slate-100 text-slate-600'
  const daysLabel  = getDaysLabel(project.dueDate)
  const progress   = project.progress ?? 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-slate-200 px-4 py-3.5 active:bg-slate-50 active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Progress ring */}
        <div className="flex-shrink-0 relative w-10 h-10">
          <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={progress >= 80 ? '#22c55e' : progress >= 50 ? '#f59e0b' : '#3b82f6'}
              strokeWidth="3"
              strokeDasharray={`${(progress / 100) * 97.4} 97.4`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-slate-600">
            {progress}%
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate leading-tight">{project.name}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{project.client}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageCls}`}>
              {stageLabel}
            </span>
            {daysLabel && (
              <span className={`text-[10px] font-semibold ${daysLabel.color}`}>
                {daysLabel.text}
              </span>
            )}
            {project.dueDate && project.dueDate !== '—' && (
              <span className="text-[10px] text-slate-400">{project.dueDate}</span>
            )}
          </div>
        </div>

        <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />
      </div>
    </button>
  )
}
