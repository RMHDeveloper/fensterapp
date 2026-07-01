import { Check, X } from 'lucide-react'
import type { Approval } from '../../types'

interface Props {
  approval: Approval
  onApprove?: () => void
  onDeny?: () => void
}

export function ApprovalCard({ approval, onApprove, onDeny }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 w-52 flex-shrink-0">
      {/* Icon + Title */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
          {approval.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-800 leading-snug">{approval.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{approval.meta}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white rounded-xl py-2 text-xs font-bold active:bg-blue-700"
        >
          <Check size={12} strokeWidth={2.5} />
          Approve
        </button>
        <button
          onClick={onDeny}
          className="flex-1 flex items-center justify-center gap-1 border border-slate-200 text-slate-500 rounded-xl py-2 text-xs font-semibold active:bg-slate-50"
        >
          <X size={12} strokeWidth={2.5} />
          Deny
        </button>
      </div>
    </div>
  )
}
