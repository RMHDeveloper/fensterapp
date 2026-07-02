import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Phone, CheckCircle2, Star, Navigation, MessageCircle, Pencil } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { ProgressCircle } from '../../components/cards/ProgressCircle'
import { Timeline } from '../../components/layout/Timeline'
import { Accordion } from '../../components/layout/Accordion'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { MediaPreviewList } from '../../components/media/MediaPreviewList'
import { voicePreviewStore } from '../../utils/sessionStore'
import type { TimelineItem } from '../../components/layout/Timeline'
import type { Task, TaskStatus, Project } from '../../types'

const GOOGLE_REVIEW_LINK = 'https://maps.app.goo.gl/SRqthqnsFTo5UdHL9'

function fmtDate(val?: string | null): string {
  if (!val || val === '—' || val.trim() === '') return '—'
  // ISO date string
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const d = new Date(val)
    if (isNaN(d.getTime())) return val
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return val
}

function getGoogleMapsUrl(project: Project, flowTask?: Task | null): string {
  if (flowTask?.locationPin?.mapLink) return flowTask.locationPin.mapLink
  const addr = project.location || project.city || ''
  if (!addr) return 'https://maps.google.com'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
}

function getProjectAmount(project: Project, flowTaskAmount?: number): number | null {
  return (
    project.costBreakdown?.quotationAmount ||
    project.quotationAmount ||
    flowTaskAmount ||
    (project.value > 0 ? project.value : null)
  )
}

const HISTORY_VISIBLE_FOR: Partial<Record<string, string[]>> = {
  site_engineer:      ['site_engineer', 'owner', 'lead_manager'],
  production_manager: ['production_manager', 'admin', 'owner', 'lead_manager'],
  admin:              ['production_manager', 'admin', 'owner', 'lead_manager'],
  technician:         ['technician', 'installation_incharge', 'owner', 'lead_manager'],
}


function collectProjectFiles(tasks: Task[]) {
  const dedup = (arr: string[]) => [...new Set(arr.filter(Boolean))]
  const quotationDocs     = dedup(tasks.flatMap(t => [
    ...(t.quotationFile ? [t.quotationFile] : []),
    ...(t.jobSheet ? [t.jobSheet] : []),
    ...(t.glassSheet ? [t.glassSheet] : []),
    ...(t.cuttingSheet ? [t.cuttingSheet] : []),
  ]))
  const sitePhotos        = dedup(tasks.flatMap(t => [...(t.sitePhotos ?? []), ...(t.measurementFiles ?? [])]))
  const paymentProofs     = dedup(tasks.flatMap(t => [...(t.advancePaymentScreenshot ?? [])]))
  const productionDocs    = dedup(tasks.flatMap(t => [...(t.additionalDocs ?? []), ...(t.specialNoteProduction ?? [])]))
  const installationPhotos= dedup(tasks.flatMap(t => [...(t.installationFiles ?? []), ...(t.specialNoteInstallation ?? [])]))
  const voiceNotes        = dedup(tasks.flatMap(t => (t.voiceNotes ?? []).map(v => v.previewUrl ?? v.id)))
  const total = dedup([...quotationDocs, ...sitePhotos, ...paymentProofs, ...productionDocs, ...installationPhotos, ...voiceNotes]).length
  return { quotationDocs, sitePhotos, paymentProofs, productionDocs, installationPhotos, voiceNotes, total }
}

const FLOW_STAGE_LABEL: Record<string, string> = {
  site_assign: 'Site Assignment', site_visit: 'Site Visit', reschedule_review: 'Reschedule Review',
  site_review: 'Quotation', owner_approval: 'MD/ED Approval', send_to_client: 'Send to Client',
  production_assign: 'Production Setup', production_check: 'Availability Check',
  advance_payment: 'Advance Payment', production_work: 'Production Work',
  installation_assign: 'Installation Setup', installation_update: 'Installation',
  final_payment: 'Final Payment', final_completion: 'Complete Project', completed: 'Completed',
}

