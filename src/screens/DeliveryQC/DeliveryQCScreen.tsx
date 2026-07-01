import { useState } from 'react'
import { CheckCircle2, XCircle, Camera, Plus } from 'lucide-react'
import { ORDERS } from '../../data/mockData'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'

interface QCItem {
  id: string
  check: string
  passed: boolean | null
}

const CHECKLIST_TEMPLATE: Omit<QCItem, 'passed'>[] = [
  { id: 'c1', check: 'Frame dimensions correct' },
  { id: 'c2', check: 'Glass quality OK - no scratches' },
  { id: 'c3', check: 'Hardware installed correctly' },
  { id: 'c4', check: 'Surface finish OK' },
  { id: 'c5', check: 'Sealing done properly' },
  { id: 'c6', check: 'All items packed securely' },
]

interface QCSession {
  orderId: string
  orderName: string
  clientName: string
  items: QCItem[]
}

export default function DeliveryQCScreen() {
  const [selected, setSelected] = useState<QCSession | null>(null)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  const dispatched = ORDERS.filter(o => o.status === 'dispatched' || o.status === 'in_production')

  const startQC = (orderId: string, projectName: string, clientName: string) => {
    setSelected({
      orderId,
      orderName: projectName,
      clientName,
      items: CHECKLIST_TEMPLATE.map(t => ({ ...t, passed: null })),
    })
  }

  const toggle = (itemId: string, passed: boolean) => {
    setSelected(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, passed: i.passed === passed ? null : passed } : i),
    } : null)
  }

  const allChecked = selected?.items.every(i => i.passed !== null) ?? false
  const passedAll  = selected?.items.every(i => i.passed === true) ?? false

  const handleComplete = () => {
    setSelected(null)
    setSnack({ open: true, msg: passedAll ? 'QC Passed! Ready to dispatch.' : 'QC Failed — issues logged.' })
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <BackButton />
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">Delivery QC</h1>
            <p className="text-xs text-slate-500">{dispatched.length} orders ready for QC</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mx-4 mt-4 bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
        <p className="text-xs font-bold text-indigo-700 mb-1">How it works</p>
        <p className="text-xs text-indigo-600 leading-relaxed">Select an order below and complete the QC checklist before dispatching. All passes must be confirmed.</p>
      </div>

      <div className="px-4 pt-4 space-y-2.5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Orders Awaiting QC</p>
        {dispatched.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-8 text-center">
            <CheckCircle2 size={32} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No orders awaiting QC</p>
          </div>
        ) : (
          dispatched.map(order => (
            <div key={order.id} className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400">{order.orderNumber}</span>
                  <h3 className="text-sm font-bold text-slate-800">{order.projectName}</h3>
                  <p className="text-xs text-slate-500">{order.clientName}</p>
                </div>
                <StatusBadge status={order.status} size="xs" />
              </div>
              <button onClick={() => startQC(order.id, order.projectName, order.clientName)}
                className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-xs font-bold active:bg-indigo-700 flex items-center justify-center gap-1.5">
                <Plus size={14} /> Start QC Inspection
              </button>
            </div>
          ))
        )}
      </div>

      {/* QC Checklist Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={`QC: ${selected?.orderName ?? ''}`} height="full">
        {selected && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Client: <span className="font-semibold text-slate-700">{selected.clientName}</span></p>

            <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
              {selected.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-3">
                  <span className="flex-1 text-xs font-medium text-slate-700">{item.check}</span>
                  <div className="flex gap-2">
                    <button onClick={() => toggle(item.id, true)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${item.passed === true ? 'bg-emerald-500' : 'bg-slate-100'}`}>
                      <CheckCircle2 size={15} className={item.passed === true ? 'text-white' : 'text-slate-300'} />
                    </button>
                    <button onClick={() => toggle(item.id, false)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${item.passed === false ? 'bg-red-500' : 'bg-slate-100'}`}>
                      <XCircle size={15} className={item.passed === false ? 'text-white' : 'text-slate-300'} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Photo upload */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">QC Photos</p>
              <button className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 flex flex-col items-center gap-2 active:bg-slate-50">
                <Camera size={22} className="text-slate-300" />
                <span className="text-xs text-slate-400">Take / upload QC photos</span>
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes (optional)</label>
              <textarea rows={3} placeholder="Any QC remarks…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
            </div>

            {/* Progress indicator */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{selected.items.filter(i => i.passed !== null).length}/{selected.items.length} checked</span>
                <span className={`font-semibold ${passedAll ? 'text-emerald-600' : selected.items.some(i => i.passed === false) ? 'text-red-600' : 'text-slate-400'}`}>
                  {passedAll ? 'All passed ✓' : selected.items.some(i => i.passed === false) ? 'Issues found' : 'In progress'}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${(selected.items.filter(i => i.passed !== null).length / selected.items.length) * 100}%`,
                  backgroundColor: passedAll ? '#10b981' : selected.items.some(i => i.passed === false) ? '#ef4444' : '#6366f1',
                }} />
              </div>
            </div>

            <PermissionGate permission="update_qc">
              <button onClick={handleComplete} disabled={!allChecked}
                className={`w-full rounded-xl py-3.5 text-sm font-bold transition-opacity ${allChecked ? 'bg-indigo-600 text-white active:bg-indigo-700' : 'bg-slate-200 text-slate-400'}`}>
                Complete QC Inspection
              </button>
            </PermissionGate>
          </div>
        )}
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
