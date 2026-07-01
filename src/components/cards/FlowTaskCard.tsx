import type { Task } from '../../types'

const STAGE_LABEL: Record<string, string> = {
  site_assign:        'Site Assignment',
  site_visit:         'Site Visit',
  reschedule_review:  'Reschedule Review',
  site_review:        'Quotation',
  owner_approval:     'MD/ED Approval',
  send_to_client:     'Send to Client',
  production_assign:  'Production Setup',
  production_check:   'Availability Check',
  advance_payment:    'Advance Payment',
  production_work:    'Production Work',
  installation_assign:'Installation Setup',
  installation_update:'Installation',
  final_payment:      'Final Payment',
  final_completion:   'Complete Project',
  completed:          'Completed',
}

const STAGE_COLOR: Record<string, string> = {
  site_assign:        'bg-cyan-100 text-cyan-700',
  site_visit:         'bg-teal-100 text-teal-700',
  reschedule_review:  'bg-amber-100 text-amber-700',
  site_review:        'bg-violet-100 text-violet-700',
  owner_approval:     'bg-purple-100 text-purple-700',
  send_to_client:     'bg-indigo-100 text-indigo-700',
  production_assign:  'bg-orange-100 text-orange-700',
  production_check:   'bg-amber-100 text-amber-700',
  advance_payment:    'bg-emerald-100 text-emerald-700',
  production_work:    'bg-blue-100 text-blue-700',
  installation_assign:'bg-rose-100 text-rose-700',
  installation_update:'bg-pink-100 text-pink-700',
  final_payment:      'bg-green-100 text-green-700',
  final_completion:   'bg-emerald-100 text-emerald-700',
  completed:          'bg-slate-100 text-slate-500',
}

const STATUS_LABEL: Record<string, string> = {
  ready:                 'Ready',
  pending:               'Pending',
  waiting:               'Waiting',
  rescheduled:           'Rescheduled',
  reschedule_requested:  'Reschedule Requested',
  reschedule_approved:   'Reschedule Approved',
  reschedule_rejected:   'Reschedule Rejected',
  approval_needed:       'Approval Needed',
  completed:             'Completed',
  rejected:              'Rejected',
  approved:              'Approved',
  client_approved:       'Client Approved',
  client_rejected:       'Client Rejected',
  not_available:         'Not Available',
  available:             'Available',
  advance_paid:          'Advance Paid',
  partial_paid:          'Partial Paid',
  full_paid:             'Full Paid',
  overdue:               'Overdue',
  date_updated:          'Date Updated',
  assigned:              'Assigned',
  not_completed:         'Not Completed',
  mistake:               'Mistake Logged',
  done:                  'Done',
}

interface Props {
  task: Task
  onClick: () => void
}

export function FlowTaskCard({ task, onClick }: Props) {
  const stage    = task.flowStage ?? 'site_assign'
  const status   = task.flowStatus ?? 'ready'
  const isDone   = stage === 'completed'
  const isAlert  = status === 'overdue' || status === 'rejected' || status === 'not_available' || status === 'client_rejected' || status === 'not_completed' || status === 'mistake' || status === 'reschedule_rejected'
  const isGood   = status === 'completed' || status === 'approved' || status === 'client_approved' || status === 'full_paid' || status === 'done' || status === 'available' || status === 'advance_paid' || status === 'reschedule_approved'
  const isWarn   = status === 'reschedule_requested' || status === 'approval_needed'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 mb-2
      ${isDone ? 'border-emerald-200' : isAlert ? 'border-red-200' : isWarn ? 'border-amber-300' : 'border-slate-200'}`}>

      {/* Top row: project + stage badge */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-blue-500 truncate">{task.projectName}</p>
        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_COLOR[stage] ?? 'bg-slate-100 text-slate-500'}`}>
          {STAGE_LABEL[stage] ?? stage}
        </span>
      </div>

      {/* Task title */}
      <h3 className={`text-sm font-extrabold leading-snug ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
        {task.title}
      </h3>

      {/* Client info */}
      <div className="space-y-0.5">
        {task.clientName && <p className="text-xs text-slate-600 font-semibold">{task.clientName}</p>}
        {task.clientRequirement && <p className="text-xs text-slate-400">{task.clientRequirement}</p>}
        {task.location && <p className="text-xs text-slate-400">{task.location}</p>}
      </div>

      {/* Engineer / person */}
      {task.siteEngineerName && stage !== 'site_assign' && (
        <p className="text-xs text-cyan-700 font-semibold">Engineer: {task.siteEngineerName}</p>
      )}
      {task.installationPerson && (stage === 'installation_assign' || stage === 'installation_update' || stage === 'final_payment') && (
        <p className="text-xs text-rose-700 font-semibold">Installer: {task.installationPerson}</p>
      )}

      {/* Amount */}
      {task.quotationAmount != null && stage !== 'site_review' && (
        <p className="text-xs font-bold text-emerald-700">
          ₹{task.quotationAmount.toLocaleString('en-IN')}
          {task.paidAmount != null && task.paidAmount > 0
            ? ` · Paid ₹${task.paidAmount.toLocaleString('en-IN')}`
            : ''}
        </p>
      )}

      {/* Alert notes */}
      {isAlert && task.productionOverdueReason && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-[10px] font-bold text-red-400 uppercase mb-0.5">Overdue Reason</p>
          <p className="text-xs text-red-700 line-clamp-2">{task.productionOverdueReason}</p>
          {task.productionNewDate && <p className="text-[11px] text-red-600 mt-0.5">New Date: {task.productionNewDate}</p>}
        </div>
      )}
      {isAlert && task.ownerRejectionReason && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-[10px] font-bold text-red-400 uppercase mb-0.5">Rejection Reason</p>
          <p className="text-xs text-red-700 line-clamp-2">{task.ownerRejectionReason}</p>
        </div>
      )}

      {/* Status + action */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
          isGood   ? 'bg-emerald-50 text-emerald-700' :
          isAlert  ? 'bg-red-50 text-red-700' :
          status === 'waiting' ? 'bg-slate-50 text-slate-400' :
          status === 'rescheduled' ? 'bg-amber-50 text-amber-700' :
          'bg-slate-100 text-slate-500'
        }`}>
          {STATUS_LABEL[status] ?? status}
        </span>
        {!isDone ? (
          <button
            onClick={onClick}
            className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl active:bg-blue-700"
          >
            Update Status
          </button>
        ) : (
          <span className="text-xs font-bold text-emerald-600">✓ Completed</span>
        )}
      </div>
    </div>
  )
}
