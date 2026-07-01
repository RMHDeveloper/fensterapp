import { Phone, Calendar, AlertCircle } from 'lucide-react'
import { StatusBadge } from '../badges/StatusBadge'
import type { Payment } from '../../types'

interface Props {
  payment: Payment
  onClick?: () => void
}

export function PaymentCard({ payment, onClick }: Props) {
  const pct = Math.round((payment.received / payment.totalAmount) * 100)
  const isOverdue = payment.status === 'overdue'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl shadow-card border active:scale-[0.98] transition-transform p-4 ${isOverdue ? 'border-red-200' : 'border-slate-100'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 truncate">{payment.projectName}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{payment.clientName}</p>
        </div>
        <StatusBadge status={payment.status} size="xs" />
      </div>

      {/* Amount breakdown */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-slate-50 rounded-xl p-2 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">Total</p>
          <p className="text-xs font-bold text-slate-700">₹{(payment.totalAmount / 1000).toFixed(0)}K</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-2 text-center">
          <p className="text-[10px] text-emerald-600 mb-0.5">Received</p>
          <p className="text-xs font-bold text-emerald-700">₹{(payment.received / 1000).toFixed(0)}K</p>
        </div>
        <div className={`rounded-xl p-2 text-center ${isOverdue ? 'bg-red-50' : 'bg-amber-50'}`}>
          <p className={`text-[10px] mb-0.5 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>Pending</p>
          <p className={`text-xs font-bold ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>₹{(payment.pending / 1000).toFixed(0)}K</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-400">{pct}% received</span>
          <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            {isOverdue && <AlertCircle size={10} />}
            <Calendar size={10} />
            {payment.dueDate}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <a href={`tel:${payment.clientPhone}`} onClick={e => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 rounded-xl py-2 text-xs font-medium text-slate-600 active:bg-slate-200">
          <Phone size={13} /> Call
        </a>
        <button onClick={onClick} className="flex-1 bg-blue-600 rounded-xl py-2 text-xs font-semibold text-white active:bg-blue-700">
          Record Payment
        </button>
      </div>
    </button>
  )
}
