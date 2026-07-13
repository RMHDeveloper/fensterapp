import { useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { MapPin, CheckCircle2 } from 'lucide-react'
import type { Task } from '../../types'

export default function ApprovalsScreen() {
  const { tasks, projects, leads, updateTask } = useAppData()
  const [flowTaskId, setFlowTaskId] = useState<string | null>(null)

  // The real, live pending-approval set — driven by the same flowStage the
  // rest of the app uses, not the legacy workflowStep field this screen used
  // to filter on (which no task has set anymore, so it always showed empty).
  const approvalTasks = tasks.filter(t => t.flowStage === 'owner_approval' && t.flowStatus !== 'rejected')
  const flowTask = flowTaskId ? (tasks.find(t => t.id === flowTaskId) ?? null) : null

  function leadOwnerFor(task: Task): string {
    const proj = projects.find(p => p.id === task.projectId)
    if (proj?.leadId) {
      const lead = leads.find(l => l.id === proj.leadId)
      if (lead?.assignee) return lead.assignee
    }
    return proj?.ownerName || task.assignee || '—'
  }

  function uploadedAt(task: Task): string | undefined {
    return [...(task.statusHistory ?? [])].reverse()
      .find(h => h.stage === 'site_review' && h.status === 'completed')?.updatedAt
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />

      <div className="px-4 pt-4 space-y-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Approvals</h2>
          <p className="text-xs text-slate-400 mt-0.5">{approvalTasks.length} quotation{approvalTasks.length !== 1 ? 's' : ''} waiting for your review</p>
        </div>

        {approvalTasks.length === 0 && (
          <div className="mt-10 text-center">
            <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} className="text-violet-400" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-700 mb-2">No Pending Approvals</h3>
            <p className="text-sm text-slate-400">All quotations have been reviewed.</p>
          </div>
        )}

        {approvalTasks.map(task => {
          const uploaded = uploadedAt(task)
          return (
            <button key={task.id} onClick={() => setFlowTaskId(task.id)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 active:bg-slate-50">
              <div>
                {task.projectName && (
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-1">{task.projectName}</p>
                )}
                <h3 className="text-sm font-extrabold text-slate-800">{task.clientName ?? task.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Lead Owner: {leadOwnerFor(task)}</p>
              </div>

              {task.quotationAmount != null && (
                <div className="bg-violet-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-violet-400 font-semibold uppercase">Quotation Amount</p>
                    <p className="text-xl font-extrabold text-violet-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                    {task.quotationProductType && <p className="text-xs text-violet-500 mt-0.5">{task.quotationProductType}</p>}
                  </div>
                  {uploaded && (
                    <p className="text-[10px] text-violet-400 text-right flex-shrink-0">
                      Uploaded<br />
                      {new Date(uploaded).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}

              {(task.measurementDetails || task.location) && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-start gap-1.5">
                  <MapPin size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Site Visit Summary</p>
                    {task.location && <p className="text-[11px] text-slate-500">{task.location}</p>}
                    {task.measurementDetails && <p className="text-[11px] text-slate-500 line-clamp-2">{task.measurementDetails}</p>}
                  </div>
                </div>
              )}

              <div className="w-full text-center py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold">
                Review · Approve / Reject →
              </div>
            </button>
          )
        })}
      </div>

      {flowTask && (
        <DemoFlowSheet
          isOpen={!!flowTask}
          onClose={() => setFlowTaskId(null)}
          task={flowTask}
          onUpdate={updates => { updateTask(flowTask.id, updates); setFlowTaskId(null) }}
        />
      )}
    </div>
  )
}