// ── Timeline stages in order ─────────────────────────────────────────────────
const TIMELINE_STAGES: Array<{ id: string; label: string; projectStages: string[] }> = [
  { id: 't1',  label: 'Project Created',          projectStages: [] },  // always completed
  { id: 't2',  label: 'Measurement / Site Visit', projectStages: ['measurement','site_visit_assigned','site_visit_completed'] },
  { id: 't3',  label: 'Quotation Prepared',       projectStages: ['quotation_preparation','quotation_sent_owner','quotation_rework','owner_disapproved'] },
  { id: 't4',  label: 'MD/ED Approval',            projectStages: ['owner_approved'] },
  { id: 't5',  label: 'Sent to Client',           projectStages: ['sent_to_client','waiting_client_approval'] },
  { id: 't6',  label: 'Client Approval',          projectStages: ['client_approved','negotiation','client_rejected'] },
  { id: 't7',  label: 'Advance Payment',          projectStages: ['advance_payment','advance_payment_pending','waiting_advance_payment'] },
  { id: 't8',  label: 'Production Check',          projectStages: ['production_sheet_preparation','production_admin_check','waiting_material_availability'] },
  { id: 't9',  label: 'Production Work',          projectStages: ['production_manager_work','ready_to_dispatch'] },
  { id: 't10', label: 'Installation',             projectStages: ['installation','installation_assigned','installation_in_progress','installation_not_completed','installation_mistake'] },
  { id: 't11', label: 'Final Payment',            projectStages: ['final_payment','payment_pending','partial_paid'] },
  { id: 't12', label: 'Completed',                projectStages: ['completed'] },
]

// Map every ProjectStage string to a timeline index
const STAGE_TO_TL_IDX: Record<string, number> = {
  new_project:            1,
  measurement:            1,
  site_visit_assigned:    1,
  site_visit_completed:   2,
  quotation_preparation:  2,
  quotation_sent_owner:   2,
  quotation_rework:       2,
  owner_disapproved:      2,
  owner_approved:         3,
  sent_to_client:         4,
  waiting_client_approval:4,
  client_approved:        5,
  negotiation:            5,
  client_rejected:        5,
  advance_payment:        6,
  advance_payment_pending:6,
  waiting_advance_payment:6,
  production_sheet_preparation: 7,
  production_admin_check: 7,
  waiting_material_availability: 7,
  production_manager_work:8,
  ready_to_dispatch:      8,
  installation:           9,
  installation_assigned:  9,
  installation_in_progress:9,
  installation_not_completed:9,
  installation_mistake:   9,
  final_payment:          10,
  payment_pending:        10,
  partial_paid:           10,
  completed:              11,
}

function buildProjectTimeline(currentStage?: string, createdAt?: string): TimelineItem[] {
  const currentIdx = currentStage ? (STAGE_TO_TL_IDX[currentStage] ?? 1) : 1
  const isCompleted = currentStage === 'completed'

  return TIMELINE_STAGES
    .map((step, _) => {
      const absoluteIdx = TIMELINE_STAGES.indexOf(step)
      let status: 'completed' | 'current' | 'upcoming'
      if (isCompleted) {
        status = 'completed'
      } else if (absoluteIdx === 0) {
        status = 'completed' // Project Created always completed
      } else if (absoluteIdx < currentIdx) {
        status = 'completed'
      } else if (absoluteIdx === currentIdx) {
        status = 'current'
      } else {
        status = 'upcoming'
      }
      return {
        id:    step.id,
        label: step.label,
        date:  absoluteIdx === 0 ? createdAt : undefined,
        status,
      }
    })
}

