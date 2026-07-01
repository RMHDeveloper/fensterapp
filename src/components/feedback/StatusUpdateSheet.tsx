import { useState, useEffect } from 'react'
import {
  CheckCircle2, Clock, Play, AlertTriangle, XCircle,
  Send, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import type { ProofType, UserRole } from '../../types'
import { BottomSheet } from './BottomSheet'
import { FileUploadField } from '../forms/FileUploadField'
import { validateTaskCompletion, needsProofForStatus } from '../../utils/taskValidation'

type StatusOption = {
  value: string
  label: string
  description: string
  icon: ComponentType<LucideProps>
  color: string
  textColor: string
  borderColor: string
}

const STATUS_OPTIONS: Record<string, StatusOption> = {
  // Core
  not_started:    { value: 'not_started',    label: 'Not Started',        description: 'Work has not started yet',          icon: Clock,         color: 'bg-slate-50',    textColor: 'text-slate-700',   borderColor: 'border-slate-200'   },
  in_progress:    { value: 'in_progress',    label: 'In Progress',        description: 'Work is currently going on',        icon: Play,          color: 'bg-blue-50',     textColor: 'text-blue-700',    borderColor: 'border-blue-200'    },
  waiting:        { value: 'waiting',        label: 'Waiting',            description: 'On hold, waiting for something',    icon: Clock,         color: 'bg-amber-50',    textColor: 'text-amber-700',   borderColor: 'border-amber-200'   },
  completed:      { value: 'completed',      label: 'Completed',          description: 'Work done successfully',            icon: CheckCircle2,  color: 'bg-emerald-50',  textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  rework:         { value: 'rework',         label: 'Rework',             description: 'Needs to be redone',               icon: AlertTriangle, color: 'bg-yellow-50',   textColor: 'text-yellow-700',  borderColor: 'border-yellow-200'  },
  dropped:        { value: 'dropped',        label: 'Dropped',            description: 'Task cancelled or no longer needed',icon: XCircle,       color: 'bg-red-50',      textColor: 'text-red-700',     borderColor: 'border-red-200'     },
  // Site visit / measurement
  waiting_client: { value: 'waiting_client', label: 'Waiting for Client', description: 'Waiting on client action',          icon: Clock,         color: 'bg-orange-50',   textColor: 'text-orange-700',  borderColor: 'border-orange-200'  },
  revisit_needed: { value: 'revisit_needed', label: 'Revisit Required',   description: 'Another visit is needed',          icon: AlertTriangle, color: 'bg-orange-50',   textColor: 'text-orange-700',  borderColor: 'border-orange-200'  },
  problem:        { value: 'problem',        label: 'Problem',            description: 'Blocked or needs help',            icon: XCircle,       color: 'bg-rose-50',     textColor: 'text-rose-700',    borderColor: 'border-rose-200'    },
  // Lead CRM
  new:            { value: 'new',            label: 'New',                description: 'New lead, not contacted yet',       icon: Clock,         color: 'bg-slate-50',    textColor: 'text-slate-700',   borderColor: 'border-slate-200'   },
  contacted:      { value: 'contacted',      label: 'Contacted',          description: 'Lead has been reached out to',      icon: Play,          color: 'bg-blue-50',     textColor: 'text-blue-700',    borderColor: 'border-blue-200'    },
  qualified:      { value: 'qualified',      label: 'Qualified',          description: 'Lead is a real opportunity',        icon: Play,          color: 'bg-cyan-50',     textColor: 'text-cyan-700',    borderColor: 'border-cyan-200'    },
  proposal:       { value: 'proposal',       label: 'Proposal',           description: 'Proposal sent or in discussion',    icon: Send,          color: 'bg-violet-50',   textColor: 'text-violet-700',  borderColor: 'border-violet-200'  },
  won:            { value: 'won',            label: 'Won',                description: 'Lead converted to order',           icon: CheckCircle2,  color: 'bg-emerald-50',  textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  lost:           { value: 'lost',           label: 'Lost',               description: 'Lead did not convert',             icon: XCircle,       color: 'bg-red-50',      textColor: 'text-red-700',     borderColor: 'border-red-200'     },
  // Quotation
  draft:             { value: 'draft',             label: 'Draft',             description: 'Still being prepared',              icon: Clock,         color: 'bg-slate-50',    textColor: 'text-slate-700',   borderColor: 'border-slate-200'   },
  waiting_approval:  { value: 'waiting_approval',  label: 'Sent to Owner',     description: 'Waiting for Owner approval',        icon: Send,          color: 'bg-violet-50',   textColor: 'text-violet-700',  borderColor: 'border-violet-200'  },
  approved:          { value: 'approved',          label: 'Owner Approved',    description: 'Owner has approved this',           icon: ThumbsUp,      color: 'bg-emerald-50',  textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  rejected:          { value: 'rejected',          label: 'Owner Rejected',    description: 'Owner has rejected this',           icon: ThumbsDown,    color: 'bg-red-50',      textColor: 'text-red-700',     borderColor: 'border-red-200'     },
  sent_to_client:    { value: 'sent_to_client',    label: 'Sent to Client',    description: 'Client received quotation',         icon: Send,          color: 'bg-blue-50',     textColor: 'text-blue-700',    borderColor: 'border-blue-200'    },
  client_approved:   { value: 'client_approved',   label: 'Client Approved',   description: 'Client accepted the quotation',     icon: ThumbsUp,      color: 'bg-emerald-50',  textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  client_rejected:   { value: 'client_rejected',   label: 'Client Rejected',   description: 'Client rejected the quotation',     icon: ThumbsDown,    color: 'bg-red-50',      textColor: 'text-red-700',     borderColor: 'border-red-200'     },
  // Production
  delayed:           { value: 'delayed',           label: 'Delayed',           description: 'Work is running late',              icon: AlertTriangle, color: 'bg-red-50',      textColor: 'text-red-700',     borderColor: 'border-red-200'     },
  // Payment
  pending:           { value: 'pending',           label: 'Pending',           description: 'Payment not yet received',          icon: Clock,         color: 'bg-slate-50',    textColor: 'text-slate-700',   borderColor: 'border-slate-200'   },
  part_paid:         { value: 'part_paid',         label: 'Part Paid',         description: 'Partial payment received',          icon: CheckCircle2,  color: 'bg-amber-50',    textColor: 'text-amber-700',   borderColor: 'border-amber-200'   },
  overdue:           { value: 'overdue',           label: 'Overdue',           description: 'Payment is past due date',          icon: AlertTriangle, color: 'bg-red-50',      textColor: 'text-red-700',     borderColor: 'border-red-200'     },
}

const PROOF_LABEL: Partial<Record<ProofType, string>> = {
  site_photo:        'Site Photo',
  measurement_photo: 'Measurement Photo',
  production_photo:  'Production Photo',
  quotation_details: 'Quotation File',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (status: string, note: string, proofFiles: string[]) => void
  taskTitle: string
  taskMeta?: string
  currentStatus: string
  allowedStatuses: string[]
  requiredProofType?: ProofType
  role?: UserRole
  canAddNote?: boolean
}

export function StatusUpdateSheet({
  isOpen,
  onClose,
  onSave,
  taskTitle,
  taskMeta,
  currentStatus,
  allowedStatuses,
  requiredProofType,
  role = 'viewer',
  canAddNote = true,
}: Props) {
  const [selected, setSelected]         = useState(currentStatus)
  const [note, setNote]                 = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [proofError, setProofError]     = useState<string | undefined>()

  // Reset local state whenever sheet opens
  useEffect(() => {
    if (isOpen) {
      setSelected(currentStatus)
      setNote('')
      setUploadedFiles([])
      setProofError(undefined)
    }
  }, [isOpen, currentStatus])

  // Clear proof error when a file is uploaded
  function handleFileAdded(fileName: string) {
    setUploadedFiles([fileName])
    setProofError(undefined)
  }

  // Clear proof error when status changes away from completion
  function handleStatusSelect(value: string) {
    setSelected(value)
    if (!needsProofForStatus(requiredProofType, value)) {
      setProofError(undefined)
    }
  }

  function handleSave() {
    const result = validateTaskCompletion(requiredProofType, selected, uploadedFiles, role)
    if (!result.isValid) {
      setProofError(result.errors.proof ?? result.errors.status)
      return
    }
    onSave(selected, note, uploadedFiles)
    onClose()
  }

  const options = allowedStatuses.map(s => STATUS_OPTIONS[s]).filter((o): o is StatusOption => !!o)
  const showProof = needsProofForStatus(requiredProofType, selected) && requiredProofType !== 'approval_action'
  const proofLabel = requiredProofType ? (PROOF_LABEL[requiredProofType] ?? 'Work Photo') : 'Work Photo'

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Update Status" height="full">
      <div className="space-y-4">
        {/* Task info */}
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-sm font-bold text-slate-800">{taskTitle}</p>
          {taskMeta && <p className="text-xs text-slate-500 mt-0.5">{taskMeta}</p>}
        </div>

        {/* Status buttons */}
        <div className="space-y-2.5">
          {options.map(opt => {
            const Icon       = opt.icon
            const isSelected = selected === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleStatusSelect(opt.value)}
                className={[
                  'w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 text-left transition-all duration-150 min-h-[68px]',
                  isSelected
                    ? `${opt.color} ${opt.borderColor} shadow-sm`
                    : 'bg-white border-slate-100 active:bg-slate-50',
                ].join(' ')}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? opt.color : 'bg-slate-100'}`}>
                  <Icon size={20} className={isSelected ? opt.textColor : 'text-slate-400'} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${isSelected ? opt.textColor : 'text-slate-800'}`}>{opt.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Required proof section — only shown when completing */}
        {showProof && (
          <div className="bg-slate-50 rounded-2xl p-4 space-y-1">
            <FileUploadField
              label={proofLabel}
              required
              uploadedFiles={uploadedFiles}
              onFileSelected={handleFileAdded}
              error={proofError}
            />
          </div>
        )}

        {/* General proof error (not tied to a specific field) */}
        {proofError && !showProof && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v4M5 8v.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-xs font-semibold text-red-600">{proofError}</p>
          </div>
        )}

        {/* Optional note */}
        {canAddNote && (
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
              Add a note <span className="text-slate-300">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Write any notes or reason here…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white rounded-xl py-4 text-base font-bold active:bg-blue-700 min-h-[52px]"
        >
          Save Status
        </button>
      </div>
    </BottomSheet>
  )
}
