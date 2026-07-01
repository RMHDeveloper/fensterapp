import { useState, useRef } from 'react'
import { X, Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Task } from '../../types'
import type { UserRole } from '../../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  task: Task
  role: UserRole
  onComplete: (outcome: string, extraData: Record<string, unknown>) => void
}

export function WorkflowStatusSheet({ isOpen, onClose, task, role, onComplete }: Props) {
  const [sitePhoto, setSitePhoto]                     = useState(task.sitePhoto ?? '')
  const [measurementPhoto, setMeasurementPhoto]       = useState(task.measurementPhoto ?? '')
  const [measurementDetails, setMeasurementDetails]   = useState(task.measurementDetails ?? '')
  const [note, setNote]                               = useState('')
  const [error, setError]                             = useState('')
  const [labourName, setLabourName]                   = useState(task.labourName ?? '')
  const [installDate, setInstallDate]                 = useState(task.installationDate ?? '')
  const [quotAmount, setQuotAmount]                   = useState(task.quotationAmount ? String(task.quotationAmount) : '')
  const [quotProduct, setQuotProduct]                 = useState(task.quotationProductType ?? 'Windows and Door')
  const [quotQty, setQuotQty]                         = useState(task.quotationQuantity ? String(task.quotationQuantity) : '1')
  const [quotNotes, setQuotNotes]                     = useState('')
  const photoInputRef   = useRef<HTMLInputElement>(null)
  const measureInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const step = task.workflowStep ?? ''
  const isSiteEngineerVisit = step === 'site_visit' && role === 'site_engineer'
  const isQuotationDraft    = step === 'quotation_draft' && role === 'lead_manager'
  const isOwnerApproval     = step === 'quotation_owner_approval' && role === 'owner'
  const isSendToClient      = step === 'quotation_send_client' && role === 'lead_manager'
  const isProductionCheck   = step === 'production_check' && role === 'production_team'
  const isInstallAssign     = step === 'installation_assign' && role === 'lead_manager'
  const isInstallWork       = step === 'installation_work'

  function handleSiteComplete() {
    if (!sitePhoto) { setError('Upload site photo before completing.'); return }
    if (!measurementDetails.trim()) { setError('Add measurement details before completing.'); return }
    setError('')
    onComplete('completed', { sitePhoto, measurementPhoto, measurementDetails })
  }

  function handleQuotSendToOwner() {
    if (!quotAmount || Number(quotAmount) <= 0) { setError('Enter quotation amount.'); return }
    setError('')
    onComplete('sent_to_owner', {
      amount: Number(quotAmount),
      productType: quotProduct,
      quantity: Number(quotQty),
      notes: quotNotes,
      clientName: 'Mr. Rajesh Kumar',
      requirement: task.description ?? '',
    })
  }

  function handleLabourAssign() {
    if (!labourName.trim()) { setError('Enter labour name.'); return }
    setError('')
    onComplete('assigned', {
      labourName: labourName.trim(),
      installationDate: installDate,
      productType: task.quotationProductType ?? 'Windows and Door',
    })
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>, setter: (s: string) => void) {
    const file = e.target.files?.[0]
    if (file) setter(file.name)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-base font-extrabold text-slate-800">Update Status</h2>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 pb-8">
          {/* Task context */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{task.projectName}</p>
            <p className="text-sm font-bold text-slate-800">{task.title}</p>
            {task.workerName && (
              <p className="text-xs text-slate-500 mt-0.5">{task.workerRole}: {task.workerName}</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-600">{error}</p>
            </div>
          )}

          {/* ─── SITE ENGINEER: site visit ─── */}
          {isSiteEngineerVisit && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Site Photo *</label>
                {sitePhoto ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <CheckCircle2 size={15} className="text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700 flex-1 truncate">{sitePhoto}</span>
                    <button onClick={() => setSitePhoto('')} className="text-xs text-slate-400">✕</button>
                  </div>
                ) : (
                  <button onClick={() => photoInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-300 rounded-xl py-4 flex flex-col items-center gap-2 active:bg-slate-50">
                    <Upload size={20} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-500">Upload Site Photo</span>
                    <span className="text-xs text-slate-400">Tap to select photo</span>
                  </button>
                )}
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handlePhotoChange(e, setSitePhoto)} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Measurement Photo / File</label>
                {measurementPhoto ? (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <CheckCircle2 size={15} className="text-blue-500" />
                    <span className="text-xs font-medium text-blue-700 flex-1 truncate">{measurementPhoto}</span>
                    <button onClick={() => setMeasurementPhoto('')} className="text-xs text-slate-400">✕</button>
                  </div>
                ) : (
                  <button onClick={() => measureInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 flex items-center justify-center gap-2 active:bg-slate-50">
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-sm text-slate-400">Upload Measurement Photo (optional)</span>
                  </button>
                )}
                <input ref={measureInputRef} type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => handlePhotoChange(e, setMeasurementPhoto)} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Measurement Details *</label>
                <textarea rows={3} value={measurementDetails} onChange={e => setMeasurementDetails(e.target.value)}
                  placeholder="e.g. Window 1: 4ft × 3ft, Window 2: 5ft × 4ft, Door: 7ft × 3ft"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Note (optional)</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Any additional notes…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onComplete('pending', {})}
                  className="py-3.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 active:bg-slate-50">
                  Keep Pending
                </button>
                <button onClick={handleSiteComplete}
                  className="py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold active:bg-emerald-700">
                  Mark Completed
                </button>
              </div>
            </>
          )}

          {/* ─── LEAD MANAGER: quotation draft ─── */}
          {isQuotationDraft && (
            <>
              {task.sitePhoto && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Site Visit Data</p>
                  <p className="text-xs text-blue-700">Photo: {task.sitePhoto}</p>
                  {task.measurementDetails && <p className="text-xs text-blue-600 mt-1">Measurements: {task.measurementDetails}</p>}
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Product Type</label>
                <select value={quotProduct} onChange={e => setQuotProduct(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400">
                  <option>Windows and Door</option>
                  <option>Windows Only</option>
                  <option>Door Only</option>
                  <option>Partition</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Quantity</label>
                  <input type="number" value={quotQty} onChange={e => setQuotQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Amount (₹) *</label>
                  <input type="number" value={quotAmount} onChange={e => setQuotAmount(e.target.value)}
                    placeholder="175000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Notes (optional)</label>
                <textarea rows={2} value={quotNotes} onChange={e => setQuotNotes(e.target.value)}
                  placeholder="Any terms, conditions…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400" />
              </div>
              <button onClick={handleQuotSendToOwner}
                className="w-full py-3.5 rounded-xl bg-violet-600 text-white text-sm font-bold active:bg-violet-700">
                Send Quotation to Owner →
              </button>
            </>
          )}

          {/* ─── OWNER: quotation approval ─── */}
          {isOwnerApproval && (
            <>
              <div className="bg-violet-50 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wide">Quotation Details</p>
                {task.quotationAmount && (
                  <p className="text-xl font-extrabold text-violet-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                )}
                {task.quotationProductType && <p className="text-xs text-violet-600">Product: {task.quotationProductType}</p>}
                {task.quotationQuantity && <p className="text-xs text-violet-600">Quantity: {task.quotationQuantity} units</p>}
                <p className="text-xs text-slate-500 mt-1">{task.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onComplete('rejected', { productType: task.quotationProductType ?? '' })}
                  className="py-3.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-bold active:bg-red-50">
                  Reject
                </button>
                <button onClick={() => onComplete('approved', { amount: task.quotationAmount ?? 0, productType: task.quotationProductType ?? '' })}
                  className="py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold active:bg-emerald-700">
                  Approve ✓
                </button>
              </div>
            </>
          )}

          {/* ─── LEAD MANAGER: send to client ─── */}
          {isSendToClient && (
            <>
              <div className="bg-emerald-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide mb-1">Owner Approved</p>
                {task.quotationAmount && (
                  <p className="text-lg font-extrabold text-emerald-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                )}
                <p className="text-xs text-emerald-600">{task.quotationProductType}</p>
              </div>
              <div className="space-y-3">
                {(['pending', 'sent_to_client', 'client_approved', 'client_rejected'] as const).map(s => (
                  <button key={s} onClick={() => onComplete(s, { productType: task.quotationProductType ?? 'Windows and Door', quantity: task.quotationQuantity ?? 1, clientName: 'Mr. Rajesh Kumar' })}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold border-2 text-left px-4 ${
                      s === 'client_approved' ? 'bg-emerald-600 text-white border-emerald-600'
                      : s === 'client_rejected' ? 'border-red-200 text-red-600'
                      : 'border-slate-200 text-slate-700'
                    }`}>
                    {s === 'sent_to_client' ? 'Mark Sent to Client'
                      : s === 'client_approved' ? 'Client Approved → Move to Production'
                      : s === 'client_rejected' ? 'Client Rejected'
                      : 'Keep Pending'}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ─── PRODUCTION TEAM: check availability ─── */}
          {isProductionCheck && (
            <>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1">Product Required</p>
                <p className="text-sm font-bold text-amber-800">{task.quotationProductType ?? 'Windows and Door'}</p>
                {task.quotationQuantity && <p className="text-xs text-amber-600">Quantity: {task.quotationQuantity} units</p>}
                <p className="text-xs text-amber-600 mt-1">Project: {task.projectName}</p>
              </div>
              <div className="space-y-3">
                {[
                  { value: 'available',     label: 'Product Available', color: 'bg-emerald-600 text-white border-emerald-600' },
                  { value: 'not_available', label: 'Product Not Available', color: 'border-red-200 text-red-600' },
                  { value: 'pending',       label: 'Keep Pending', color: 'border-slate-200 text-slate-600' },
                ].map(({ value, label, color }) => (
                  <button key={value} onClick={() => onComplete(value, { productType: task.quotationProductType ?? 'Windows and Door' })}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold border-2 ${color}`}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ─── LEAD MANAGER: assign labour ─── */}
          {isInstallAssign && (
            <>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1">Product Available</p>
                <p className="text-sm font-bold text-blue-800">{task.quotationProductType}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Labour Name *</label>
                <input value={labourName} onChange={e => setLabourName(e.target.value)}
                  placeholder="e.g. Ramu & Team"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Installation Date</label>
                <input type="date" value={installDate} onChange={e => setInstallDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Note (optional)</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Instructions for labour…"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-blue-400" />
              </div>
              <button onClick={handleLabourAssign}
                className="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:bg-blue-700">
                Assign Labour →
              </button>
            </>
          )}

          {/* ─── INSTALLATION WORK ─── */}
          {isInstallWork && (
            <div className="space-y-3">
              {[
                { value: 'pending',     label: 'Keep Pending',                          color: 'border-slate-200 text-slate-600'       },
                { value: 'in_progress', label: 'Installation Started',                  color: 'border-blue-200 text-blue-600'         },
                { value: 'problem',     label: 'Problem Encountered',                   color: 'border-red-200 text-red-600'           },
                { value: 'completed',   label: 'Installation Completed — Project Finished!', color: 'bg-emerald-600 text-white border-emerald-600' },
              ].map(({ value, label, color }) => (
                <button key={value} onClick={() => onComplete(value, {})}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold border-2 ${color}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ─── FOLLOWUP / no matching step ─── */}
          {!isSiteEngineerVisit && !isQuotationDraft && !isOwnerApproval && !isSendToClient && !isProductionCheck && !isInstallAssign && !isInstallWork && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 text-center">Waiting for the assigned person to complete their work.</p>
              <button onClick={() => onComplete('pending', {})}
                className="w-full py-3.5 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