export default function ProjectDetailScreen() {
  const { id = 'p1' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks: allTasks, payments, projects, addTask, updateTask, updateProject } = useAppData()
  const { user, can } = useAuth()

  const project  = projects.find(p => p.id === id) ?? projects[0]
  const tasks    = allTasks.filter(t => t.projectId === id)
  const payment  = payments.find(p => p.projectId === id)
  const timeline = buildProjectTimeline(project?.currentStage, project?.createdAt)

  // Derive project value from flow tasks when project record hasn't been updated yet
  const flowTaskQuotation = tasks
    .filter(t => t.flowStage)
    .reduce<number | undefined>((best, t) => {
      const v = t.costBreakdown?.quotationAmount ?? t.quotationAmount
      return v != null && (best == null || v > best) ? v : best
    }, undefined)

  const [showAddTask,     setShowAddTask]     = useState(false)
  const [snack,           setSnack]           = useState({ open: false, msg: '' })
  const [flowTask,        setFlowTask]        = useState<Task | null>(null)
  const [editDateType,    setEditDateType]    = useState<'start' | 'due' | null>(null)
  const [editDateValue,   setEditDateValue]   = useState('')
  const [showEditClient,  setShowEditClient]  = useState(false)
  const [editClientName,  setEditClientName]  = useState('')

  const activeFlowTask = tasks.find(t => t.flowStage && t.flowStage !== 'completed')

  // Add Task form state
  const [taskName,      setTaskName]      = useState('')
  const [taskType,      setTaskType]      = useState<Task['type']>('other')
  const [taskAssignee,  setTaskAssignee]  = useState('')
  const [taskDueDate,   setTaskDueDate]   = useState('')
  const [taskLocation,  setTaskLocation]  = useState('')
  const [taskNote,      setTaskNote]      = useState('')

  function handleCallClient() {
    if (!project?.clientPhone) {
      setSnack({ open: true, msg: 'Phone number not available' })
      return
    }
    window.location.href = `tel:${project.clientPhone}`
  }

function handleSaveTask() {
    if (!taskName.trim()) return
    addTask({
      title:            taskName.trim(),
      type:             taskType,
      status:           'pending' as TaskStatus,
      priority:         'medium',
      dueDate:          taskDueDate || 'Today',
      assignee:         taskAssignee || (user?.name ?? 'Unassigned'),
      projectId:        id,
      projectName:      project?.name ?? '',
      location:         taskLocation || project?.city,
      requiredProofType:'none',
      proofUploads:     [],
      createdAt:        new Date().toISOString().slice(0, 10),
      ...(taskNote ? { description: taskNote } : {}),
    })
    setShowAddTask(false)
    setTaskName(''); setTaskType('other'); setTaskAssignee('')
    setTaskDueDate(''); setTaskLocation(''); setTaskNote('')
    setSnack({ open: true, msg: 'Task added successfully!' })
  }

  function handleFlowUpdate(updates: Partial<Task>) {
    if (!flowTask) return
    updateTask(flowTask.id, updates)
    setSnack({ open: true, msg: 'Status updated!' })
    setFlowTask(null)
  }

  const projectFiles = collectProjectFiles(tasks)

  const accordionItems = [
    {
      id: 'timeline',
      title: 'Project Timeline',
      subtitle: `${timeline.filter(s => s.status === 'completed').length} of ${timeline.length} stages done`,
      children: <Timeline items={timeline} />,
    },
    {
      id: 'payment',
      title: 'Payment Summary',
      subtitle: (() => {
        if (payment) return `₹${(payment.received / 1000).toFixed(0)}K received of ₹${(payment.totalAmount / 1000).toFixed(0)}K`
        const q = project.costBreakdown?.quotationAmount ?? project.quotationAmount ?? flowTaskQuotation
        return q ? `₹${(q / 1000).toFixed(0)}K quoted` : 'No payment record'
      })(),
      children: (() => {
        if (payment) return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total',    value: payment.totalAmount, color: 'bg-slate-50 text-slate-700'  },
                { label: 'Received', value: payment.received,   color: 'bg-emerald-50 text-emerald-700' },
                { label: 'Pending',  value: payment.pending, color: payment.status === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-xl p-2.5 text-center ${color}`}>
                  <p className="text-[10px] mb-0.5">{label}</p>
                  <p className="text-xs font-bold">₹{(value / 1000).toFixed(0)}K</p>
                </div>
              ))}
            </div>
            <StatusBadge status={payment.status} size="md" />
            {payment.history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                <span className="text-slate-600">{h.method} · {h.date}</span>
                <span className="font-bold text-emerald-700">+₹{(h.amount / 1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        )
        const q = project.costBreakdown?.quotationAmount ?? project.quotationAmount ?? flowTaskQuotation
        const advTask = tasks.find(t => t.flowStage === 'advance_payment' || t.flowStage === 'final_payment' || t.flowStage === 'final_completion' || (t.paidAmount && t.paidAmount > 0))
        const paid = advTask?.paidAmount ?? 0
        const balance = advTask?.balanceAmount ?? (q ? Math.max(0, q - paid) : 0)
        if (q) return (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Quoted',   value: q,       color: 'bg-slate-50 text-slate-700'     },
                { label: 'Received', value: paid,     color: 'bg-emerald-50 text-emerald-700' },
                { label: 'Balance',  value: balance,  color: balance > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-xl p-2.5 text-center ${color}`}>
                  <p className="text-[10px] mb-0.5">{label}</p>
                  <p className="text-xs font-bold">₹{(value / 1000).toFixed(0)}K</p>
                </div>
              ))}
            </div>
            {paid === 0 && <p className="text-xs text-slate-400 italic text-center">No payment received yet.</p>}
            {paid > 0 && balance === 0 && <p className="text-xs text-emerald-600 font-semibold text-center">✓ Fully paid</p>}
          </div>
        )
        return <p className="text-sm text-slate-400 italic">No payment record.</p>
      })(),
    },
    {
      id: 'notes',
      title: 'Notes & Activity',
      subtitle: (() => {
        const allowedRoles = user?.role ? HISTORY_VISIBLE_FOR[user.role] : undefined
        const allEntries = tasks.flatMap(t => t.statusHistory ?? [])
          .filter(e => (e.note || (e.files && e.files.length > 0)) && (!allowedRoles || allowedRoles.includes(e.updatedRole)))
        return allEntries.length > 0 ? `${allEntries.length} entr${allEntries.length !== 1 ? 'ies' : 'y'}` : 'No activity yet'
      })(),
      children: (() => {
        const allowedRoles = user?.role ? HISTORY_VISIBLE_FOR[user.role] : undefined
        const allEntries = tasks
          .flatMap(t => (t.statusHistory ?? []).map(e => ({ ...e, taskTitle: t.title })))
          .filter(e => (e.note || (e.files && e.files.length > 0)) && (!allowedRoles || allowedRoles.includes(e.updatedRole)))
          .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
        if (allEntries.length === 0) {
          return (
            <p className="text-sm text-slate-400 italic">
              No activity yet. Notes and file uploads will appear here.
            </p>
          )
        }
        return (
          <div className="space-y-3 divide-y divide-slate-100">
            {allEntries.map((entry, i) => {
              const timeStr = (() => {
                try {
                  const d = new Date(entry.updatedAt)
                  if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                } catch { /* fall through */ }
                return ''
              })()
              return (
                <div key={i} className={`flex gap-2.5 ${i > 0 ? 'pt-3' : ''}`}>
                  <div className="flex flex-col items-center pt-1 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-blue-500 uppercase mb-0.5">{entry.taskTitle}</p>
                    {entry.note && <p className="text-xs text-slate-700 leading-relaxed">{entry.note}</p>}
                    {entry.files && entry.files.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {entry.files.map((f, fi) => (
                          <p key={fi} className="text-[10px] text-slate-400">
                            📎 {f}{timeStr ? <span className="text-slate-300"> · {timeStr}</span> : null}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {FLOW_STAGE_LABEL[entry.stage] ?? entry.stage.replace(/_/g, ' ')} · {entry.updatedBy} · {entry.updatedAt}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })(),
    },
    {
      id: 'files',
      title: 'Files',
      subtitle: projectFiles.total > 0
        ? `${projectFiles.total} file${projectFiles.total !== 1 ? 's' : ''}`
        : 'No files yet',
      children: projectFiles.total === 0
        ? <p className="text-sm text-slate-400 italic">No files attached yet.</p>
        : (
          <div className="space-y-4">
            {projectFiles.quotationDocs.length > 0 && (
              <MediaPreviewList files={projectFiles.quotationDocs} title="Quotation Files" />
            )}
            {projectFiles.sitePhotos.length > 0 && (
              <MediaPreviewList files={projectFiles.sitePhotos} title="Site Photos" />
            )}
            {projectFiles.paymentProofs.length > 0 && (
              <MediaPreviewList files={projectFiles.paymentProofs} title="Payment Proofs" />
            )}
            {projectFiles.productionDocs.length > 0 && (
              <MediaPreviewList files={projectFiles.productionDocs} title="Production Docs" />
            )}
            {projectFiles.installationPhotos.length > 0 && (
              <MediaPreviewList files={projectFiles.installationPhotos} title="Installation Photos" />
            )}
            {projectFiles.voiceNotes.length > 0 && (
              <MediaPreviewList files={projectFiles.voiceNotes} title="Voice Notes" voiceStore={voicePreviewStore} />
            )}
          </div>
        ),
    },
    ...(project?.actualCosts ? [{
      id: 'budget',
      title: 'Project Budget',
      subtitle: can('view_profit') && project.actualCosts
        ? (() => {
            const profit = (project.actualCosts.quotationAmount || 0) -
              (project.actualCosts.materialCost + project.actualCosts.productionCost +
               project.actualCosts.installationCost + project.actualCosts.transportCost)
            return profit >= 0 ? `₹${(profit / 1000).toFixed(0)}K profit` : `₹${(Math.abs(profit) / 1000).toFixed(0)}K loss`
          })()
        : 'Actual vs Quoted',
      children: (() => {
        const ac = project.actualCosts!
        const quoted = project.costBreakdown
        const totalActual = ac.materialCost + ac.productionCost + ac.installationCost + ac.transportCost
        const profit = ac.quotationAmount - totalActual
        return (
          <div className="space-y-2">
            {[
              { label: 'Material Cost',     quoted: quoted?.materialCost,     actual: ac.materialCost     },
              { label: 'Production Cost',   quoted: quoted?.productionCost,   actual: ac.productionCost   },
              { label: 'Installation Cost', quoted: quoted?.installationCost, actual: ac.installationCost },
              { label: 'Transport Cost',    quoted: quoted?.transportCost,    actual: ac.transportCost    },
            ].map(({ label, quoted: q, actual: a }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <div className="flex items-center gap-3">
                  {q != null && <span className="text-slate-400">Est ₹{q.toLocaleString('en-IN')}</span>}
                  <span className="font-bold text-slate-700">₹{a.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 flex justify-between text-xs">
              <span className="font-semibold text-slate-600">Total Expenses</span>
              <span className="font-bold text-slate-800">₹{totalActual.toLocaleString('en-IN')}</span>
            </div>
            {can('view_profit') && (
              <div className={`rounded-xl px-3 py-2 flex justify-between text-sm ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className={`font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Profit</span>
                <span className={`font-extrabold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  ₹{profit.toLocaleString('en-IN')}
                  {ac.quotationAmount > 0 && (
                    <span className="font-normal opacity-70 text-xs"> ({(profit / ac.quotationAmount * 100).toFixed(1)}%)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )
      })(),
    }] : []),
    {
      id: 'info',
      title: 'Project Info',
      subtitle: `${project?.productType} · ${project?.city}`,
      children: (
        <div className="space-y-2.5">
          {[
            { label: 'Project No.', value: project?.number      },
            { label: 'Client',      value: project?.client      },
            { label: 'Phone',       value: project?.clientPhone },
            { label: 'Product',     value: project?.productType },
            { label: 'City',        value: project?.city        },
            { label: 'Created',     value: project?.createdAt   },
            { label: 'Due Date',    value: project?.dueDate     },
            { label: 'Stage',       value: project?.stage       },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-medium">{label}</span>
              <span className="text-xs font-semibold text-slate-700">{value}</span>
            </div>
          ))}
        </div>
      ),
    },
  ]

  if (!project) return null

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* Header */}
      <div className="bg-blue-700 px-4 pt-12 pb-6">
        {/* Top row: back only */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center active:bg-white/30 flex-shrink-0">
            <ArrowLeft size={18} className="text-white" />
          </button>
        </div>

        {/* Two-column: project info (left) + progress circle (right) */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {user?.role === 'owner' ? (
              <button onClick={() => { setEditClientName(project.client); setShowEditClient(true) }} className="text-left w-full">
                <h1 className="text-xl font-extrabold text-white leading-tight truncate flex items-center gap-1.5">
                  {project.client} <Pencil size={12} className="text-white/50 flex-shrink-0" />
                </h1>
              </button>
            ) : (
              <h1 className="text-xl font-extrabold text-white leading-tight truncate">{project.client}</h1>
            )}
            <p className="text-blue-300 text-xs mt-0.5 truncate">{project.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {(user?.role === 'owner' || user?.role === 'lead_manager') && (() => {
                const amt = getProjectAmount(project, flowTaskQuotation)
                const balTask = tasks.find(t => t.balanceAmount && t.balanceAmount > 0)
                const balance = balTask?.balanceAmount ?? 0
                return amt != null ? (
                  <span className="text-emerald-300 text-sm font-extrabold">
                    · ₹{amt.toLocaleString('en-IN')}
                    {balance > 0 && <span className="text-amber-300 text-xs font-semibold"> (Balance ₹{balance.toLocaleString('en-IN')})</span>}
                  </span>
                ) : null
              })()}
            </div>
            <div className="flex items-center gap-2.5 mt-2 flex-wrap">
              <StatusBadge status={project.status} size="sm" />
              {project.city && (
                <span className="flex items-center gap-1 text-blue-200 text-xs">
                  <MapPin size={10} /> {project.city}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <ProgressCircle
              percent={project.progress}
              size={68}
              strokeWidth={5}
              color="#93C5FD"
              trackColor="rgba(255,255,255,0.2)"
              labelSize="text-xs"
            />
          </div>
        </div>

        {/* 3 date cards */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {/* Start Date — editable for owner/LM */}
          {(() => {
            const canEdit = user?.role === 'owner' || user?.role === 'lead_manager'
            const val = fmtDate(project.startDate ?? project.createdAt)
            return canEdit ? (
              <button onClick={() => { setEditDateType('start'); setEditDateValue(project.startDate ?? '') }}
                className="bg-white/15 rounded-2xl p-3 text-center active:bg-white/25">
                <Calendar size={13} className="text-blue-200 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-white leading-tight">{val}</p>
                <p className="text-[10px] text-blue-300 mt-0.5 flex items-center justify-center gap-0.5">Start <Pencil size={7} /></p>
              </button>
            ) : (
              <div className="bg-white/15 rounded-2xl p-3 text-center">
                <Calendar size={13} className="text-blue-200 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-white leading-tight">{val}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">Start Date</p>
              </div>
            )
          })()}
          {/* Due Date — editable for owner/LM */}
          {(() => {
            const canEdit = user?.role === 'owner' || user?.role === 'lead_manager'
            const val = fmtDate(project.dueDate)
            return canEdit ? (
              <button onClick={() => { setEditDateType('due'); setEditDateValue(project.dueDate && project.dueDate !== '—' ? project.dueDate : '') }}
                className="bg-white/15 rounded-2xl p-3 text-center active:bg-white/25">
                <Calendar size={13} className="text-blue-200 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-white leading-tight">{val}</p>
                <p className="text-[10px] text-blue-300 mt-0.5 flex items-center justify-center gap-0.5">Due <Pencil size={7} /></p>
              </button>
            ) : (
              <div className="bg-white/15 rounded-2xl p-3 text-center">
                <Calendar size={13} className="text-blue-200 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-white leading-tight">{val}</p>
                <p className="text-[10px] text-blue-300 mt-0.5">Due Date</p>
              </div>
            )
          })()}
          {/* Remaining Days / Completed */}
          {(() => {
            if (project.completedAt || project.actualCompletedDate || project.currentStage === 'completed') {
              return (
                <div className="bg-white/15 rounded-2xl p-3 text-center">
                  <CheckCircle2 size={13} className="text-blue-200 mx-auto mb-1" />
                  <p className="text-[11px] font-bold text-white leading-tight">{fmtDate(project.actualCompletedDate ?? project.completedAt)}</p>
                  <p className="text-[10px] text-blue-300 mt-0.5">Completed</p>
                </div>
              )
            }
            const due = project.dueDate && project.dueDate !== '—' && /^\d{4}-\d{2}-\d{2}/.test(project.dueDate)
              ? new Date(project.dueDate) : null
            const today = new Date(); today.setHours(0,0,0,0)
            const remaining = due ? Math.ceil((due.getTime() - today.getTime()) / 86400000) : null
            const isOverdue = remaining != null && remaining < 0
            return (
              <div className={`bg-white/15 rounded-2xl p-3 text-center ${isOverdue ? 'bg-red-500/20' : ''}`}>
                <CheckCircle2 size={13} className="text-blue-200 mx-auto mb-1" />
                <p className={`text-[11px] font-bold leading-tight ${isOverdue ? 'text-red-300' : 'text-white'}`}>
                  {remaining == null ? '—' : remaining < 0 ? `${Math.abs(remaining)}d over` : remaining === 0 ? 'Today' : `${remaining}d left`}
                </p>
                <p className="text-[10px] text-blue-300 mt-0.5">Remaining</p>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 py-4 space-y-2.5">
        <div className="flex gap-2 justify-center flex-wrap">
          <button onClick={handleCallClient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold active:scale-95 transition-transform bg-teal-50 text-teal-700 border-teal-100">
            <Phone size={13} /> Call Client
          </button>
          {project.clientPhone && (
            <a
              href={`https://wa.me/91${project.clientPhone.replace(/\D/g, '').replace(/^0/, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold active:scale-95 transition-transform bg-emerald-50 text-emerald-700 border-emerald-100">
              <MessageCircle size={13} /> WhatsApp
            </a>
          )}
          <a href={GOOGLE_REVIEW_LINK} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold active:scale-95 transition-transform bg-amber-50 text-amber-700 border-amber-100">
            <Star size={13} /> Google Review
          </a>
        </div>

        {/* Google Maps link — shown for site engineers to navigate to job site */}
        {user?.role === 'site_engineer' && (project.location || project.city) && (
          <div className="flex justify-center">
            <a
              href={getGoogleMapsUrl(project, activeFlowTask)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-semibold bg-green-50 text-green-700 border-green-200 active:scale-95 transition-transform"
            >
              <Navigation size={13} />
              Open in Google Maps
            </a>
          </div>
        )}
      </div>

      {/* Current Action Needed — LM demo banner */}
      {activeFlowTask && user?.role === 'lead_manager' && (
        <div className="px-4 mb-3">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Current Action Needed</p>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">
                {FLOW_STAGE_LABEL[activeFlowTask.flowStage!] ?? activeFlowTask.flowStage}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-700">{activeFlowTask.title}</p>
            {activeFlowTask.clientName && (
              <p className="text-xs text-slate-500">{activeFlowTask.clientName}{activeFlowTask.location ? ` · ${activeFlowTask.location}` : ''}</p>
            )}
            <button onClick={() => setFlowTask(activeFlowTask)}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold active:bg-blue-700">
              Update Status →
            </button>
          </div>
        </div>
      )}


      {/* Accordion */}
      <div className="px-4">
        <Accordion items={accordionItems} defaultOpen="timeline" />
      </div>

      {/* Add Task Sheet */}
      <BottomSheet isOpen={showAddTask} onClose={() => setShowAddTask(false)} title="Add Task" height="full">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Task Name *</label>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="e.g. Visit customer site"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Task Type</label>
            <select value={taskType} onChange={e => setTaskType(e.target.value as Task['type'])}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400">
              <option value="site_visit">Site Visit</option>
              <option value="production">Production</option>
              <option value="payment">Payment</option>
              <option value="call">Customer Call</option>
              <option value="delivery">Delivery</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Assignee</label>
              <input value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} placeholder="Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Due Date</label>
              <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Location</label>
            <input value={taskLocation} onChange={e => setTaskLocation(e.target.value)} placeholder="e.g. Anna Nagar, Chennai"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Note <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={taskNote} onChange={e => setTaskNote(e.target.value)} placeholder="Any specific instructions…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none" />
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-2.5">
            <p className="text-xs text-slate-500">Project: <span className="font-semibold text-slate-700">{project.name}</span></p>
          </div>
          <button onClick={handleSaveTask} disabled={!taskName.trim()}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-blue-700 disabled:opacity-50">
            Add Task
          </button>
        </div>
      </BottomSheet>

      {flowTask && (
        <DemoFlowSheet
          isOpen={!!flowTask}
          onClose={() => setFlowTask(null)}
          task={flowTask}
          onUpdate={handleFlowUpdate}
        />
      )}

      {/* Edit Date BottomSheet */}
      <BottomSheet isOpen={editDateType !== null} onClose={() => setEditDateType(null)}
        title={editDateType === 'start' ? 'Edit Start Date' : 'Edit Due Date'}>
        <div className="space-y-4">
          <input type="date" value={editDateValue} onChange={e => setEditDateValue(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
          <button onClick={() => {
            if (!editDateValue) return
            updateProject(id, editDateType === 'start' ? { startDate: editDateValue } : { dueDate: editDateValue })
            setSnack({ open: true, msg: `${editDateType === 'start' ? 'Start' : 'Due'} date updated!` })
            setEditDateType(null)
          }} className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-blue-700">
            Save Date
          </button>
        </div>
      </BottomSheet>

      {/* Edit Client Name BottomSheet */}
      <BottomSheet isOpen={showEditClient} onClose={() => setShowEditClient(false)} title="Edit Client Name">
        <div className="space-y-4">
          <input value={editClientName} onChange={e => setEditClientName(e.target.value)}
            placeholder="Client name"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
          <button onClick={() => {
            if (!editClientName.trim()) return
            updateProject(id, { client: editClientName.trim() })
            setSnack({ open: true, msg: 'Client name updated!' })
            setShowEditClient(false)
          }} className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-blue-700">
            Save Name
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
