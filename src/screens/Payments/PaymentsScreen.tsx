import { useState } from 'react'
import { Phone, IndianRupee } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { PaymentCard } from '../../components/cards/PaymentCard'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { Payment, PaymentStatus } from '../../types'

type Filter = 'all' | PaymentStatus

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all',         label: 'All'       },
  { value: 'pending',     label: 'Pending'   },
  { value: 'partial',     label: 'Partial'   },
  { value: 'overdue',     label: 'Overdue'   },
  { value: 'paid',        label: 'Paid'      },
]

export default function PaymentsScreen() {
  const { payments, updatePaymentAmount } = useAppData()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Payment | null>(null)
  const [showRecord, setShowRecord] = useState(false)
  const [payAmount, setPayAmount]   = useState('')
  const [payMethod, setPayMethod]   = useState('Cash')
  const [snack, setSnack] = useState({ open: false, msg: '' })

  const filtered = payments.filter(p => filter === 'all' || p.status === filter)

  const totalOutstanding = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.pending, 0)
  const overdue = payments.filter(p => p.status === 'overdue').length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center gap-2 mb-3">
          <BackButton />
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">Payments</h1>
            <p className="text-xs text-slate-500">{payments.length} projects · ₹{(totalOutstanding / 100000).toFixed(1)}L outstanding</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="text-[10px] text-indigo-500 font-medium mb-0.5">Total Outstanding</p>
            <p className="text-lg font-extrabold text-indigo-700">₹{(totalOutstanding / 100000).toFixed(1)}L</p>
          </div>
          <div className={`rounded-xl p-3 ${overdue > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
            <p className={`text-[10px] font-medium mb-0.5 ${overdue > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Overdue</p>
            <p className={`text-lg font-extrabold ${overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{overdue} projects</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CHIPS.map(c => (
            <button key={c.value} onClick={() => setFilter(c.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === c.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {filtered.map(p => (
          <div key={p.id} className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate">{p.projectName}</h3>
                <p className="text-xs text-slate-500">{p.clientName} · {p.clientPhone}</p>
              </div>
              <StatusBadge status={p.status} size="xs" />
            </div>
            <PaymentCard payment={p} onClick={() => { setSelected(p); setShowRecord(true) }} />
          </div>
        ))}
      </div>

      {/* Record Payment Sheet */}
      <BottomSheet isOpen={showRecord && !!selected} onClose={() => { setShowRecord(false); setSelected(null) }} title={`Record Payment — ${selected?.projectName ?? ''}`}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-400">Balance Due</span>
                <span className="text-base font-extrabold text-red-600">₹{(selected.pending / 1000).toFixed(0)}K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Client</span>
                <span className="text-xs font-semibold text-slate-700">{selected.clientName}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Amount Received (₹) *</label>
              <input type="number" placeholder="Enter amount" value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {['Cash', 'UPI', 'Cheque', 'NEFT', 'Card'].map(method => (
                  <button key={method} onClick={() => setPayMethod(method)}
                    className={`py-2 rounded-xl border text-xs font-semibold transition-colors ${payMethod === method ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 active:bg-indigo-50'}`}>
                    {method}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Reference / Cheque No. (optional)</label>
              <input placeholder="e.g. UTR12345 or CHQ001"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <PermissionGate permission="update_payments">
              <button
                onClick={() => {
                  if (selected && payAmount) {
                    updatePaymentAmount(selected.id, Number(payAmount), payMethod)
                    setPayAmount('')
                  }
                  setShowRecord(false)
                  setSelected(null)
                  setSnack({ open: true, msg: 'Payment recorded successfully!' })
                }}
                className="w-full rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 bg-emerald-600 text-white active:bg-emerald-700"
              >
                <IndianRupee size={15} aria-hidden="true" /> Record Payment
              </button>
            </PermissionGate>
            <a href={`tel:${selected.clientPhone}`}
              className="w-full flex items-center justify-center gap-2 border border-teal-200 text-teal-600 rounded-xl py-3 text-sm font-semibold active:bg-teal-50">
              <Phone size={14} /> Call {selected.clientName.split(' ')[0]}
            </a>
          </div>
        )}
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
