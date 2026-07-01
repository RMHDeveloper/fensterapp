import type {
  TaskStatus, Priority, ProjectStatus, PaymentStatus,
  QuotationStatus, ProductionStage, MistakeStatus, OrderStatus, InstallationStatus,
} from '../../types'
import {
  taskStatusColors, priorityColors, projectStatusColors, paymentStatusColors,
  quotationStatusColors, productionStageColors, mistakeStatusColors,
} from '../../styles/designTokens'
import { Clock, Play, CheckCircle2, AlertTriangle, ThumbsUp, XCircle, Send } from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

type AnyStatus = TaskStatus | Priority | ProjectStatus | PaymentStatus |
  QuotationStatus | ProductionStage | MistakeStatus | OrderStatus | InstallationStatus | string

const LABELS: Record<string, string> = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue',
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
  new: 'New', active: 'Active', on_hold: 'On Hold', cancelled: 'Cancelled',
  partial: 'Partial', paid: 'Paid',
  draft: 'Draft', waiting_approval: 'Pending Approval', sent_to_client: 'Sent to Client',
  approved: 'Approved', rejected: 'Rejected', converted: 'Converted',
  qualified: 'Qualified', contacted: 'Contacted', proposal: 'Proposal', won: 'Won', lost: 'Lost',
  cutting: 'Cutting', routing: 'Routing', welding: 'Welding', assembly: 'Assembly',
  glazing: 'Glazing', packing: 'Packing', dispatch_ready: 'Dispatch Ready',
  open: 'Open', rework: 'Rework', resolved: 'Resolved',
  confirmed: 'Confirmed', in_production: 'In Production',
  dispatched: 'Dispatched', delivered: 'Delivered',
  scheduled: 'Scheduled', rescheduled: 'Rescheduled',
  on_track: 'On Track', delayed: 'Delayed',
  upcoming: 'Upcoming', info: 'Info',
  started: 'Started', done: 'Done', problem: 'Problem',
}

const STATUS_ICONS: Record<string, ComponentType<LucideProps>> = {
  pending:          Clock,
  in_progress:      Play,
  started:          Play,
  completed:        CheckCircle2,
  done:             CheckCircle2,
  overdue:          AlertTriangle,
  delayed:          AlertTriangle,
  open:             AlertTriangle,
  problem:          AlertTriangle,
  approved:         ThumbsUp,
  rejected:         XCircle,
  lost:             XCircle,
  cancelled:        XCircle,
  waiting_approval: Send,
  sent_to_client:   Send,
}

const allColors: Record<string, { bg: string; text: string }> = {
  ...taskStatusColors,
  ...priorityColors,
  ...projectStatusColors,
  ...paymentStatusColors,
  ...quotationStatusColors,
  ...productionStageColors,
  ...mistakeStatusColors,
  low:      { bg: 'bg-slate-100',   text: 'text-slate-500'  },
  medium:   { bg: 'bg-amber-50',    text: 'text-amber-700'  },
  high:     { bg: 'bg-orange-50',   text: 'text-orange-700' },
  critical: { bg: 'bg-red-50',      text: 'text-red-700'    },
  new:      { bg: 'bg-sky-50',      text: 'text-sky-700'    },
  contacted:{ bg: 'bg-blue-50',     text: 'text-blue-700'   },
  qualified:{ bg: 'bg-indigo-50',   text: 'text-indigo-700' },
  proposal: { bg: 'bg-violet-50',   text: 'text-violet-700' },
  won:      { bg: 'bg-emerald-50',  text: 'text-emerald-700'},
  lost:     { bg: 'bg-red-50',      text: 'text-red-700'    },
  confirmed:        { bg: 'bg-blue-50',    text: 'text-blue-700'    },
  in_production:    { bg: 'bg-amber-50',   text: 'text-amber-700'   },
  dispatched:       { bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
  delivered:        { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cancelled:        { bg: 'bg-red-50',     text: 'text-red-700'     },
  rescheduled:      { bg: 'bg-violet-50',  text: 'text-violet-700'  },
  waiting_approval: { bg: 'bg-amber-50',   text: 'text-amber-700'   },
  sent_to_client:   { bg: 'bg-blue-50',    text: 'text-blue-700'    },
  dispatch_ready:   { bg: 'bg-teal-50',    text: 'text-teal-700'    },
  rework:           { bg: 'bg-orange-50',  text: 'text-orange-700'  },
  on_track: { bg: 'bg-emerald-50',  text: 'text-emerald-700'},
  delayed:  { bg: 'bg-red-50',      text: 'text-red-700'    },
  upcoming: { bg: 'bg-blue-50',     text: 'text-blue-700'   },
}


interface Props {
  status: AnyStatus
  size?: 'xs' | 'sm' | 'md'
  dot?: boolean
  showIcon?: boolean
}

export function StatusBadge({ status, size = 'sm', dot = false, showIcon }: Props) {
  const colors = allColors[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }
  const label  = LABELS[status] ?? status.replace(/_/g, ' ')

  // Default: show icon for md, hide for xs
  const shouldShowIcon = showIcon !== undefined ? showIcon : size === 'md'

  const sizeClass = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5'
    : size === 'md'
    ? 'text-xs px-3 py-1'
    : 'text-[11px] px-2 py-0.5'

  const IconComp = STATUS_ICONS[status]
  const iconSize = size === 'md' ? 11 : 10

  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full capitalize ${colors.bg} ${colors.text} ${sizeClass}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`} />}
      {shouldShowIcon && IconComp && (
        <IconComp size={iconSize} strokeWidth={2.5} aria-hidden="true" />
      )}
      {label}
    </span>
  )
}
