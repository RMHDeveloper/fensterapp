import { useState } from 'react'
import { Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react'
import { QUOTATIONS } from '../../data/mockData'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { Quotation, QuotationStatus } from '../../types'

type Filter = 'all' | QuotationStatus

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'waiting_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent_to_client', label: 'Sent' },
  { value: 'converted', label: 'Converted' },
]

const ACTION_ICON: Record<string, JSX.Element> = {
  draft:            <Clock size={14} className="text-slate-400" />,
  waiting_approval: <Clock size={14} className="text-amber-500" />,
  approved:         <CheckCircle size={14} className="text-emerald-500" />,
  rejected:         <XCircle size={14} className="text-red-500" />,
  sent_to_client:   <FileText size={14} className="text-blue-500" />,
  converted:        <CheckCircle size={14} className="text-teal-500" />,
}

export default function QuotationsScreen() {
  const [filter, setFilter]     = useState<Filter>('all')
  const [selected, setSelected] = useState<Quotation | null>(null)
  const [showNew, setShowNew]   = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [newProject, setNewProject] = useState('')
  const [submitError, setSubmitError] = useState<string | undefined>()
  const [snack, setSnack]       = useState({ open: false, msg: '' })

  function handleSubmitForApproval() {
    if (!selected) return
    // Validate: quotation amount must be present (it's already set on the quotation)
    if (!selected.totalAmount) {
      setSubmitError('Add quotation amount before sending to Owner.')
      return
    }
    setSubmitError(undefined)
    setSelected(null)
    setSnack({ open: true, msg: 'Submitted for Owner approval!' })
  }

  function handleCreateQuotation() {
    if (!newProject.trim()) {
      setSubmitError('Select a project before creating quotation.')
      return
    }
    if (!newAmount.trim() || isNaN(Number(newAmount))) {
      setSubmitError('Add quotation amount before creating.')
      return
    }
    setSubmitError(undefined)
    setNewProject('')
    setNewAmount('')
    setShowNew(false)
    setSnack({ open: true, msg: 'Quotation created!' })
  }

  const filtered = QUOTATIONS.filter(q => filter === 'all' || q.status === filter)

  const totalValue = QUOTATIONS.reduce((s, q) => s + q.totalAmount, 0)
  const approved   = QUOTATIONS.filter(q => q.status === 'approved' || q.status === 'converted').length

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Quotations</h1>
              <p className="text-xs text-slate-500">{QUOTATIONS.length} total · ₹{(totalValue / 100000).toFixed(1)}L · {approved} approved</p>
            </div>
          </div>
          <PermissionGate permission="create_quotation">
            <button onClick={() => setShowNew(true)}
              className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-fab active:bg-indigo-700"
              aria-label="Create new quotation">
              <Plus size={19} className="text-white" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </PermissionGate>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 my-3">
          {[
            { label: 'Pending', value: QUOTATIONS.filter(q => q.status === 'waiting_approval').length, color: 'text-amber-600' },
            { label: 'Approved', value: approved, color: 'text-emerald-600' },
            { label: 'Rejected', value: QUOTATIONS.filter(q => q.status === 'rejected').length, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-50 rounded-xl py-2 text-center">
              <p className={`text-base font-extrabold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-400 font-medium">{label}</p>
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
        {filtered.map(q => (
          <button key={q.id} onClick={() => setSelected(q)}
            className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 active:scale-[0.98] transition-transform">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {ACTION_ICON[q.status] ?? <FileText size={14} className="text-slate-400" />}
                  <span className="text-[11px] font-semibold text-slate-500">{q.quotationNumber}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 truncate">{q.projectName}</h3>
                <p className="text-xs text-slate-500">{q.clientName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-extrabold text-indigo-700">₹{(q.totalAmount / 1000).toFixed(0)}K</p>
                <StatusBadge status={q.status} size="xs" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              <span>📅 {q.createdAt}</span>
              {q.validityDate && <span>⏳ Valid till {q.validityDate}</span>}
              <span className="ml-auto">{q.preparedBy}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.quotationNumber ?? ''} height="full">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={selected.status} size="md" />
              <p className="text-xl font-extrabold text-indigo-700">₹{(selected.totalAmount / 1000).toFixed(0)}K</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Project',   value: selected.projectName },
                { label: 'Client',    value: selected.clientName },
                { label: 'Product',   value: selected.productType },
                { label: 'Created',   value: selected.createdAt },
                { label: 'Valid till',value: selected.validityDate ?? '—' },
                { label: 'Prepared',  value: selected.preparedBy },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>

            {selected.status === 'draft' && (
              <div className="space-y-3">
                {submitError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <span className="text-red-500 text-xs font-bold">!</span>
                    <p className="text-xs font-semibold text-red-600">{submitError}</p>
                  </div>
                )}
                <button
                  onClick={handleSubmitForApproval}
                  className="w-full bg-amber-500 text-white rounded-xl py-3.5 text-sm font-bold active:bg-amber-600">
                  Submit for Owner Approval
                </button>
              </div>
            )}
            {selected.status === 'waiting_approval' && (
              <PermissionGate permission="approve_quotation">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Quotation approved!' }) }}
                    className="rounded-xl py-3.5 text-sm font-bold bg-emerald-600 text-white active:bg-emerald-700">
                    Approve
                  </button>
                  <button
                    onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Quotation rejected.' }) }}
                    className="rounded-xl py-3.5 text-sm font-bold border bg-red-50 text-red-600 border-red-200 active:bg-red-100">
                    Reject
                  </button>
                </div>
              </PermissionGate>
            )}
            {selected.status === 'approved' && (
              <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Quotation sent to client!' }) }}
                className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700">
                Send to Client
              </button>
            )}
            {selected.status === 'sent_to_client' && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Order confirmed!' }) }}
                  className="bg-emerald-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-emerald-700">
                  Client Accepted
                </button>
                <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'Marked as lost.' }) }}
                  className="bg-red-50 text-red-600 rounded-xl py-3.5 text-sm font-bold border border-red-200 active:bg-red-100">
                  Client Rejected
                </button>
              </div>
            )}
            <button className="w-full border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-semibold active:bg-slate-50">
              Download PDF
            </button>
          </div>
        )}
      </BottomSheet>

      {/* New Quotation Sheet */}
      <BottomSheet isOpen={showNew} onClose={() => { setShowNew(false); setSubmitError(undefined) }} title="Create Quotation" height="full">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
              Project <span className="text-red-500">*</span>
            </label>
            <input
              value={newProject}
              onChange={e => { setNewProject(e.target.value); setSubmitError(undefined) }}
              placeholder="Select project"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Product Type</label>
            <input placeholder="e.g. UPVC Windows"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
              Total Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={newAmount}
              onChange={e => { setNewAmount(e.target.value); setSubmitError(undefined) }}
              placeholder="150000"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Validity (days)</label>
            <input placeholder="30"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
              Upload PDF <span className="text-slate-300 font-normal">(optional)</span>
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl py-5 flex flex-col items-center gap-2">
              <FileText size={24} className="text-slate-300" />
              <span className="text-xs text-slate-400">Tap to attach quotation PDF</span>
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span className="text-red-500 text-xs font-bold">!</span>
              <p className="text-xs font-semibold text-red-600">{submitError}</p>
            </div>
          )}

          <button
            onClick={handleCreateQuotation}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700">
            Create Quotation
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
