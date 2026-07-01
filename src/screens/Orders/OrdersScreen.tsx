import { useState } from 'react'
import { ShoppingBag, IndianRupee, Calendar } from 'lucide-react'
import { ORDERS } from '../../data/mockData'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { Order, OrderStatus } from '../../types'

type Filter = 'all' | OrderStatus

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all',         label: 'All'       },
  { value: 'confirmed',   label: 'Confirmed' },
  { value: 'in_production', label: 'In Prod' },
  { value: 'dispatched',  label: 'Dispatched'},
  { value: 'delivered',   label: 'Delivered' },
  { value: 'cancelled',   label: 'Cancelled' },
]

export default function OrdersScreen() {
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Order | null>(null)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  const filtered = ORDERS.filter(o => filter === 'all' || o.status === filter)

  const totalValue = ORDERS.reduce((s, o) => s + o.orderValue, 0)
  const pending = ORDERS.filter(o => o.balanceAmount > 0).length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center gap-2 mb-3">
          <BackButton />
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">Orders</h1>
            <p className="text-xs text-slate-500">{ORDERS.length} orders · ₹{(totalValue / 100000).toFixed(1)}L · {pending} pending payment</p>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Confirmed',     value: ORDERS.filter(o => o.status === 'confirmed').length,     color: 'text-indigo-600' },
            { label: 'In Production', value: ORDERS.filter(o => o.status === 'in_production').length, color: 'text-amber-600' },
            { label: 'Delivered',     value: ORDERS.filter(o => o.status === 'delivered').length,     color: 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-50 rounded-xl py-2 text-center">
              <p className={`text-base font-extrabold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-400">{label}</p>
            </div>
          ))}
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

      <div className="px-4 pt-4 space-y-2.5">
        {filtered.map(order => (
          <button key={order.id} onClick={() => setSelected(order)}
            className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 active:scale-[0.98] transition-transform">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingBag size={13} className="text-indigo-400" />
                  <span className="text-[11px] font-semibold text-slate-500">{order.orderNumber}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 truncate">{order.projectName}</h3>
                <p className="text-xs text-slate-500">{order.clientName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-extrabold text-indigo-700">₹{(order.orderValue / 1000).toFixed(0)}K</p>
                <StatusBadge status={order.status} size="xs" />
              </div>
            </div>

            {/* Payment progress */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Advance: ₹{(order.advanceAmount / 1000).toFixed(0)}K</span>
                <span className={order.balanceAmount > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                  Balance: ₹{(order.balanceAmount / 1000).toFixed(0)}K
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(order.advanceAmount / order.orderValue) * 100}%` }} />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-400">
              <Calendar size={11} />
              <span>Delivery: {order.expectedDelivery}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Order Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.orderNumber ?? ''} height="full">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={selected.status} size="md" />
              <p className="text-xl font-extrabold text-indigo-700">₹{(selected.orderValue / 1000).toFixed(0)}K</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Project',   value: selected.projectName },
                { label: 'Client',    value: selected.clientName },
                { label: 'Confirmed', value: selected.confirmedAt },
                { label: 'Delivery',  value: selected.expectedDelivery },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>

            {/* Payment breakdown */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment</p>
              {[
                { label: 'Order Value', value: selected.orderValue, color: 'text-slate-700' },
                { label: 'Advance Paid', value: selected.advanceAmount, color: 'text-emerald-600' },
                { label: 'Balance Due', value: selected.balanceAmount, color: selected.balanceAmount > 0 ? 'text-red-600' : 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className={`text-xs font-bold ${color}`}>₹{(value / 1000).toFixed(0)}K</span>
                </div>
              ))}
              <div className="h-px bg-slate-100 my-1" />
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(selected.advanceAmount / selected.orderValue) * 100}%` }} />
              </div>
            </div>

            {/* Order items */}
            {selected.items.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-2">
                  {selected.items.map(item => (
                    <div key={item.id} className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{item.description}</p>
                        <p className="text-[10px] text-slate-400">Qty: {item.quantity} · {item.unit}</p>
                      </div>
                      <p className="text-xs font-bold text-indigo-700">₹{(item.amount / 1000).toFixed(0)}K</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Production released!' }) }}
                className="bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold active:bg-indigo-700">
                Release to Prod
              </button>
              <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Payment recorded!' }) }}
                className="border border-emerald-500 text-emerald-600 rounded-xl py-3 text-sm font-bold active:bg-emerald-50">
                Record Payment
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
