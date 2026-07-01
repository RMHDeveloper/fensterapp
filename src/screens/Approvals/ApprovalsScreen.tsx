import { useNavigate } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { Snackbar } from '../../components/feedback/Snackbar'
import { useState } from 'react'
import type { TaskStatus } from '../../types'

export default function ApprovalsScreen() {
  const navigate = useNavigate()
  const { tasks, updateTaskStatus, completeWorkflowStep } = useAppData()
  const { user } = useAuth()
  const [snack, setSnack] = useState({ open: false, msg: '' })

  const approvalTasks = tasks.filter(t =>
    t.workflowStep === 'quotation_owner_approval' && t.status !== 'completed' && t.status !== 'overdue'
  )

  function handleApprove(taskId: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    completeWorkflowStep(task, 'approved', {
      amount: task.quotationAmount ?? 0,
      productType: task.quotationProductType ?? '',
    })
    updateTaskStatus(taskId, 'completed' as TaskStatus)
    setSnack({ open: true, msg: 'Quotation approved! LM has been notified.' })
  }

  function handleReject(taskId: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    completeWorkflowStep(task, 'rejected', {
      productType: task.quotationProductType ?? '',
    })
    updateTaskStatus(taskId, 'overdue' as TaskStatus)
    setSnack({ open: true, msg: 'Quotation rejected. LM has been notified.' })
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />

      <div className="px-4 pt-4 space-y-3">
        <h2 className="text-base font-extrabold text-slate-800 mb-3">Pending Approvals</h2>

        {approvalTasks.length === 0 && (
          <div className="mt-10 text-center">
            <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-700 mb-2">No Pending Approvals</h3>
            <p className="text-sm text-slate-400">All quotations have been reviewed.</p>
          </div>
        )}

        {approvalTasks.map(task => (
          <div key={task.id}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div>
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-1">{task.projectName}</p>
              <h3 className="text-sm font-extrabold text-slate-800">{task.title}</h3>
              {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
            </div>

            {task.quotationAmount && (
              <div className="bg-violet-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-violet-400 font-semibold uppercase">Amount</p>
                  <p className="text-xl font-extrabold text-violet-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  {task.quotationProductType && (
                    <p className="text-xs text-violet-600">{task.quotationProductType}</p>
                  )}
                  {task.quotationQuantity && (
                    <p className="text-xs text-violet-500">{task.quotationQuantity} units</p>
                  )}
                </div>
              </div>
            )}

            <button onClick={() => navigate(`/task/${task.id}`)}
              className="text-xs text-blue-500 font-semibold">
              View Full Details →
            </button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button onClick={() => handleReject(task.id)}
                className="py-3 rounded-xl border-2 border-red-200 text-red-600 text-sm font-bold active:bg-red-50">
                Reject
              </button>
              <button onClick={() => handleApprove(task.id)}
                className="py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold active:bg-emerald-700">
                Approve ✓
              </button>
            </div>
          </div>
        ))}
      </div>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success"
        onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
