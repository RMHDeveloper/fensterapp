import { useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { MapPin, Wrench, CheckCircle2 } from 'lucide-react'

export default function InstallationApprovalsScreen() {
  const { tasks, updateTask } = useAppData()
  const [flowTaskId, setFlowTaskId] = useState<string | null>(null)

  // Tasks proposed by Admin and waiting on Site Engineer Lead to assign/approve
  // the installer — the same flowStage DemoFlowSheet's "9d. SITE ENGINEER LEAD
  // APPROVAL" block acts on.
  const approvalTasks = tasks.filter(t => t.flowStage === 'site_lead_approval')
  const flowTask = flowTaskId ? (tasks.find(t => t.id === flowTaskId) ?? null) : null

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />

      <div className="px-4 pt-4 space-y-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Installation Approvals</h2>
          <p className="text-xs text-slate-400 mt-0.5">{approvalTasks.length} waiting for your review</p>
        </div>

        {approvalTasks.length === 0 && (
          <div className="mt-10 text-center">
            <div className="w-16 h-16 bg-fuchsia-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} className="text-fuchsia-400" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-700 mb-2">No Pending Approvals</h3>
            <p className="text-sm text-slate-400">No installer assignments are waiting on you right now.</p>
          </div>
        )}

        {approvalTasks.map(task => (
          <button key={task.id} onClick={() => setFlowTaskId(task.id)}
            className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 active:bg-slate-50">
            <div>
              {task.projectName && (
                <p className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-wide mb-1">{task.projectName}</p>
              )}
              <h3 className="text-sm font-extrabold text-slate-800">{task.clientName ?? task.title}</h3>
            </div>

            <div className="bg-fuchsia-50 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[10px] text-fuchsia-400 font-semibold uppercase">Admin Proposal</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-fuchsia-600">Proposed Person</span>
                <span className="font-bold text-fuchsia-800">{task.proposedInstallationPerson ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-fuchsia-600">Proposed Date</span>
                <span className="font-bold text-fuchsia-800">{task.proposedInstallationDate ?? '—'}</span>
              </div>
            </div>

            {task.location && (
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-start gap-1.5">
                <MapPin size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500">{task.location}</p>
              </div>
            )}

            <div className="w-full text-center py-2.5 rounded-xl bg-fuchsia-600 text-white text-xs font-bold flex items-center justify-center gap-1.5">
              <Wrench size={13} /> Review · Assign Installer →
            </div>
          </button>
        ))}
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
