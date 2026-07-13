import { useEffect, useState } from 'react'
import { Plus, Check, X as XIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { hasRole } from '../../utils/permissions'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { loadManagedUsers } from '../../utils/userStorage'
import {
  loadLeaveApplications,
  initLeaveApplicationsFromSupabase,
  addLeaveApplication,
  updateLeaveApplicationStatus,
} from '../../utils/leaveStorage'
import type { LeaveApplication } from '../../types'

const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400'
const lbl = 'text-xs font-semibold text-slate-500 mb-1.5 block'

export default function LeaveApplicationScreen() {
  const { user } = useAuth()
  const isTechnician = hasRole(user, 'technician') || hasRole(user, 'installation_incharge')
  const [leaves, setLeaves] = useState<LeaveApplication[]>(loadLeaveApplications())
  const [showNew, setShowNew] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' as 'success' | 'error' })

  const technicians = loadManagedUsers()
    .filter(u => u.status === 'active' && (u.role === 'technician' || u.role === 'installation_incharge'))
    .map(u => u.fullName)

  // Technicians only see and manage their own leave applications
  const visibleLeaves = isTechnician ? leaves.filter(l => l.technicianName === user?.name) : leaves

  const [techName,  setTechName]  = useState('')
  const [fromDate,  setFromDate]  = useState('')
  const [toDate,    setToDate]    = useState('')
  const [reason,    setReason]    = useState('')
  const [notes,     setNotes]     = useState('')
  const [error,     setError]     = useState('')

  useEffect(() => {
    initLeaveApplicationsFromSupabase().then(() => setLeaves(loadLeaveApplications()))
  }, [])

  function resetForm() {
    setTechName(isTechnician ? (user?.name ?? '') : ''); setFromDate(''); setToDate(''); setReason(''); setNotes(''); setError('')
  }

  function handleCreate() {
    if (!techName || !fromDate || !toDate || !reason.trim()) {
      setError('Technician, dates, and reason are required.')
      return
    }
    if (toDate < fromDate) {
      setError('Leave To Date must be on or after Leave From Date.')
      return
    }
    addLeaveApplication({
      technicianName: techName,
      fromDate, toDate,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      createdBy: user?.name ?? 'Unknown',
    })
    setLeaves(loadLeaveApplications())
    setShowNew(false)
    resetForm()
    setSnack({ open: true, msg: 'Leave application created!', type: 'success' })
  }

  function handleDecide(id: string, status: 'approved' | 'rejected') {
    updateLeaveApplicationStatus(id, status)
    setLeaves(loadLeaveApplications())
    setSnack({ open: true, msg: `Leave ${status}.`, type: 'success' })
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />

      <div className="sticky top-14 z-20 bg-white px-4 pt-3.5 pb-3.5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-base font-extrabold text-slate-800">Leave</h1>
              <p className="text-xs text-slate-500">{visibleLeaves.length} {isTechnician ? 'of your' : 'total'} application{visibleLeaves.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowNew(true) }}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl active:bg-indigo-700"
          >
            <Plus size={14} /> New Leave
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-2.5">
        {visibleLeaves.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">🗓️</p>
            <p className="text-sm">No leave applications yet</p>
          </div>
        )}
        {visibleLeaves.map(l => (
          <div key={l.id} className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">{l.technicianName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{l.fromDate} → {l.toDate}</p>
                <p className="text-xs text-slate-600 mt-1">{l.reason}</p>
                {l.notes && <p className="text-[11px] text-slate-400 mt-1">Notes: {l.notes}</p>}
                <p className="text-[11px] text-slate-400 mt-1.5">By {l.createdBy} · {l.createdAt.slice(0, 10)}</p>
              </div>
              <StatusBadge status={l.status} size="xs" />
            </div>
            {l.status === 'pending' && !isTechnician && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button onClick={() => handleDecide(l.id, 'approved')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold active:bg-emerald-100">
                  <Check size={13} /> Approve
                </button>
                <button onClick={() => handleDecide(l.id, 'rejected')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold active:bg-red-100">
                  <XIcon size={13} /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <BottomSheet isOpen={showNew} onClose={() => setShowNew(false)} title="New Leave Application" height="full">
        <div className="space-y-4">
          <div>
            <label className={lbl}>Installation Person / Technician *</label>
            {isTechnician ? (
              <div className={`${inp} bg-slate-100 text-slate-500`}>{user?.name}</div>
            ) : (
              <select value={techName} onChange={e => setTechName(e.target.value)} className={inp}>
                <option value="">Select technician…</option>
                {technicians.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Leave From Date *</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Leave To Date *</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Reason *</label>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Reason for leave…" className={`${inp} resize-none`} />
          </div>
          <div>
            <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes…" className={`${inp} resize-none`} />
          </div>
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
          <button onClick={handleCreate}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700">
            Create Leave Application
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
