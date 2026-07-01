import { useState, useEffect } from 'react'
import {
  X, CheckCircle2, AlertTriangle, Camera, Clock, Send, PhoneCall,
  Package, Wrench, CreditCard, History,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { MultiFileUploadField } from '../../components/forms/MultiFileUploadField'
import { VoiceRecorder } from '../../components/forms/VoiceRecorder'
import { LocationPinField } from '../../components/forms/LocationPinField'
import { TimePickerField } from '../../components/forms/TimePickerField'
import { NoteWithFilesField } from '../../components/forms/NoteWithFilesField'
import type { Task, Project, LocationPin, StatusHistoryItem, FlowStage, CostBreakdown, ProjectStage } from '../../types'
import { PROJECT_STAGE_LABEL, PROJECT_STAGE_PROGRESS } from '../../types'
import { filePreviewStore, voicePreviewStore, isImageFileName } from '../../utils/sessionStore'
import { MediaPreviewList } from '../../components/media/MediaPreviewList'
import { getActiveManagedUsersByDisplayRole } from '../../utils/userStorage'
import { Dialog } from '../../components/feedback/Dialog'

// Map from task flowStage → project currentStage (for timeline / filter updates)
const FLOW_TO_PROJECT_STAGE: Partial<Record<string, ProjectStage>> = {
  site_visit:          'site_visit_assigned',
  reschedule_review:   'site_visit_assigned',
  site_review:         'quotation_preparation',
  owner_approval:      'quotation_sent_owner',
  send_to_client:      'owner_approved',
  advance_payment:     'client_approved',
  production_assign:   'production_admin_check',
  production_check:    'production_admin_check',
  production_work:     'production_manager_work',
  installation_assign: 'ready_to_dispatch',
  installation_update: 'installation',
  final_payment:       'final_payment',
  final_completion:    'final_payment',
  completed:           'completed',
}

interface Props {
  isOpen: boolean
  onClose: () => void
  task: Task
  onUpdate: (updates: Partial<Task>) => void
}

// ─── Opt defined OUTSIDE — prevents remount focus bug ─────────────────────────

interface OptProps {
  value: string; label: string; sub?: string; accent?: string; sel: string; onPick: (v: string) => void
}
function Opt({ value, label, sub, accent = 'border-slate-200', sel, onPick }: OptProps) {
  const on = sel === value
  return (
    <button type="button" onClick={() => onPick(value)}
      className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98]
        ${on ? 'border-blue-500 bg-blue-50' : accent}`}>
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${on ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
        {on && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
      </div>
      <div>
        <p className={`text-sm font-bold ${on ? 'text-blue-700' : 'text-slate-800'}`}>{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </button>
  )
}

// ─── WaitingView defined OUTSIDE ─────────────────────────────────────────────

interface WaitingViewProps { icon: React.ElementType; color: string; title: string; sub: string }
function WaitingView({ icon: Icon, color, title, sub }: WaitingViewProps) {
  return (
    <div className={`rounded-2xl border p-5 text-center ${color}`}>
      <Icon size={28} className="mx-auto mb-2 opacity-70" />
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs mt-1 opacity-70">{sub}</p>
    </div>
  )
}

// ─── DemoControlCard defined OUTSIDE — prevents remount focus bug ─────────────

interface DemoControlCardProps { waitingFor: string; description: string; onOverride: () => void }
function DemoControlCard({ waitingFor, description, onOverride }: DemoControlCardProps) {
  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-amber-200 rounded-md flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={11} className="text-amber-700" />
        </div>
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Demo Control</p>
      </div>
      <p className="text-xs text-amber-700">
        <span className="font-semibold">{waitingFor}</span> needs to update this step.
      </p>
      <p className="text-[11px] text-amber-600">{description}</p>
      <button type="button" onClick={onOverride}
        className="w-full py-3 rounded-xl bg-amber-600 text-white text-sm font-bold active:opacity-90">
        Update This Step Yourself →
      </button>
    </div>
  )
}

// ─── Header color per stage ───────────────────────────────────────────────────
const STAGE_BG: Record<string, string> = {
  site_assign:         'bg-cyan-600',
  site_visit:          'bg-teal-600',
  reschedule_review:   'bg-amber-600',
  site_review:         'bg-violet-600',
  owner_approval:      'bg-purple-600',
  send_to_client:      'bg-indigo-600',
  production_assign:   'bg-orange-600',
  production_check:    'bg-amber-600',
  advance_payment:     'bg-emerald-600',
  production_work:     'bg-blue-600',
  installation_assign: 'bg-rose-600',
  installation_update: 'bg-pink-600',
  final_payment:       'bg-green-600',
  final_completion:    'bg-emerald-700',
  completed:           'bg-slate-500',
}

const STAGE_LABEL: Record<string, string> = {
  site_assign:         'Site Assignment',
  site_visit:          'Site Visit',
  reschedule_review:   'Reschedule Approval',
  site_review:         'Quotation',
  owner_approval:      'MD/ED Approval',
  send_to_client:      'Send to Client',
  production_assign:   'Production Setup',
  production_check:    'Availability Check',
  advance_payment:     'Advance Payment',
  production_work:     'Production Work',
  installation_assign: 'Installation Setup',
  installation_update: 'Installation',
  final_payment:       'Final Payment',
  final_completion:    'Complete Project',
  completed:           'Completed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400'
const lbl = 'text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block'
const req = <span className="text-red-500"> *</span>

const DEFAULT_INSTALLERS    = ['Ravi Kumar', 'Mani K', 'Senthil R', 'Arjun S', 'Balamurugan R']
const DEFAULT_SITE_ENGINEERS = ['Kavya M', 'Arun S', 'Balamurugan R']

// ── Customer / location helpers ───────────────────────────────────────────────

function isMapUrl(s: string | undefined | null): boolean {
  return Boolean(s && /^https?:\/\//i.test(s.trim()))
}

function getCustomerPhone(task: Task, project?: Project): string {
  return task.clientPhone?.trim() || project?.clientPhone?.trim() || ''
}

function getCustomerName(task: Task, project?: Project): string {
  return (
    task.clientName?.trim()   ||
    task.customer?.trim()     ||
    project?.customerName?.trim() ||
    project?.client?.trim()   ||
    ''
  )
}

// Returns the best Google Maps URL for a task + optional project fallback
function getGoogleMapsUrl(task: Task, project?: Project): string {
  if (task.locationPin?.mapLink?.trim()) return task.locationPin.mapLink.trim()
  if (task.location && isMapUrl(task.location)) return task.location.trim()
  const taskAddr = task.location?.trim() ?? ''
  if (taskAddr) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(taskAddr)}`
  const projLoc = project?.location?.trim() ?? ''
  if (projLoc && isMapUrl(projLoc))  return projLoc
  if (projLoc && !isMapUrl(projLoc)) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(projLoc)}`
  return ''
}

// Alias used by existing call sites inside this file
function getSiteMapUrl(task: Task): string { return getGoogleMapsUrl(task) }

// Returns human-readable location text (never a raw URL); falls back to project
function getReadableLocation(task: Task, project?: Project): string {
  if (task.locationPin?.label?.trim()) return task.locationPin.label.trim()
  if (task.location && !isMapUrl(task.location)) return task.location.trim()
  if (project?.location && !isMapUrl(project.location)) return project.location.trim()
  return ''
}

// Proper Google Maps button — full width or inline
function MapButton({ url, className }: { url: string; className?: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? 'flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl px-4 py-3 text-sm font-bold active:bg-green-700 w-full min-h-[44px]'}
    >
      📍 View in Google Maps
    </a>
  )
}

// Customer details card shown to Site Engineer inside Visit Customer Site task
function CustomerDetailsCard({ task, project }: { task: Task; project?: Project }) {
  const name     = getCustomerName(task, project)
  const phone    = getCustomerPhone(task, project)
  const readable = getReadableLocation(task, project)
  const mapUrl   = getGoogleMapsUrl(task, project)

  if (!name && !phone && !readable && !mapUrl) return null

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Details</p>
      <div className="space-y-1">
        {name    && <p className="text-sm font-bold text-slate-800">{name}</p>}
        {phone   && <p className="text-sm text-slate-600">📞 {phone}</p>}
        {readable && <p className="text-sm text-slate-500">📍 {readable}</p>}
        {!readable && mapUrl && <p className="text-sm text-slate-400 italic">📍 Site location pinned</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {phone ? (
          <a href={`tel:${phone}`}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold min-h-[44px] active:bg-emerald-700 transition-colors">
            📞 Call Customer
          </a>
        ) : (
          <div className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 rounded-xl py-3 text-sm font-semibold min-h-[44px]">
            📞 No Phone
          </div>
        )}
        {mapUrl ? (
          <a href={mapUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-white border-2 border-emerald-500 text-emerald-700 rounded-xl py-3 text-sm font-bold min-h-[44px] active:bg-emerald-50 transition-colors">
            📍 View Maps
          </a>
        ) : (
          <div className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 rounded-xl py-3 text-sm font-semibold min-h-[44px]">
            📍 No Location
          </div>
        )}
      </div>
    </div>
  )
}

type AvailStatus = 'available' | 'not_available' | 'order'
type AvailItem = { id: string; label: string; status: AvailStatus; reason: string }
const DEFAULT_AVAIL: AvailItem[] = [
  { id: 'profile',  label: 'Profile',  status: 'available', reason: '' },
  { id: 'glass',    label: 'Glass',    status: 'available', reason: '' },
  { id: 'hardware', label: 'Hardware', status: 'available', reason: '' },
]

// ─────────────────────────────────────────────────────────────────────────────

export function DemoFlowSheet({ isOpen, onClose, task, onUpdate }: Props) {
  const { user, can }                        = useAuth()
  const { updateTask: ctxUpdateTask, updateProject, tasks, projects } = useAppData()
  const role                                 = user?.role ?? 'lead_manager'
  const project                              = projects.find(p => p.id === task.projectId)

  // Merge managed users with defaults for assignment dropdowns
  const engineerOptions = [
    ...DEFAULT_SITE_ENGINEERS,
    ...getActiveManagedUsersByDisplayRole('Site Engineer').filter(n => !DEFAULT_SITE_ENGINEERS.includes(n)),
  ]
  const installerOptions = [
    ...DEFAULT_INSTALLERS,
    ...getActiveManagedUsersByDisplayRole('Installation Incharge').filter(n => !DEFAULT_INSTALLERS.includes(n)),
    ...getActiveManagedUsersByDisplayRole('Installation Technician').filter(n => !DEFAULT_INSTALLERS.includes(n)),
  ]

  const [sel,   setSel]   = useState('')
  const [error, setError] = useState('')

  // ── SITE ASSIGN ─────────────────────────────────────────────────────────────
  const [engineerName,   setEngineerName]   = useState('Kavya M')
  const [visitDate,      setVisitDate]      = useState('')
  const [visitTime,      setVisitTime]      = useState('')
  const [assignNote,     setAssignNote]     = useState('')
  const [assignLocation, setAssignLocation] = useState('')

  // ── SITE VISIT: reschedule ─────────────────────────────────────────────────
  const [reschedDate,   setReschedDate]   = useState('')
  const [reschedTime,   setReschedTime]   = useState('')
  const [reschedReason, setReschedReason] = useState('')

  // ── SITE VISIT: completed ─────────────────────────────────────────────────
  const [sitePhotos,  setSitePhotos]  = useState<string[]>([])
  const [measFiles,   setMeasFiles]   = useState<string[]>([])
  const [measDetails, setMeasDetails] = useState('')
  const [locPin,      setLocPin]      = useState<LocationPin>({ latitude: '', longitude: '', mapLink: '' })
  const [seNote,      setSeNote]      = useState('')

  // ── RESCHEDULE REVIEW (LM) ────────────────────────────────────────────────
  const [lmReschedNote, setLmReschedNote] = useState('')

  // ── DEMO OVERRIDE ─────────────────────────────────────────────────────────
  const [demoOverride, setDemoOverride] = useState(false)

  // ── SITE REVIEW ───────────────────────────────────────────────────────────
  const [quotAmt,     setQuotAmt]     = useState('')
  const [quotFiles,   setQuotFiles]   = useState<string[]>([])
  const [quotProduct, setQuotProduct] = useState('Window')
  const [quotNotes,   setQuotNotes]   = useState('')

  // ── OWNER APPROVAL ─────────────────────────────────────────────────────────
  const [ownerRejReason, setOwnerRejReason] = useState('')

  // ── SEND TO CLIENT ────────────────────────────────────────────────────────
  const [clientRejReason,  setClientRejReason]  = useState('')
  const [sentToClient,     setSentToClient]      = useState(false)
  const [showSentConfirm,  setShowSentConfirm]   = useState(false)
  const [clientRejAction,  setClientRejAction]   = useState('')
  const [showEditCost,     setShowEditCost]      = useState(false)

  // ── PRODUCTION ASSIGN ─────────────────────────────────────────────────────
  const [jobSheetFiles,     setJobSheetFiles]     = useState<string[]>([])
  const [jobSheetText,      setJobSheetText]      = useState('')
  const [glassSheetFiles,    setGlassSheetFiles]    = useState<string[]>([])
  const [cuttingSheetFiles,  setCuttingSheetFiles]  = useState<string[]>([])
  const [additionalDocs,     setAdditionalDocs]     = useState<string[]>([])
  const [prodAssignNote,     setProdAssignNote]     = useState('')

  // ── PRODUCTION CHECK ──────────────────────────────────────────────────────
  const [notAvailNote,  setNotAvailNote]  = useState('')
  const [notAvailFiles, setNotAvailFiles] = useState<string[]>([])
  const [notAvailLmAction, setNotAvailLmAction] = useState('')

  // ── ADVANCE PAYMENT ───────────────────────────────────────────────────────
  const [advPaidAmt,       setAdvPaidAmt]       = useState('')
  const [advBalAmt,        setAdvBalAmt]        = useState('')
  const [advNote,          setAdvNote]          = useState('')
  const [advPayScreenshot, setAdvPayScreenshot] = useState<string[]>([])

  // ── PRODUCTION WORK ───────────────────────────────────────────────────────
  const [overdueNote,    setOverdueNote]    = useState('')
  const [overdueFiles,   setOverdueFiles]   = useState<string[]>([])
  const [overdueNewDate, setOverdueNewDate] = useState('')
  const [lmNewDate,      setLmNewDate]      = useState('')
  const [lmNote,         setLmNote]         = useState('')

  // ── INSTALLATION ASSIGN ───────────────────────────────────────────────────
  const [instPerson,  setInstPerson]  = useState('')
  const [instDate,    setInstDate]    = useState('')
  const [instFiles,   setInstFiles]   = useState<string[]>([])
  const [instNote,    setInstNote]    = useState('')
  const [productCost, setProductCost] = useState('')
  const [instCost,    setInstCost]    = useState('')
  const [matCost,     setMatCost]     = useState('')
  const [transCost,   setTransCost]   = useState('')

  // ── INSTALLATION UPDATE ───────────────────────────────────────────────────
  const [instNotCompNote,       setInstNotCompNote]       = useState('')
  const [instNotCompFiles,      setInstNotCompFiles]      = useState<string[]>([])
  const [instMistakeNote,       setInstMistakeNote]       = useState('')
  const [instMistakePhotos,     setInstMistakePhotos]     = useState<string[]>([])
  const [instMistakeReviewAction, setInstMistakeReviewAction] = useState('')

  // ── FINAL PAYMENT ─────────────────────────────────────────────────────────
  const [finalPaidAmt, setFinalPaidAmt] = useState('')
  const [finalBalAmt,  setFinalBalAmt]  = useState('')
  const [actualMaterial,     setActualMaterial]     = useState('')
  const [actualProduction,   setActualProduction]   = useState('')
  const [actualInstallation, setActualInstallation] = useState('')
  const [actualTransport,    setActualTransport]    = useState('')
  const [actualOther,        setActualOther]        = useState('')

  // ── File / image fullscreen preview ────────────────────────────────────────
  const [fullPreviewSrc,  setFullPreviewSrc]  = useState<string | null>(null)
  const [fullPreviewName, setFullPreviewName] = useState<string>('')

  // ── PHASE 3: Site visit voice notes ──────────────────────────────────────
  const [voiceNoteProductionIds,   setVoiceNoteProductionIds]   = useState<string[]>([])
  const [voiceNoteInstallationIds, setVoiceNoteInstallationIds] = useState<string[]>([])

  // ── PHASE 4: Cost breakdown for site_review ───────────────────────────────
  const [costSqft,     setCostSqft]     = useState('')
  const [costMaterial, setCostMaterial] = useState('')
  const [costTransAmt, setCostTransAmt] = useState('')

  // ── PHASE 8: Production Incharge availability checklist ──────────────────────
  const [availChecklist, setAvailChecklist] = useState<AvailItem[]>(DEFAULT_AVAIL)

  // ── PHASE 9: Production Incharge 6-step checklist ──────────────────────────
  const [prodChecklist, setProdChecklist] = useState([
    { id: 'cutting',    label: 'Profile Cutting', done: false },
    { id: 'routing',    label: 'Routing',         done: false },
    { id: 'steel',      label: 'Steel',           done: false },
    { id: 'welding',    label: 'Welding',         done: false },
    { id: 'assembling', label: 'Assembling',      done: false },
    { id: 'glazing',    label: 'Glazing',         done: false },
  ])

  // ── Reset on open / task change ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setSel(''); setError(''); setSentToClient(false); setLmReschedNote(''); setDemoOverride(false); setShowEditCost(false)
    setEngineerName(task.siteEngineerName ?? 'Kavya M')
    setVisitDate(task.visitDate ?? ''); setVisitTime(task.visitTime ?? '')
    setAssignNote(''); setAssignLocation(task.location ?? '')
    setReschedDate(''); setReschedTime(''); setReschedReason('')
    setSitePhotos(task.sitePhotos ?? [])
    setMeasFiles(task.measurementFiles ?? [])
    setMeasDetails(task.measurementDetails ?? '')
    setLocPin(task.locationPin ?? { latitude: '', longitude: '', mapLink: '' })
    setSeNote('')
    setQuotAmt(task.quotationAmount ? String(task.quotationAmount) : '')
    setQuotFiles(task.quotationFile ? [task.quotationFile] : [])
    setQuotProduct(task.quotationProductType ?? 'Window')
    setQuotNotes(task.quotationNotes ?? '')
    setOwnerRejReason(task.ownerRejectionReason ?? '')
    setClientRejReason('')
    setJobSheetFiles(task.jobSheet ? [task.jobSheet] : [])
    setJobSheetText(task.jobSheetDetails ?? '')
    setGlassSheetFiles(task.glassSheet ? [task.glassSheet] : [])
    setCuttingSheetFiles(task.cuttingSheet ? [task.cuttingSheet] : [])
    setAdditionalDocs(task.additionalDocs ?? [])
    setProdAssignNote(task.productionSheetNote ?? '')
    setNotAvailNote(''); setNotAvailFiles([]); setNotAvailLmAction('')
    setAdvPaidAmt(task.paidAmount ? String(task.paidAmount) : '')
    setAdvPayScreenshot(task.advancePaymentScreenshot ?? [])
    setAdvBalAmt(task.balanceAmount ? String(task.balanceAmount) : '')
    setAdvNote('')
    setOverdueNote(task.productionOverdueReason ?? '')
    setOverdueFiles([]); setOverdueNewDate(task.productionNewDate ?? '')
    setLmNewDate(''); setLmNote('')
    setInstPerson(task.installationPerson ?? '')
    setInstDate(task.installationDate ?? '')
    setInstFiles([]); setInstNote(task.installationNote ?? '')
    setProductCost(task.productCost ? String(task.productCost) : '')
    setInstCost(task.installationCost ? String(task.installationCost) : '')
    setMatCost(task.materialCost ? String(task.materialCost) : '')
    setTransCost(task.transportCost ? String(task.transportCost) : '')
    setInstNotCompNote(''); setInstNotCompFiles([])
    setInstMistakeNote(''); setInstMistakePhotos([])
    setFinalPaidAmt(task.paidAmount ? String(task.paidAmount) : '')
    setFinalBalAmt(task.balanceAmount ? String(task.balanceAmount) : '')
    const cb = task.costBreakdown
    setActualMaterial(cb?.materialCost ? String(cb.materialCost) : '')
    setActualProduction(cb?.productionCost ? String(cb.productionCost) : '')
    setActualInstallation(cb?.installationCost ? String(cb.installationCost) : '')
    setActualTransport(cb?.transportCost ? String(cb.transportCost) : '')
    setActualOther('')
    // Phase 3
    setVoiceNoteProductionIds(task.specialNoteProduction ?? [])
    setVoiceNoteInstallationIds(task.specialNoteInstallation ?? [])
    // Phase 4
    setCostSqft(task.costBreakdown?.numberOfSqft ? String(task.costBreakdown.numberOfSqft) : '')
    setCostMaterial(task.costBreakdown?.materialCost ? String(task.costBreakdown.materialCost) : '')
    setCostTransAmt(task.costBreakdown?.transportCost ? String(task.costBreakdown.transportCost) : '')
    // Phase 8 — restore from task state if available, else use defaults
    setAvailChecklist(
      task.availabilityChecklist?.length
        ? task.availabilityChecklist.map(i => ({
            id: i.id, label: i.label,
            status: (i.ordered ? 'order' : i.available ? 'available' : 'not_available') as AvailStatus,
            reason: i.notAvailableReason ?? '',
          }))
        : DEFAULT_AVAIL.map(d => ({ ...d }))
    )
    // Phase 9 — restore from task state if available, else use defaults
    setProdChecklist(
      task.productionChecklist?.length
        ? task.productionChecklist
        : [
            { id: 'cutting',    label: 'Profile Cutting', done: false },
            { id: 'routing',    label: 'Routing',         done: false },
            { id: 'steel',      label: 'Steel',           done: false },
            { id: 'welding',    label: 'Welding',         done: false },
            { id: 'assembling', label: 'Assembling',      done: false },
            { id: 'glazing',    label: 'Glazing',         done: false },
          ]
    )
  }, [isOpen, task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  const stage      = task.flowStage ?? 'site_assign'
  const flowStatus = task.flowStatus ?? 'ready'

  function pick(v: string) { setSel(v); setError('') }

  function save(updates: Partial<Task>, histNote?: string, histFiles?: string[]) {
    setError('')
    const now = new Date().toLocaleString('en-IN')
    const by  = user?.name ?? 'System'
    const isStageChange = !!(updates.flowStage && updates.flowStage !== stage)
    const newEntries: StatusHistoryItem[] = []

    if (isStageChange) {
      // Close current stage as completed
      newEntries.push({
        stage: stage as FlowStage,
        status: 'completed',
        note: histNote,
        files: histFiles?.length ? histFiles : undefined,
        updatedBy: by,
        updatedRole: role,
        updatedAt: now,
      })
      // Open new stage
      newEntries.push({
        stage: updates.flowStage as FlowStage,
        status: updates.flowStatus ?? 'pending',
        updatedBy: by,
        updatedRole: role,
        updatedAt: now,
      })
    } else {
      // Same-stage status update
      newEntries.push({
        stage: stage as FlowStage,
        status: updates.flowStatus ?? flowStatus,
        note: histNote,
        files: histFiles?.length ? histFiles : undefined,
        updatedBy: by,
        updatedRole: role,
        updatedAt: now,
      })
    }

    onUpdate({
      ...updates,
      statusHistory: [...(task.statusHistory ?? []), ...newEntries],
    })

    // ── Also update project.currentStage so timeline & filters stay in sync ─
    if (task.projectId) {
      let newProjectStage: ProjectStage | undefined
      if (isStageChange && updates.flowStage) {
        newProjectStage = FLOW_TO_PROJECT_STAGE[updates.flowStage]
      }
      // Handle same-stage status changes that imply a project stage change
      if (!newProjectStage) {
        if (stage === 'owner_approval' && updates.flowStatus === 'rejected') newProjectStage = 'owner_disapproved'
        if (stage === 'send_to_client' && updates.flowStatus === 'client_rejected') newProjectStage = 'sent_to_client'
        if (stage === 'production_check' && updates.flowStatus === 'not_available') newProjectStage = 'production_admin_check'
        if (stage === 'production_work' && (updates.flowStatus === 'in_progress' || updates.flowStatus === 'overdue')) newProjectStage = 'production_manager_work'
        if (stage === 'installation_update' && updates.flowStatus === 'mistake') newProjectStage = 'installation'
      }
      if (newProjectStage) {
        updateProject(task.projectId, {
          currentStage: newProjectStage,
          stage: PROJECT_STAGE_LABEL[newProjectStage] ?? newProjectStage,
          progress: PROJECT_STAGE_PROGRESS[newProjectStage] ?? undefined,
          updatedAt: new Date().toISOString(),
        } as Partial<import('../../types').Project>)
      }
    }

    onClose()
  }

  // After client approval, LM loses access to cost breakdown
  const STAGES_POST_CLIENT: string[] = ['advance_payment','production_assign','production_check','production_work','installation_assign','installation_update','final_payment','final_completion','completed']
  const canSeeCosts  = role === 'owner' || (role === 'lead_manager' && !STAGES_POST_CLIENT.includes(stage))
  const canEditCosts = role === 'owner'
  const canSeeProfit = can('view_profit')

  function ContextStrip() {
    return (
      <div className="bg-slate-50 rounded-2xl p-3 space-y-0.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">{task.clientName ?? task.customer}</p>
        </div>
        {task.clientRequirement && <p className="text-xs text-slate-500">{task.clientRequirement}</p>}
        {(() => {
          const readable = getReadableLocation(task)
          const mapUrl   = getSiteMapUrl(task)
          const isSiteStage = ['site_assign','site_visit','reschedule_review'].includes(stage)
          return (
            <>
              {readable && <p className="text-xs text-slate-400">{readable}</p>}
              {mapUrl && !readable && <p className="text-xs text-slate-400 italic">Site location pinned</p>}
              {mapUrl && role !== 'site_engineer' && isSiteStage && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-1 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-green-700 active:bg-green-100">
                  📍 View in Google Maps
                </a>
              )}
            </>
          )
        })()}
        {task.siteEngineerName && stage !== 'site_assign' && (
          <p className="text-xs text-cyan-600 font-semibold pt-0.5">Engineer: {task.siteEngineerName}</p>
        )}
        {canSeeCosts && task.quotationAmount != null && !['site_assign','site_visit','site_review','reschedule_review'].includes(stage) && (
          <p className="text-xs font-bold text-emerald-600 pt-0.5">
            ₹{task.quotationAmount.toLocaleString('en-IN')} · {task.quotationProductType ?? ''}
          </p>
        )}
      </div>
    )
  }

  // ── Submit helpers ────────────────────────────────────────────────────────

  function submitSiteAssign() {
    if (!engineerName) { setError('Select a site engineer.'); return }
    save({
      flowStage: 'site_visit', flowStatus: 'pending', status: 'pending',
      title: 'Visit Customer Site',
      siteEngineerName: engineerName,
      visitDate: visitDate || undefined,
      visitTime: visitTime || undefined,
      note: assignNote || undefined,
      ...(assignLocation.trim() ? { location: assignLocation.trim() } : {}),
    }, `Assigned ${engineerName}${visitDate ? ` for ${visitDate}` : ''}${visitTime ? ` at ${visitTime}` : ''}`)
  }

  function submitReschedule() {
    if (!reschedReason.trim()) { setError('Add reason for rescheduling.'); return }

    const histEntry: StatusHistoryItem = {
      stage: 'site_visit' as FlowStage,
      status: 'reschedule_requested',
      note: `Reschedule requested: ${reschedReason}${reschedDate ? ` — New date: ${reschedDate}` : ''}${reschedTime ? ` at ${reschedTime}` : ''}`,
      updatedBy: user?.name ?? 'Site Engineer',
      updatedRole: role,
      updatedAt: new Date().toLocaleString('en-IN'),
    }

    // Update SAME task — do NOT create a duplicate
    onUpdate({
      flowStatus: 'reschedule_requested',
      status: 'pending',
      requestedVisitDate: reschedDate || undefined,
      requestedVisitTime: reschedTime || undefined,
      rescheduleReason: reschedReason,
      rescheduleApprovalStatus: 'pending',
      statusHistory: [...(task.statusHistory ?? []), histEntry],
    })
    onClose()
  }

  function submitRescheduleApprovalInPlace() {
    if (!sel) return
    const isApproved = sel === 'approved'
    const note = isApproved
      ? `Reschedule approved by ${user?.name ?? 'Sales Team'}${lmReschedNote ? `: ${lmReschedNote}` : ''}`
      : `Reschedule rejected by ${user?.name ?? 'Sales Team'}${lmReschedNote ? `: ${lmReschedNote}` : ''}`

    const histEntry: StatusHistoryItem = {
      stage: 'site_visit' as FlowStage,
      status: isApproved ? 'reschedule_approved' : 'reschedule_rejected',
      note,
      updatedBy: user?.name ?? 'Sales Team',
      updatedRole: role,
      updatedAt: new Date().toLocaleString('en-IN'),
    }

    onUpdate({
      flowStatus: isApproved ? 'reschedule_approved' : 'pending',
      visitDate: isApproved ? (task.requestedVisitDate ?? task.visitDate) : task.visitDate,
      visitTime: isApproved ? (task.requestedVisitTime ?? task.visitTime) : task.visitTime,
      rescheduleApprovalStatus: isApproved ? 'approved' : 'rejected',
      rescheduleApprovedBy: user?.name ?? 'Sales Team',
      rescheduleApprovalNote: lmReschedNote || undefined,
      statusHistory: [...(task.statusHistory ?? []), histEntry],
    })
    onClose()
  }

  function submitRescheduleApproval() {
    if (!sel) return
    const isApproved = sel === 'approved'
    const note = isApproved
      ? `Reschedule approved by ${user?.name ?? 'Sales Team'}${lmReschedNote ? `: ${lmReschedNote}` : ''}`
      : `Reschedule rejected by ${user?.name ?? 'Sales Team'}${lmReschedNote ? `: ${lmReschedNote}` : ''}`

    if (task.linkedSiteTaskId) {
      const seTask = tasks.find(t => t.id === task.linkedSiteTaskId)
      const seHistEntry: StatusHistoryItem = {
        stage: 'site_visit' as FlowStage,
        status: isApproved ? 'reschedule_approved' : 'reschedule_rejected',
        note,
        updatedBy: user?.name ?? 'Sales Team',
        updatedRole: role,
        updatedAt: new Date().toLocaleString('en-IN'),
      }
      ctxUpdateTask(task.linkedSiteTaskId, {
        visitDate: isApproved ? (task.requestedVisitDate ?? seTask?.visitDate) : seTask?.visitDate,
        visitTime: isApproved ? (task.requestedVisitTime ?? seTask?.visitTime) : seTask?.visitTime,
        flowStatus: isApproved ? 'reschedule_approved' : 'reschedule_rejected',
        rescheduleApprovalStatus: isApproved ? 'approved' : 'rejected',
        rescheduleApprovedBy: user?.name ?? 'Sales Team',
        rescheduleApprovalNote: lmReschedNote || undefined,
        statusHistory: [...(seTask?.statusHistory ?? []), seHistEntry],
      })
    }

    // Mark LM review task as reviewed (keep flowStage, change flowStatus so filter hides it)
    save({
      flowStage: 'reschedule_review' as FlowStage,
      flowStatus: isApproved ? 'approved' : 'rejected',
      status: 'completed',
    }, note)
  }

  function submitSiteVisitComplete() {
    if (sitePhotos.length === 0) { setError('Upload at least one site photo.'); return }
    // measurement files are optional
    const hasPin = (locPin.latitude && locPin.longitude) || locPin.mapLink.trim()
    if (!hasPin)                 { setError('Add site location pin before completing.'); return }
    save({
      flowStage: 'site_review', flowStatus: 'ready', status: 'pending',
      title: 'Review Site Visit & Create Quotation',
      sitePhotos, measurementFiles: measFiles,
      measurementDetails: measDetails || undefined,
      locationPin: locPin,
      specialNoteProduction:   voiceNoteProductionIds.length   ? voiceNoteProductionIds   : undefined,
      specialNoteInstallation: voiceNoteInstallationIds.length ? voiceNoteInstallationIds : undefined,
      note: seNote || undefined,
    }, `Site visit completed${seNote ? `: ${seNote}` : ''}`, [...sitePhotos, ...measFiles])
  }

  function submitSiteReview() {
    if (!quotAmt)               { setError('Enter the quotation amount.'); return }
    if (quotFiles.length === 0) { setError('Upload the quotation file.'); return }
    const quotAmount = Number(quotAmt)
    const sqft  = costSqft ? Number(costSqft) : 0
    const matC  = costMaterial ? Number(costMaterial) : 0
    const prodC = sqft > 0 ? sqft * 100 : 0
    const instC = sqft > 0 ? sqft * 25  : 0
    const transC= costTransAmt ? Number(costTransAmt) : 0
    const hasCosts = matC > 0 || prodC > 0 || instC > 0 || transC > 0
    const breakdown: CostBreakdown | undefined = hasCosts ? {
      quotationAmount: quotAmount,
      numberOfSqft:    sqft > 0 ? sqft : undefined,
      materialCost:    matC,
      productionCost:  prodC,
      installationCost:instC,
      transportCost:   transC,
      profit:          quotAmount - (matC + prodC + instC + transC),
    } : undefined
    save({
      flowStage: 'owner_approval', flowStatus: 'waiting', status: 'pending',
      title: 'Approve Quotation',
      quotationAmount: quotAmount,
      quotationFile: quotFiles[0],
      quotationNotes: quotNotes || undefined,
      costBreakdown: breakdown,
    }, `Quotation ₹${quotAmount.toLocaleString('en-IN')} sent for owner approval`, quotFiles)
  }

  function submitOwnerApproval() {
    if (!sel) return
    if (sel === 'approved') {
      save({
        flowStage: 'send_to_client', flowStatus: 'ready', status: 'pending',
        title: 'Send Quotation to Client',
        ownerRejectionReason: undefined,
      }, 'MD/ED approved quotation')
    } else {
      if (!ownerRejReason.trim()) { setError('Add rejection reason.'); return }
      save({ flowStatus: 'rejected', status: 'overdue', ownerRejectionReason: ownerRejReason },
        `MD/ED rejected: ${ownerRejReason}`)
    }
  }

  function submitReviseQuotation() {
    if (!quotAmt)               { setError('Enter the quotation amount.'); return }
    if (quotFiles.length === 0) { setError('Upload the quotation file.'); return }
    const quotAmount = Number(quotAmt)
    const sqft  = costSqft ? Number(costSqft) : 0
    const matC  = costMaterial ? Number(costMaterial) : 0
    const prodC = sqft > 0 ? sqft * 100 : 0
    const instC = sqft > 0 ? sqft * 25  : 0
    const transC= costTransAmt ? Number(costTransAmt) : 0
    const hasCosts = matC > 0 || prodC > 0 || instC > 0 || transC > 0
    const breakdown: CostBreakdown | undefined = hasCosts ? {
      quotationAmount: quotAmount,
      numberOfSqft:    sqft > 0 ? sqft : undefined,
      materialCost:    matC,
      productionCost:  prodC,
      installationCost:instC,
      transportCost:   transC,
      profit:          quotAmount - (matC + prodC + instC + transC),
    } : undefined
    save({
      flowStage: 'owner_approval', flowStatus: 'waiting', status: 'pending',
      title: 'Approve Quotation',
      quotationAmount: quotAmount,
      quotationFile: quotFiles[0],
      quotationNotes: quotNotes || undefined,
      costBreakdown: breakdown,
      ownerRejectionReason: undefined,
    }, `Revised quotation ₹${quotAmount.toLocaleString('en-IN')} resent for owner approval`, quotFiles)
  }

  function submitSendToClient() {
    if (!sel) return
    if (sel === 'client_approved') {
      save({
        flowStage: 'advance_payment', flowStatus: 'ready', status: 'pending',
        title: 'Collect Advance Payment',
      }, 'Client approved — collect advance payment')
    } else {
      save({ flowStatus: 'client_rejected', status: 'overdue', clientRejectionReason: clientRejReason || undefined },
        `Client rejected${clientRejReason ? ': ' + clientRejReason : ''}`)
    }
  }

  function submitClientRejectionAction() {
    if (!clientRejAction) return
    if (clientRejAction === 'drop_project') {
      save({
        flowStatus: 'dropped', status: 'overdue',
        title: 'Project Dropped',
      }, 'Project dropped after client rejection')
    }
    // 'resend' case handled via submitResendUpdatedQuotation below
  }

  function submitResendUpdatedQuotation() {
    if (!quotAmt)               { setError('Enter the revised quotation amount.'); return }
    if (quotFiles.length === 0) { setError('Upload the revised quotation file.'); return }
    const quotAmount = Number(quotAmt)
    const sqft  = costSqft ? Number(costSqft) : 0
    const matC  = costMaterial ? Number(costMaterial) : 0
    const prodC = sqft > 0 ? sqft * 100 : 0
    const instC = sqft > 0 ? sqft * 25  : 0
    const transC = costTransAmt ? Number(costTransAmt) : 0
    const hasCosts = matC > 0 || prodC > 0 || instC > 0 || transC > 0
    const breakdown: CostBreakdown | undefined = hasCosts ? {
      quotationAmount: quotAmount,
      numberOfSqft:    sqft > 0 ? sqft : undefined,
      materialCost:    matC,
      productionCost:  prodC,
      installationCost:instC,
      transportCost:   transC,
      profit:          quotAmount - (matC + prodC + instC + transC),
    } : undefined
    save({
      flowStage: 'owner_approval', flowStatus: 'waiting', status: 'pending',
      title: 'Approve Quotation',
      quotationAmount: quotAmount,
      quotationFile: quotFiles[0],
      quotationNotes: quotNotes || undefined,
      costBreakdown: breakdown,
      clientRejectionReason: undefined,
    }, `Revised quotation ₹${quotAmount.toLocaleString('en-IN')} sent for owner approval after client rejection`, quotFiles)
  }

  function submitEditCostBreakdown() {
    if (!quotAmt) { setError('Enter the quotation amount to save.'); return }
    const quotAmount = Number(quotAmt)
    const sqft  = costSqft ? Number(costSqft) : 0
    const matC  = costMaterial ? Number(costMaterial) : 0
    const prodC = sqft > 0 ? sqft * 100 : 0
    const instC = sqft > 0 ? sqft * 25  : 0
    const transC = costTransAmt ? Number(costTransAmt) : 0
    const breakdown: CostBreakdown = {
      quotationAmount: quotAmount,
      numberOfSqft:    sqft > 0 ? sqft : task.costBreakdown?.numberOfSqft,
      materialCost:    matC || task.costBreakdown?.materialCost || 0,
      productionCost:  prodC || task.costBreakdown?.productionCost || 0,
      installationCost:instC || task.costBreakdown?.installationCost || 0,
      transportCost:   transC || task.costBreakdown?.transportCost || 0,
      profit:          quotAmount - ((matC || task.costBreakdown?.materialCost || 0) + (prodC || task.costBreakdown?.productionCost || 0) + (instC || task.costBreakdown?.installationCost || 0) + (transC || task.costBreakdown?.transportCost || 0)),
    }
    save({ quotationAmount: quotAmount, costBreakdown: breakdown },
      `Cost breakdown updated by ${user?.name ?? role}`)
    setShowEditCost(false)
  }

  function submitProductionAssign() {
    const hasJobSheet = jobSheetFiles.length > 0 || jobSheetText.trim().length > 0
    if (!hasJobSheet) { setError('Upload job sheet or type job sheet details.'); return }
    save({
      flowStage: 'production_check', flowStatus: 'waiting', status: 'pending',
      title: 'Check Material Availability',
      jobSheet: jobSheetFiles[0] ?? undefined,
      jobSheetDetails: jobSheetText || undefined,
      glassSheet: glassSheetFiles[0] ?? undefined,
      cuttingSheet: cuttingSheetFiles[0] ?? undefined,
      additionalDocs: additionalDocs.length > 0 ? additionalDocs : undefined,
      productionSheetNote: prodAssignNote || undefined,
    }, 'Job sheet sent to Production Incharge — checking material availability', [...jobSheetFiles, ...glassSheetFiles, ...cuttingSheetFiles, ...additionalDocs])
  }

  function submitProductionCheck() {
    const mandatory = availChecklist.filter(i => i.id !== 'glass')
    const notAvailMandatory = mandatory.filter(i => i.status === 'not_available')
    const orderedMandatory  = mandatory.filter(i => i.status === 'order')

    for (const item of notAvailMandatory) {
      if (!item.reason.trim()) { setError(`Enter reason for ${item.label} not available.`); return }
    }

    const savedChecklist = availChecklist.map(i => ({
      id: i.id, label: i.label,
      available: i.status === 'available',
      ordered: i.status === 'order',
      notAvailableReason: i.reason || undefined,
    }))

    if (notAvailMandatory.length > 0) {
      const missingLabel = notAvailMandatory.map(i => `${i.label} (${i.reason})`).join(', ')
      save({
        flowStatus: 'not_available', status: 'overdue',
        notAvailableReason: `Not available: ${missingLabel}`,
        availabilityChecklist: savedChecklist,
      }, `Materials not available: ${missingLabel}`, [])
      return
    }

    if (orderedMandatory.length > 0) {
      const orderedLabel = orderedMandatory.map(i => i.label).join(', ')
      save({
        flowStatus: 'materials_ordered', status: 'pending',
        notAvailableReason: undefined,
        availabilityChecklist: savedChecklist,
      }, `Admin ordered: ${orderedLabel} — waiting for delivery`)
      return
    }

    const glassItem = availChecklist.find(i => i.id === 'glass')
    const glassNote = glassItem?.status === 'not_available' ? ' (Glass not available — noted)' : glassItem?.status === 'order' ? ' (Glass being ordered)' : ''
    const glassOrdered = glassItem?.status === 'order' ? ` — ordering glass` : ''
    save({
      flowStage: 'production_work', flowStatus: 'ready', status: 'pending',
      title: 'Start Production Work',
      notAvailableReason: undefined,
      availabilityChecklist: savedChecklist,
    }, `Materials checked${glassNote}${glassOrdered} — starting production`)
  }

  function submitNotAvailLmAction() {
    if (!notAvailLmAction) return
    if (notAvailLmAction === 'wait') {
      save({ flowStatus: 'waiting_stock', status: 'overdue' }, 'Waiting for stock to arrive')
    } else if (notAvailLmAction === 'recheck') {
      save({
        flowStage: 'production_check', flowStatus: 'waiting', status: 'pending',
        title: 'Check Material Availability',
        notAvailableReason: undefined,
      }, 'Sales Team sent back to Production Incharge for recheck')
    } else if (notAvailLmAction === 'assign_pm') {
      save({
        flowStage: 'production_work', flowStatus: 'ready', status: 'pending',
        title: 'Start Production Work',
        notAvailableReason: undefined,
      }, 'Materials resolved — starting production')
    }
  }

  function submitAdvancePayment() {
    if (!sel) return
    if (sel === 'pending') {
      save({ flowStatus: 'pending', status: 'pending' }, 'Advance payment pending'); return
    }
    if (!advPaidAmt) { setError('Enter paid amount.'); return }
    const paid    = Number(advPaidAmt)
    const total   = task.quotationAmount ?? 0
    const balance = advBalAmt ? Number(advBalAmt) : Math.max(0, total - paid)
    save({
      flowStage: 'production_assign', flowStatus: 'ready', status: 'pending',
      title: 'Upload Job Sheet to Admin',
      advancePaymentType: sel,
      paidAmount: paid, balanceAmount: balance,
      paymentNote: advNote || undefined,
      advancePaymentScreenshot: advPayScreenshot.length > 0 ? advPayScreenshot : undefined,
    }, `Advance ₹${paid.toLocaleString('en-IN')} received — LM to send job sheet to Admin`, advPayScreenshot)
  }

  function submitProductionWork() {
    save({
      flowStage: 'installation_assign', flowStatus: 'ready', status: 'pending',
      title: 'Assign Installation',
      productionOverdueReason: undefined, productionNewDate: undefined,
    }, 'Production completed — Ready to Dispatch')
  }

  function submitProductionProgress() {
    const doneCt = prodChecklist.filter(i => i.done).length
    if (doneCt === 0) { setError('Tick at least one step before submitting progress.'); return }
    const pct = Math.round((doneCt / prodChecklist.length) * 100)
    save({
      flowStatus: 'in_progress', status: 'in_progress',
      productionChecklist: prodChecklist,
    }, `Production progress saved: ${doneCt}/${prodChecklist.length} steps done (${pct}%)`)
  }

  function submitDemoProductionProgress() {
    const doneCt = prodChecklist.filter(i => i.done).length
    if (doneCt === 0) { setError('Tick at least one step before submitting progress.'); return }
    const pct = Math.round((doneCt / prodChecklist.length) * 100)
    demoSave({
      flowStatus: 'in_progress', status: 'in_progress',
      productionChecklist: prodChecklist,
    }, `Production progress saved: ${doneCt}/${prodChecklist.length} steps done (${pct}%)`)
  }

  function submitProductionWorkOverdue() {
    if (!overdueNote.trim()) { setError('Add reason for overdue.'); return }
    if (!overdueNewDate)     { setError('Enter new expected date.'); return }
    save({ flowStatus: 'overdue', status: 'overdue', productionOverdueReason: overdueNote, productionNewDate: overdueNewDate },
      `Production overdue: ${overdueNote}`, overdueFiles)
  }

  function submitLmOverdueUpdate() {
    if (!lmNewDate) { setError('Select a new date to send back.'); return }
    save({ flowStatus: 'date_updated', status: 'in_progress', productionNewDate: lmNewDate, note: lmNote || undefined },
      `New production date: ${lmNewDate}`)
  }

  function submitInstallationAssign() {
    if (!instPerson) { setError('Select an installer.'); return }
    if (!instDate)   { setError('Select installation date.'); return }
    save({
      flowStage: 'installation_update', flowStatus: 'assigned', status: 'in_progress',
      title: 'Update Installation Status',
      installationPerson: instPerson, installationDate: instDate,
      installationFiles: instFiles.length ? instFiles : undefined,
      installationNote: instNote || undefined,
      specialNoteInstallation: voiceNoteInstallationIds.length ? voiceNoteInstallationIds : undefined,
    }, `Installation assigned to ${instPerson} on ${instDate}`, instFiles)
  }

  function submitInstallationUpdate() {
    if (!sel) return
    if (sel === 'completed') {
      save({ flowStage: 'final_payment', flowStatus: 'pending', status: 'pending', title: 'Collect Final Payment' },
        'Installation completed')
    } else if (sel === 'not_completed') {
      if (!instNotCompNote.trim()) { setError('Add reason before saving.'); return }
      save({ flowStatus: 'not_completed', status: 'overdue', installationMistakeDetails: instNotCompNote },
        `Not completed: ${instNotCompNote}`, instNotCompFiles)
    } else {
      if (!instMistakeNote.trim()) { setError('Add mistake details.'); return }
      save({
        flowStatus: 'mistake', status: 'overdue',
        installationMistakeDetails: instMistakeNote,
        specialNoteInstallation: voiceNoteInstallationIds.length ? voiceNoteInstallationIds : undefined,
      }, `Mistake: ${instMistakeNote}`, [])
    }
  }

  function submitInstallationMistakeReview() {
    if (!instMistakeReviewAction) return
    if (instMistakeReviewAction === 'send_back_prod_admin') {
      save({
        flowStage: 'production_check', flowStatus: 'waiting', status: 'pending',
        title: 'Check Material Availability',
      }, 'Installation mistake — sent back to Production Incharge for material check')
    } else if (instMistakeReviewAction === 'send_back_prod_manager') {
      save({
        flowStage: 'production_work', flowStatus: 'pending', status: 'in_progress',
        title: 'Production Work',
      }, 'Installation mistake — sent back to Production Incharge for rework')
    } else if (instMistakeReviewAction === 'reassign_installation') {
      save({
        flowStage: 'installation_assign', flowStatus: 'ready', status: 'pending',
        title: 'Assign Installation',
        installationPerson: undefined,
        installationDate: undefined,
      }, 'Installation mistake — reassigning installation team')
    } else if (instMistakeReviewAction === 'mark_resolved') {
      save({
        flowStage: 'final_payment', flowStatus: 'pending', status: 'pending',
        title: 'Collect Final Payment',
      }, 'Installation mistake resolved — collecting final payment')
    }
  }

  function submitFinalPayment() {
    if (!sel) return
    if (sel === 'full_paid') {
      const advance = task.paidAmount ?? 0
      const newPaid = finalPaidAmt ? Number(finalPaidAmt) : 0
      const totalPaid = advance + newPaid || (task.quotationAmount ?? 0)
      save({
        flowStage: 'final_completion',
        flowStatus: 'full_paid',
        status: 'pending',
        title: 'Complete Project',
        paidAmount: totalPaid,
        balanceAmount: 0,
      }, `Full payment ₹${totalPaid.toLocaleString('en-IN')} received`)
    } else if (sel === 'partial_paid') {
      if (!finalPaidAmt) { setError('Enter additional paid amount.'); return }
      const advance  = task.paidAmount ?? 0
      const newPaid  = Number(finalPaidAmt)
      const totalPaid = advance + newPaid
      const balance  = finalBalAmt ? Number(finalBalAmt) : Math.max(0, (task.quotationAmount ?? 0) - totalPaid)
      save({ flowStatus: 'partial_paid', status: 'in_progress', paidAmount: totalPaid, balanceAmount: balance },
        `Partial payment ₹${newPaid.toLocaleString('en-IN')} received (total ₹${totalPaid.toLocaleString('en-IN')})`)
    } else if (sel === 'advance_paid') {
      save({ flowStatus: 'advance_paid', status: 'in_progress' },
        'Only advance collected — balance payment pending')
    } else {
      save({ flowStatus: 'pending', status: 'pending' }, 'Final payment pending')
    }
  }

  // ── DEMO OVERRIDE helpers ──────────────────────────────────────────────────
  const canDemoOverride = role === 'lead_manager'

  function demoSave(updates: Partial<Task>, histNote?: string, histFiles?: string[]) {
    const note = histNote
      ? `${histNote} (Demo override by Sales Team)`
      : '(Demo override by Sales Team)'
    save(updates, note, histFiles)
  }

  function submitDemoSiteVisitComplete() {
    if (sitePhotos.length === 0) { setError('Upload at least one site photo.'); return }
    // measurement files are optional
    const hasPin = (locPin.latitude && locPin.longitude) || locPin.mapLink.trim()
    if (!hasPin)                 { setError('Add site location pin before completing.'); return }
    demoSave({
      flowStage: 'site_review', flowStatus: 'ready', status: 'pending',
      title: 'Review Site Visit & Create Quotation',
      sitePhotos, measurementFiles: measFiles,
      measurementDetails: measDetails || undefined,
      locationPin: locPin,
      specialNoteProduction:   voiceNoteProductionIds.length   ? voiceNoteProductionIds   : undefined,
      specialNoteInstallation: voiceNoteInstallationIds.length ? voiceNoteInstallationIds : undefined,
      note: seNote || undefined,
    }, `Site visit completed${seNote ? `: ${seNote}` : ''}`, [...sitePhotos, ...measFiles])
  }

  function submitDemoOwnerApproval() {
    if (!sel) return
    if (sel === 'approved') {
      demoSave({
        flowStage: 'send_to_client', flowStatus: 'ready', status: 'pending',
        title: 'Send Quotation to Client',
        ownerRejectionReason: undefined,
      }, 'MD/ED approved quotation')
    } else {
      if (!ownerRejReason.trim()) { setError('Add rejection reason.'); return }
      demoSave({ flowStatus: 'rejected', status: 'overdue', ownerRejectionReason: ownerRejReason },
        `MD/ED rejected: ${ownerRejReason}`)
    }
  }

  function submitDemoProductionCheck() {
    const mandatory = availChecklist.filter(i => i.id !== 'glass')
    const notAvailMandatory = mandatory.filter(i => i.status === 'not_available')
    const orderedMandatory  = mandatory.filter(i => i.status === 'order')

    for (const item of notAvailMandatory) {
      if (!item.reason.trim()) { setError(`Enter reason for ${item.label} not available.`); return }
    }

    const savedChecklist = availChecklist.map(i => ({
      id: i.id, label: i.label,
      available: i.status === 'available',
      ordered: i.status === 'order',
      notAvailableReason: i.reason || undefined,
    }))

    if (notAvailMandatory.length > 0) {
      const missingLabel = notAvailMandatory.map(i => `${i.label} (${i.reason})`).join(', ')
      demoSave({
        flowStatus: 'not_available', status: 'overdue',
        notAvailableReason: `Not available: ${missingLabel}`,
        availabilityChecklist: savedChecklist,
      }, `Materials not available: ${missingLabel}`)
      return
    }

    if (orderedMandatory.length > 0) {
      const orderedLabel = orderedMandatory.map(i => i.label).join(', ')
      demoSave({
        flowStatus: 'materials_ordered', status: 'pending',
        notAvailableReason: undefined,
        availabilityChecklist: savedChecklist,
      }, `Admin ordered: ${orderedLabel} — waiting for delivery`)
      return
    }

    const glassItem = availChecklist.find(i => i.id === 'glass')
    const glassNote = glassItem?.status === 'order' ? ' (Glass being ordered)' : glassItem?.status === 'not_available' ? ' (Glass noted)' : ''
    demoSave({
      flowStage: 'production_work', flowStatus: 'ready', status: 'pending',
      title: 'Start Production Work',
      notAvailableReason: undefined,
      availabilityChecklist: savedChecklist,
    }, `Materials checked${glassNote} — starting production`)
  }

  function submitDemoProductionWork() {
    demoSave({
      flowStage: 'installation_assign', flowStatus: 'ready', status: 'pending',
      title: 'Assign Installation',
      productionOverdueReason: undefined, productionNewDate: undefined,
    }, 'Production completed — Ready to Dispatch')
  }

  function submitDemoProductionWorkOverdue() {
    if (!overdueNote.trim()) { setError('Add reason for overdue.'); return }
    if (!overdueNewDate)     { setError('Enter new expected date.'); return }
    demoSave({ flowStatus: 'overdue', status: 'overdue', productionOverdueReason: overdueNote, productionNewDate: overdueNewDate },
      `Production overdue: ${overdueNote}`, overdueFiles)
  }

  const totalCost = (task.productCost ?? 0) + (task.installationCost ?? 0) + (task.materialCost ?? 0) + (task.transportCost ?? 0)
  const hasCostDetails = !!(task.productCost || task.installationCost || task.materialCost || task.transportCost)

  const hasHistory = (task.statusHistory?.length ?? 0) > 0 ||
    !!(task.sitePhotos?.length) || !!task.measurementDetails ||
    !!task.rescheduleReason || !!task.requestedVisitDate || task.quotationAmount != null ||
    !!task.jobSheetDetails || task.paidAmount != null || !!task.installationPerson ||
    hasCostDetails || !!task.costBreakdown ||
    !!(task.specialNoteProduction?.length) || !!(task.specialNoteInstallation?.length)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[94vh] overflow-y-auto">

        {/* Header */}
        <div className={`sticky top-0 z-10 ${STAGE_BG[stage] ?? 'bg-blue-600'} px-5 py-4 rounded-t-3xl flex items-center justify-between`}>
          <div>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">{task.projectName}</p>
            <h2 className="text-white text-base font-extrabold leading-tight">{task.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 pb-10">

          <ContextStrip />

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-600">{error}</p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              1. SITE ASSIGN
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'site_assign' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assign Site Engineer</p>

              <div>
                <label className={lbl}>Site Engineer {req}</label>
                <select value={engineerName} onChange={e => setEngineerName(e.target.value)} className={inp}>
                  {engineerOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lbl}>
                  <span className="flex items-center gap-1.5">
                    <CalIcon /> Visit Date
                  </span>
                </label>
                <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className={inp} />
              </div>

              <TimePickerField value={visitTime} onChange={setVisitTime} />

              <div>
                <label className={lbl}>Location</label>
                <input type="text" value={assignLocation}
                  onChange={e => setAssignLocation(e.target.value)}
                  placeholder="e.g. Anna Nagar, Chennai" className={inp} />
              </div>

              <div>
                <label className={lbl}>Note <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={assignNote} onChange={e => setAssignNote(e.target.value)}
                  placeholder="Any instructions for the engineer…" className={`${inp} resize-none`} />
              </div>

              <button type="button" onClick={submitSiteAssign}
                className="w-full py-4 rounded-2xl bg-cyan-600 text-white text-sm font-extrabold active:opacity-90">
                Assign {engineerName} →
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              2a. SITE VISIT — Site Engineer
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'site_visit' && role === 'site_engineer' && (
            <>
              {/* Customer contact card — call + maps */}
              <CustomerDetailsCard task={task} project={project} />

              {/* Current schedule banner */}
              {task.visitDate && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-sm font-bold text-teal-700">
                    Scheduled: {task.visitDate}{task.visitTime ? ` at ${task.visitTime}` : ''}
                  </p>
                  {flowStatus === 'reschedule_approved' && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                      <p className="text-xs text-emerald-600 font-semibold">Reschedule approved by Sales Team</p>
                    </div>
                  )}
                </div>
              )}

              {/* Site location — shown prominently for SE navigation */}
              {(() => {
                const readable = getReadableLocation(task)
                const mapUrl   = getSiteMapUrl(task)
                if (!mapUrl) return null
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site Location</p>
                    {readable
                      ? <p className="text-sm font-semibold text-slate-700">{readable}</p>
                      : <p className="text-sm text-slate-500 italic">Site location pinned</p>
                    }
                    <MapButton url={mapUrl} />
                  </div>
                )
              })()}

              {/* RESCHEDULE REJECTED — show rejection details */}
              {flowStatus === 'reschedule_rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 space-y-1">
                  <p className="text-xs font-bold text-red-600 uppercase">Reschedule Rejected by Sales Team</p>
                  {task.rescheduleApprovalNote && (
                    <p className="text-sm text-red-700">Note: {task.rescheduleApprovalNote}</p>
                  )}
                  <p className="text-xs text-red-500">You may request a new reschedule or complete the visit as originally scheduled.</p>
                </div>
              )}

              {/* RESCHEDULE REQUESTED — block with waiting message */}
              {flowStatus === 'reschedule_requested' ? (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-amber-600 flex-shrink-0" />
                    <p className="text-sm font-bold text-amber-700">Reschedule Requested</p>
                  </div>
                  <div className="bg-amber-100 rounded-xl px-3 py-2.5 space-y-1">
                    {task.requestedVisitDate && (
                      <p className="text-xs text-amber-800">New date: <span className="font-semibold">{task.requestedVisitDate}</span></p>
                    )}
                    {task.requestedVisitTime && (
                      <p className="text-xs text-amber-800">New time: <span className="font-semibold">{task.requestedVisitTime}</span></p>
                    )}
                    <p className="text-xs text-amber-800">Reason: <span className="font-semibold">{task.rescheduleReason}</span></p>
                  </div>
                  <div className="bg-amber-100/60 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-amber-700 font-medium">⏳ Waiting for Sales Team approval. You cannot complete the site visit until the new date is approved.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Site Visit Status</p>

                  <Opt value="reschedule" label="Reschedule"  sub="Cannot visit as planned — request new date"   accent="border-amber-200"   sel={sel} onPick={pick} />
                  <Opt value="completed"  label="Completed"   sub="Visit done — upload photos and measurements"   accent="border-emerald-200" sel={sel} onPick={pick} />

                  {sel === 'reschedule' && (
                    <div className="space-y-3">
                      <div>
                        <label className={lbl}><span className="flex items-center gap-1.5"><CalIcon /> New Date</span></label>
                        <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} className={inp} />
                      </div>
                      <TimePickerField label="New Time" value={reschedTime} onChange={setReschedTime} />
                      <div>
                        <label className={lbl}>Reason {req}</label>
                        <textarea rows={3} value={reschedReason} onChange={e => setReschedReason(e.target.value)}
                          placeholder="Why is rescheduling needed?" className={`${inp} resize-none`} />
                      </div>
                      <button type="button" onClick={submitReschedule}
                        className="w-full py-4 rounded-2xl bg-amber-600 text-white text-sm font-extrabold active:opacity-90">
                        Send Reschedule Request to Sales Team
                      </button>
                    </div>
                  )}

                  {sel === 'completed' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 bg-teal-50 rounded-xl px-3 py-2">
                        <Camera size={14} className="text-teal-500 flex-shrink-0" />
                        <p className="text-xs text-teal-700 font-semibold">All fields below are required.</p>
                      </div>

                      <MultiFileUploadField label="Site Photos" required accept="image/*"
                        files={sitePhotos} onChange={setSitePhotos}
                        helperText="Upload photos of the site — minimum 1 required" />

                      <MultiFileUploadField label="Measurement Photos / Files" accept="image/*,.pdf"
                        files={measFiles} onChange={setMeasFiles}
                        helperText="Measurement photos or PDF files (optional)" />

                      <div>
                        <label className={lbl}>Measurement Details <span className="text-slate-300 font-normal">(optional)</span></label>
                        <textarea rows={4} value={measDetails} onChange={e => setMeasDetails(e.target.value)}
                          placeholder={"Enter all measurements\ne.g. Window 1: 4ft × 5ft\nWindow 2: 3ft × 4ft"}
                          className={`${inp} resize-none`} />
                      </div>

                      <LocationPinField value={locPin} onChange={setLocPin}
                        error={error.includes('location') ? error : undefined} />

                      <VoiceRecorder label="Voice Note to Production"
                        savedIds={voiceNoteProductionIds}
                        onAdd={id => setVoiceNoteProductionIds(prev => [...prev, id])}
                        onRemove={id => setVoiceNoteProductionIds(prev => prev.filter(x => x !== id))}
                        helperText="Optional voice note for production team" />

                      <VoiceRecorder label="Voice Note to Installation"
                        savedIds={voiceNoteInstallationIds}
                        onAdd={id => setVoiceNoteInstallationIds(prev => [...prev, id])}
                        onRemove={id => setVoiceNoteInstallationIds(prev => prev.filter(x => x !== id))}
                        helperText="Optional voice note for installation team" />

                      <div>
                        <label className={lbl}>Additional Note <span className="text-slate-300 font-normal">(optional)</span></label>
                        <textarea rows={2} value={seNote} onChange={e => setSeNote(e.target.value)}
                          placeholder="Any extra observations…" className={`${inp} resize-none`} />
                      </div>

                      <button type="button" onClick={submitSiteVisitComplete}
                        className="w-full py-4 rounded-2xl bg-teal-600 text-white text-sm font-extrabold active:opacity-90">
                        ✓ Complete Site Visit &amp; Submit
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              2b. SITE VISIT — Sales Team view
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'site_visit' && role !== 'site_engineer' && (
            flowStatus === 'reschedule_requested' ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-amber-600" />
                    <p className="text-sm font-bold text-amber-700">Engineer Requested a Reschedule</p>
                  </div>
                  <p className="text-xs text-amber-600 font-semibold">Engineer: {task.siteEngineerName ?? '—'}</p>
                  <div className="bg-amber-100 rounded-xl px-3 py-2.5 space-y-1">
                    <p className="text-xs text-amber-800">Original: {task.visitDate ?? '—'}{task.visitTime ? ` at ${task.visitTime}` : ''}</p>
                    <p className="text-xs text-amber-800 font-semibold">Requested: {task.requestedVisitDate ?? '—'}{task.requestedVisitTime ? ` at ${task.requestedVisitTime}` : ''}</p>
                    <p className="text-xs text-amber-800">Reason: <span className="font-semibold">{task.rescheduleReason}</span></p>
                  </div>
                </div>

                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Approve or Reject Reschedule</p>
                <Opt value="approved" label="Approve Reschedule" sub="Allow site visit to move to the new date" accent="border-emerald-200" sel={sel} onPick={pick} />
                <Opt value="rejected" label="Reject Reschedule"  sub="Engineer must complete visit on original date" accent="border-red-200" sel={sel} onPick={pick} />

                {sel === 'rejected' && (
                  <div>
                    <label className={lbl}>Rejection Note <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea rows={2} value={lmReschedNote} onChange={e => setLmReschedNote(e.target.value)}
                      placeholder="Reason for rejection…" className={`${inp} resize-none`} />
                  </div>
                )}

                {sel && (
                  <button type="button" onClick={submitRescheduleApprovalInPlace}
                    className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${sel === 'approved' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {sel === 'approved' ? '✓ Approve Reschedule' : 'Reject Reschedule'}
                  </button>
                )}
              </>
            ) : flowStatus === 'rescheduled' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-amber-600" />
                  <p className="text-sm font-bold text-amber-700">Site Visit Rescheduled</p>
                </div>
                {(task.rescheduleDate || task.rescheduleTime) && (
                  <p className="text-sm font-semibold text-amber-800">
                    New date: {task.rescheduleDate ?? '—'}{task.rescheduleTime ? ` at ${task.rescheduleTime}` : ''}
                  </p>
                )}
                {task.rescheduleReason && (
                  <div className="bg-amber-100 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-amber-600 font-bold uppercase mb-0.5">Reason</p>
                    <p className="text-xs text-amber-800">{task.rescheduleReason}</p>
                  </div>
                )}
                <p className="text-xs text-amber-500">Engineer: {task.siteEngineerName ?? '—'}</p>
              </div>
            ) : !demoOverride ? (
              <WaitingView
                icon={MapPinIcon}
                color="bg-teal-50 border border-teal-200 text-teal-700"
                title={`Site Visit Pending — ${task.siteEngineerName ?? 'Engineer'}`}
                sub={`Visit ${task.visitDate ? `on ${task.visitDate}` : 'date TBD'}${task.visitTime ? ` at ${task.visitTime}` : ''}`}
              />
            ) : null
          )}

          {/* DEMO CONTROL: Site Visit */}
          {stage === 'site_visit' && canDemoOverride && flowStatus !== 'reschedule_requested' && !demoOverride && (
            <DemoControlCard
              waitingFor="Site Engineer"
              description="Site Engineer needs to complete the site visit. For demo, submit it directly."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {stage === 'site_visit' && canDemoOverride && flowStatus !== 'reschedule_requested' && demoOverride && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Demo Override — Acting as Site Engineer</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>

              {/* Customer contact card in demo override */}
              <CustomerDetailsCard task={task} project={project} />

              <div className="flex items-center gap-2 bg-teal-50 rounded-xl px-3 py-2">
                <Camera size={14} className="text-teal-500 flex-shrink-0" />
                <p className="text-xs text-teal-700 font-semibold">Upload site visit data below.</p>
              </div>

              <MultiFileUploadField label="Site Photos" required accept="image/*"
                files={sitePhotos} onChange={setSitePhotos}
                helperText="Upload photos of the site — minimum 1 required" />

              <MultiFileUploadField label="Measurement Photos / Files" accept="image/*,.pdf"
                files={measFiles} onChange={setMeasFiles}
                helperText="Measurement photos or PDF files (optional)" />

              <div>
                <label className={lbl}>Measurement Details <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={4} value={measDetails} onChange={e => setMeasDetails(e.target.value)}
                  placeholder={"Enter all measurements\ne.g. Window 1: 4ft × 5ft\nWindow 2: 3ft × 4ft"}
                  className={`${inp} resize-none`} />
              </div>

              <LocationPinField value={locPin} onChange={setLocPin}
                error={error.includes('location') ? error : undefined} />

              <VoiceRecorder label="Voice Note to Production"
                savedIds={voiceNoteProductionIds}
                onAdd={id => setVoiceNoteProductionIds(prev => [...prev, id])}
                onRemove={id => setVoiceNoteProductionIds(prev => prev.filter(x => x !== id))}
                helperText="Optional voice note for production team" />

              <VoiceRecorder label="Voice Note to Installation"
                savedIds={voiceNoteInstallationIds}
                onAdd={id => setVoiceNoteInstallationIds(prev => [...prev, id])}
                onRemove={id => setVoiceNoteInstallationIds(prev => prev.filter(x => x !== id))}
                helperText="Optional voice note for installation team" />

              <div>
                <label className={lbl}>Note <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={seNote} onChange={e => setSeNote(e.target.value)}
                  placeholder="Any observations…" className={`${inp} resize-none`} />
              </div>

              <button type="button" onClick={submitDemoSiteVisitComplete}
                className="w-full py-4 rounded-2xl bg-amber-600 text-white text-sm font-extrabold active:opacity-90">
                ✓ Submit Site Visit (Demo Override) →
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              RESCHEDULE REVIEW — LM approves or rejects SE reschedule
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'reschedule_review' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reschedule Request</p>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-2">
                <p className="text-xs font-bold text-amber-600 uppercase">Engineer Details</p>
                <p className="text-sm font-semibold text-amber-800">Engineer: {task.siteEngineerName ?? '—'}</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white rounded-xl px-3 py-2 border border-amber-200">
                    <p className="text-[10px] text-amber-500 font-bold uppercase mb-0.5">Original Visit</p>
                    <p className="text-xs font-semibold text-slate-700">{task.visitDate ?? '—'}</p>
                    {task.visitTime && <p className="text-xs text-slate-500">{task.visitTime}</p>}
                  </div>
                  <div className="bg-white rounded-xl px-3 py-2 border border-amber-200">
                    <p className="text-[10px] text-amber-500 font-bold uppercase mb-0.5">Requested Date</p>
                    <p className="text-xs font-semibold text-slate-700">{task.requestedVisitDate ?? '—'}</p>
                    {task.requestedVisitTime && <p className="text-xs text-slate-500">{task.requestedVisitTime}</p>}
                  </div>
                </div>
                {task.rescheduleReason && (
                  <div className="bg-amber-100 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-amber-600 font-bold uppercase mb-0.5">Reason</p>
                    <p className="text-xs text-amber-800">{task.rescheduleReason}</p>
                  </div>
                )}
              </div>

              {/* Already reviewed */}
              {(flowStatus === 'approved' || flowStatus === 'rejected') ? (
                <div className={`rounded-2xl px-4 py-4 ${flowStatus === 'approved' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-sm font-bold ${flowStatus === 'approved' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {flowStatus === 'approved' ? '✓ Reschedule Approved' : '✗ Reschedule Rejected'}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Your Decision</p>
                  <Opt value="approved" label="Approve Reschedule" sub="Update visit to requested date and time" accent="border-emerald-200" sel={sel} onPick={pick} />
                  <Opt value="rejected" label="Reject Reschedule"  sub="Keep original visit date"                accent="border-red-200"     sel={sel} onPick={pick} />

                  <div>
                    <label className={lbl}>Note to Engineer <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea rows={2} value={lmReschedNote} onChange={e => setLmReschedNote(e.target.value)}
                      placeholder="Reason for decision…" className={`${inp} resize-none`} />
                  </div>

                  {sel && (
                    <button type="button" onClick={submitRescheduleApproval}
                      className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${sel === 'approved' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                      {sel === 'approved' ? '✓ Approve — Update Visit Date' : 'Reject Reschedule'}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              3. SITE REVIEW — LM creates quotation
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'site_review' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Site Visit Summary</p>

              {task.sitePhotos && task.sitePhotos.length > 0 && (
                <div className="bg-teal-50 rounded-xl px-4 py-3">
                  <MediaPreviewList
                    files={task.sitePhotos}
                    title={`Site Photos (${task.sitePhotos.length})`}
                  />
                </div>
              )}
              {task.measurementFiles && task.measurementFiles.length > 0 && (
                <div className="bg-violet-50 rounded-xl px-4 py-3">
                  <MediaPreviewList
                    files={task.measurementFiles}
                    title={`Measurement Files (${task.measurementFiles.length})`}
                  />
                </div>
              )}
              {task.measurementDetails && (
                <div className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Measurements</p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{task.measurementDetails}</p>
                </div>
              )}
              {task.locationPin && (task.locationPin.latitude || task.locationPin.mapLink) && (
                <div className="bg-emerald-50 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1">Site Location</p>
                  {(() => {
                    const readable = getReadableLocation(task)
                    const mapUrl   = getSiteMapUrl(task)
                    return (
                      <>
                        {readable
                          ? <p className="text-sm font-semibold text-slate-700">{readable}</p>
                          : <p className="text-sm text-slate-500 italic">Site location pinned</p>
                        }
                        {mapUrl && (
                          <MapButton url={mapUrl}
                            className="flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold active:bg-green-700 w-full min-h-[44px]" />
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {task.measurementType && (
                <div className="bg-slate-50 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Measurement Type</p>
                  <p className="text-xs font-semibold text-slate-700">{task.measurementType}</p>
                </div>
              )}

              {(!!task.specialNoteProduction?.length || !!task.specialNoteInstallation?.length) && (
                <div className="bg-purple-50 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-[10px] text-purple-500 font-bold uppercase">Voice Notes</p>
                  {!!task.specialNoteProduction?.length && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-purple-400 font-semibold">To Production</p>
                      <MediaPreviewList files={task.specialNoteProduction} />
                    </div>
                  )}
                  {!!task.specialNoteInstallation?.length && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-purple-400 font-semibold">To Installation</p>
                      <MediaPreviewList files={task.specialNoteInstallation} />
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">Create Quotation</p>

              <div>
                <label className={lbl}>Quotation Amount (₹) {req}</label>
                <input type="text" inputMode="numeric" value={quotAmt}
                  onChange={e => setQuotAmt(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 175000" className={inp} />
              </div>

              <MultiFileUploadField label="Quotation File" required accept=".pdf,.xlsx,.xls,.doc,.docx"
                files={quotFiles} onChange={setQuotFiles}
                helperText="Upload quotation PDF or document — required" />

              <div>
                <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={quotNotes} onChange={e => setQuotNotes(e.target.value)}
                  placeholder="Terms, conditions, or special notes…" className={`${inp} resize-none`} />
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">Cost Breakdown <span className="text-slate-300 font-normal normal-case">(optional but recommended)</span></p>

              <div className="space-y-3">
                <div>
                  <label className={lbl}>Material Cost (₹)</label>
                  <input type="text" inputMode="numeric" value={costMaterial}
                    onChange={e => setCostMaterial(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter material cost" className={inp} />
                </div>

                <div>
                  <label className={lbl}>Transport Cost (₹)</label>
                  <input type="text" inputMode="numeric" value={costTransAmt}
                    onChange={e => setCostTransAmt(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter transport cost" className={inp} />
                </div>

                <div>
                  <label className={lbl}>No. of Sq.Ft</label>
                  <input type="text" inputMode="numeric" value={costSqft}
                    onChange={e => setCostSqft(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 120 — drives production & installation cost" className={inp} />
                </div>

                {costSqft && Number(costSqft) > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-semibold text-blue-700">Production Cost <span className="font-normal text-blue-400">(₹100 × sq.ft)</span></span>
                      <span className="text-sm font-extrabold text-blue-700">₹{(Number(costSqft) * 100).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-semibold text-violet-700">Installation Cost <span className="font-normal text-violet-400">(₹25 × sq.ft)</span></span>
                      <span className="text-sm font-extrabold text-violet-700">₹{(Number(costSqft) * 25).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>

              {(costMaterial || costSqft || costTransAmt) && (
                (() => {
                  const sqft  = Number(costSqft) || 0
                  const totalC = (Number(costMaterial)||0) + sqft * 100 + sqft * 25 + (Number(costTransAmt)||0)
                  return (
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Total Costs</span>
                        <span className="font-semibold text-slate-700">₹{totalC.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )
                })()
              )}

              <button type="button" onClick={submitSiteReview}
                className="w-full py-4 rounded-2xl bg-violet-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <Send size={15} /> Send Quotation for Approval
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              4a. OWNER APPROVAL — Owner only
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'owner_approval' && role === 'owner' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quotation Review</p>

              {task.quotationAmount && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-violet-500 font-bold uppercase">Quotation Amount</p>
                  <p className="text-xl font-extrabold text-violet-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                  {task.quotationProductType && <p className="text-xs text-violet-500 mt-0.5">{task.quotationProductType}</p>}
                  {task.quotationNotes && <p className="text-xs text-violet-400 mt-1">{task.quotationNotes}</p>}
                </div>
              )}

              {task.costBreakdown && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Cost Breakdown</p>
                  {task.costBreakdown.numberOfSqft && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Area</span>
                      <span className="font-semibold text-slate-700">{task.costBreakdown.numberOfSqft} sq.ft</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Material</span>
                    <span className="font-semibold text-slate-700">₹{task.costBreakdown.materialCost.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Production</span>
                    <span className="font-semibold text-slate-700">₹{task.costBreakdown.productionCost.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Installation</span>
                    <span className="font-semibold text-slate-700">₹{task.costBreakdown.installationCost.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Transport</span>
                    <span className="font-semibold text-slate-700">₹{task.costBreakdown.transportCost.toLocaleString('en-IN')}</span>
                  </div>
                  {canSeeProfit && task.costBreakdown.profit != null && (() => {
                    const p = task.costBreakdown!.profit!
                    const pct = task.costBreakdown!.quotationAmount > 0 ? (p / task.costBreakdown!.quotationAmount * 100) : 0
                    return (
                      <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5 mt-0.5">
                        <span className="font-bold text-slate-700">Profit (MD/ED only)</span>
                        <span className={`font-bold ${p >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ₹{p.toLocaleString('en-IN')} <span className="font-normal opacity-70">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}

              <Opt value="approved" label="Approve" sub="Quotation is correct — send to client" accent="border-emerald-200" sel={sel} onPick={pick} />
              <Opt value="rejected" label="Reject"  sub="Quotation needs revision"              accent="border-red-200"     sel={sel} onPick={pick} />

              {sel === 'rejected' && (
                <div>
                  <label className={lbl}>Rejection Reason {req}</label>
                  <textarea rows={3} value={ownerRejReason} onChange={e => setOwnerRejReason(e.target.value)}
                    placeholder="Why is the quotation being rejected?"
                    className={`${inp} border-red-200 resize-none focus:border-red-400`} />
                </div>
              )}

              {sel && (
                <button type="button" onClick={submitOwnerApproval}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${sel === 'approved' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                  {sel === 'approved' ? '✓ Approve Quotation' : 'Reject Quotation'}
                </button>
              )}
            </>
          )}

          {/* 4b. OWNER APPROVAL — LM waiting */}
          {stage === 'owner_approval' && role !== 'owner' && flowStatus !== 'rejected' && !demoOverride && (
            <WaitingView icon={Clock} color="bg-purple-50 border border-purple-200 text-purple-700"
              title="Waiting for MD/ED Approval"
              sub={`Quotation ₹${task.quotationAmount?.toLocaleString('en-IN') ?? '—'} sent for MD/ED review`} />
          )}

          {/* DEMO CONTROL: Owner Approval */}
          {stage === 'owner_approval' && canDemoOverride && flowStatus !== 'rejected' && !demoOverride && (
            <DemoControlCard
              waitingFor="MD/ED"
              description="MD/ED needs to approve or reject the quotation. For demo, approve or reject it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {stage === 'owner_approval' && canDemoOverride && flowStatus !== 'rejected' && demoOverride && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Demo Override — Acting as MD/ED</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>

              {task.quotationAmount && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-violet-500 font-bold uppercase">Quotation Amount</p>
                  <p className="text-xl font-extrabold text-violet-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                  {task.quotationProductType && <p className="text-xs text-violet-500 mt-0.5">{task.quotationProductType}</p>}
                  {task.quotationNotes && <p className="text-xs text-violet-400 mt-1">{task.quotationNotes}</p>}
                </div>
              )}

              {task.costBreakdown && canSeeCosts && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Cost Breakdown</p>
                  {task.costBreakdown.numberOfSqft && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Area</span>
                      <span className="font-semibold text-slate-700">{task.costBreakdown.numberOfSqft} sq.ft</span>
                    </div>
                  )}
                  {[
                    { label: 'Material',     val: task.costBreakdown.materialCost },
                    { label: 'Production',   val: task.costBreakdown.productionCost },
                    { label: 'Installation', val: task.costBreakdown.installationCost },
                    { label: 'Transport',    val: task.costBreakdown.transportCost },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold text-slate-700">₹{val.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {canSeeProfit && (() => {
                    const cb = task.costBreakdown!
                    const costs = cb.materialCost + cb.productionCost + cb.installationCost + cb.transportCost
                    const profit = cb.profit ?? (cb.quotationAmount - costs)
                    const profitPct = cb.quotationAmount > 0 ? (profit / cb.quotationAmount * 100) : 0
                    return (
                      <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5 mt-0.5">
                        <span className="font-bold text-slate-700">Profit</span>
                        <span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ₹{profit.toLocaleString('en-IN')} <span className="font-normal opacity-70">({profitPct.toFixed(1)}%)</span>
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}

              <Opt value="approved" label="Approve" sub="Quotation is correct — send to client" accent="border-emerald-200" sel={sel} onPick={pick} />
              <Opt value="rejected" label="Reject"  sub="Quotation needs revision"              accent="border-red-200"     sel={sel} onPick={pick} />

              {sel === 'rejected' && (
                <div>
                  <label className={lbl}>Rejection Reason {req}</label>
                  <textarea rows={3} value={ownerRejReason} onChange={e => setOwnerRejReason(e.target.value)}
                    placeholder="Why is the quotation being rejected?"
                    className={`${inp} border-red-200 resize-none focus:border-red-400`} />
                </div>
              )}

              {sel && (
                <button type="button" onClick={submitDemoOwnerApproval}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${sel === 'approved' ? 'bg-amber-600' : 'bg-red-600'}`}>
                  {sel === 'approved' ? '✓ Approve Quotation (Demo Override)' : 'Reject Quotation (Demo Override)'}
                </button>
              )}
            </div>
          )}

          {/* 4c. OWNER APPROVAL — LM revision after rejection */}
          {stage === 'owner_approval' && role !== 'owner' && flowStatus === 'rejected' && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-1">
                <p className="text-xs font-bold text-red-600 uppercase">MD/ED Rejected</p>
                <p className="text-sm text-red-700">{task.ownerRejectionReason}</p>
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resend Quotation for Approval</p>

              <div>
                <label className={lbl}>Quotation Amount (₹) {req}</label>
                <input type="text" inputMode="numeric" value={quotAmt}
                  onChange={e => setQuotAmt(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 160000" className={inp} />
              </div>

              <MultiFileUploadField label="Quotation File" required accept=".pdf,.xlsx,.xls,.doc,.docx" files={quotFiles} onChange={setQuotFiles} helperText="Upload revised quotation document" />

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-1">Cost Breakdown {req}</p>

              <div>
                <label className={lbl}>Material Cost (₹)</label>
                <input type="text" inputMode="numeric" value={costMaterial}
                  onChange={e => setCostMaterial(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter material cost" className={inp} />
              </div>

              <div>
                <label className={lbl}>Transport Cost (₹)</label>
                <input type="text" inputMode="numeric" value={costTransAmt}
                  onChange={e => setCostTransAmt(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter transport cost" className={inp} />
              </div>

              <div>
                <label className={lbl}>No. of Sq.Ft</label>
                <input type="text" inputMode="numeric" value={costSqft}
                  onChange={e => setCostSqft(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 120 — drives production & installation cost" className={inp} />
              </div>

              {costSqft && Number(costSqft) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                    <span className="text-xs font-semibold text-blue-700">Production Cost <span className="font-normal text-blue-400">(₹100 × sq.ft)</span></span>
                    <span className="text-sm font-extrabold text-blue-700">₹{(Number(costSqft) * 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                    <span className="text-xs font-semibold text-violet-700">Installation Cost <span className="font-normal text-violet-400">(₹25 × sq.ft)</span></span>
                    <span className="text-sm font-extrabold text-violet-700">₹{(Number(costSqft) * 25).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              {/* Profit display — only meaningful when owner reviews; this form is for non-owners */}

              <div>
                <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={quotNotes} onChange={e => setQuotNotes(e.target.value)}
                  placeholder="Changes made or additional notes…" className={`${inp} resize-none`} />
              </div>

              <button type="button" onClick={submitReviseQuotation}
                className="w-full py-4 rounded-2xl bg-violet-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <Send size={15} /> Resend Quotation for Approval
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              5. SEND TO CLIENT — two-step: send → mark sent → client response
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'send_to_client' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Send Quotation to Client</p>

              {/* ── Case A: Client already rejected — LM decides next action ── */}
              {flowStatus === 'client_rejected' && (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-1">
                    <p className="text-xs font-bold text-red-500 uppercase">Client Rejected Proposal</p>
                    {task.clientRejectionReason && (
                      <p className="text-sm text-red-700 font-semibold">{task.clientRejectionReason}</p>
                    )}
                    <p className="text-xs text-red-400 mt-1">Choose how to proceed below.</p>
                  </div>

                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Next Action</p>
                  <Opt value="resend"       label="Resend Updated Quotation" sub="Revise quotation and send for owner approval first" accent="border-indigo-200" sel={clientRejAction} onPick={setClientRejAction} />
                  <Opt value="drop_project" label="Drop Project"             sub="Close this project — client is not interested"       accent="border-red-200"    sel={clientRejAction} onPick={setClientRejAction} />

                  {clientRejAction === 'drop_project' && (
                    <button type="button" onClick={submitClientRejectionAction}
                      className="w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 bg-red-600">
                      ✕ Drop This Project
                    </button>
                  )}

                  {clientRejAction === 'resend' && (
                    <div className="space-y-4 bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                      <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Revised Quotation Details</p>

                      <div>
                        <label className={lbl}>Quotation Amount (₹) {req}</label>
                        <input type="text" inputMode="numeric" value={quotAmt}
                          onChange={e => setQuotAmt(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="e.g. 170000" className={inp} />
                      </div>

                      <MultiFileUploadField label="Quotation File" required accept=".pdf,.xlsx,.xls,.doc,.docx"
                        files={quotFiles} onChange={setQuotFiles} helperText="Upload revised quotation document" />

                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cost Breakdown (optional)</p>

                      <div>
                        <label className={lbl}>Material Cost (₹)</label>
                        <input type="text" inputMode="numeric" value={costMaterial}
                          onChange={e => setCostMaterial(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="Enter material cost" className={inp} />
                      </div>

                      <div>
                        <label className={lbl}>Transport Cost (₹)</label>
                        <input type="text" inputMode="numeric" value={costTransAmt}
                          onChange={e => setCostTransAmt(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="Enter transport cost" className={inp} />
                      </div>

                      <div>
                        <label className={lbl}>No. of Sq.Ft</label>
                        <input type="text" inputMode="numeric" value={costSqft}
                          onChange={e => setCostSqft(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="e.g. 120" className={inp} />
                      </div>

                      {costSqft && Number(costSqft) > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                            <span className="text-xs font-semibold text-blue-700">Production Cost <span className="font-normal text-blue-400">(₹100 × sq.ft)</span></span>
                            <span className="text-sm font-extrabold text-blue-700">₹{(Number(costSqft) * 100).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                            <span className="text-xs font-semibold text-violet-700">Installation Cost <span className="font-normal text-violet-400">(₹25 × sq.ft)</span></span>
                            <span className="text-sm font-extrabold text-violet-700">₹{(Number(costSqft) * 25).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                        <textarea rows={2} value={quotNotes} onChange={e => setQuotNotes(e.target.value)}
                          placeholder="Changes made or additional notes…" className={`${inp} resize-none`} />
                      </div>

                      <button type="button" onClick={submitResendUpdatedQuotation}
                        className="w-full py-4 rounded-2xl bg-indigo-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                        <Send size={15} /> Resend Updated Quotation for Approval
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── Case B: Normal send + client response flow ── */}
              {flowStatus !== 'client_rejected' && (
                <>
                  {task.quotationAmount && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Approved Amount</p>
                      <p className="text-xl font-extrabold text-emerald-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                    </div>
                  )}

                  {/* Edit Cost Breakdown — owner only */}
                  {canEditCosts && !showEditCost && (
                    <button type="button" onClick={() => setShowEditCost(true)}
                      className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 active:bg-slate-50">
                      ✏ Edit Cost Breakdown
                    </button>
                  )}
                  {canEditCosts && showEditCost && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Edit Cost Breakdown</p>
                        <button type="button" onClick={() => setShowEditCost(false)} className="text-xs text-slate-400 underline">Cancel</button>
                      </div>
                      <div>
                        <label className={lbl}>Quotation Amount (₹) {req}</label>
                        <input type="text" inputMode="numeric" value={quotAmt}
                          onChange={e => setQuotAmt(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder={String(task.quotationAmount ?? 0)} className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Material Cost (₹)</label>
                        <input type="text" inputMode="numeric" value={costMaterial}
                          onChange={e => setCostMaterial(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder={String(task.costBreakdown?.materialCost ?? 0)} className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>No. of Sq.Ft</label>
                        <input type="text" inputMode="numeric" value={costSqft}
                          onChange={e => setCostSqft(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder={String(task.costBreakdown?.numberOfSqft ?? '')} className={inp} />
                      </div>
                      {costSqft && Number(costSqft) > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">Production: ₹{(Number(costSqft)*100).toLocaleString('en-IN')} · Installation: ₹{(Number(costSqft)*25).toLocaleString('en-IN')}</p>
                        </div>
                      )}
                      <div>
                        <label className={lbl}>Transport Cost (₹)</label>
                        <input type="text" inputMode="numeric" value={costTransAmt}
                          onChange={e => setCostTransAmt(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder={String(task.costBreakdown?.transportCost ?? 0)} className={inp} />
                      </div>
                      <button type="button" onClick={submitEditCostBreakdown}
                        className="w-full py-3.5 rounded-xl bg-slate-800 text-white text-sm font-bold active:opacity-90">
                        Save Cost Breakdown
                      </button>
                    </div>
                  )}

                  {/* Step 1: Send buttons */}
                  {!sentToClient && (() => {
                    const clientName = task.clientName ?? 'Sir/Madam'
                    const projName   = task.projectName ?? 'your project'
                    const phone      = (task.clientPhone ?? '6379859299').replace(/\D/g, '').replace(/^0/, '')
                    const waMsg = `Hello ${clientName},\nPlease find the quotation for ${projName}.\nKindly review the attached quotation file and confirm your approval.\nRegards,\nFenster Team`

                    function handleShareToWhatsApp() {
                      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(waMsg)}`, '_blank')
                    }

                    return (
                      <>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Greeting Message</p>
                          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{waMsg}</pre>
                        </div>

                        {task.quotationFile ? (
                          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 space-y-2">
                            <p className="text-[10px] font-bold text-violet-500 uppercase">Quotation File</p>
                            <MediaPreviewList files={[task.quotationFile]} />
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
                            <p className="text-xs text-amber-700 font-semibold">No quotation file attached. Upload one in the Quotation step.</p>
                          </div>
                        )}

                        <button type="button" onClick={handleShareToWhatsApp}
                          className="w-full py-4 rounded-2xl bg-green-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                          <PhoneCall size={16} /> Share via WhatsApp
                        </button>

                        <button type="button" onClick={() => setShowSentConfirm(true)}
                          className="w-full py-4 rounded-2xl bg-slate-800 text-white text-sm font-extrabold active:opacity-90">
                          ✓ Mark as Sent to Client
                        </button>

                        <Dialog
                          isOpen={showSentConfirm}
                          onClose={() => setShowSentConfirm(false)}
                          onConfirm={() => { setSentToClient(true); setShowSentConfirm(false) }}
                          title="Confirm Sent to Client"
                          message="Are you sure you've sent the quotation to the client?"
                          confirmLabel="Yes, Sent"
                        />
                      </>
                    )
                  })()}

                  {/* Step 2: Client response */}
                  {sentToClient && (
                    <>
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
                        <CheckCircle2 size={14} className="text-indigo-600 flex-shrink-0" />
                        <p className="text-xs font-semibold text-indigo-700">Marked as sent. What did the client say?</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client Response</p>
                      <Opt value="client_approved" label="Client Approved" sub="Collect advance payment before production" accent="border-emerald-200" sel={sel} onPick={pick} />
                      <Opt value="client_rejected" label="Client Rejected" sub="Client did not approve" accent="border-red-200" sel={sel} onPick={pick} />
                      {sel === 'client_rejected' && (
                        <div>
                          <label className={lbl}>Reason <span className="text-slate-300 font-normal">(optional)</span></label>
                          <textarea rows={2} value={clientRejReason} onChange={e => setClientRejReason(e.target.value)}
                            placeholder="Why did the client reject?" className={`${inp} border-red-200 resize-none focus:border-red-400`} />
                        </div>
                      )}
                      {sel && (
                        <button type="button" onClick={submitSendToClient}
                          className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${sel === 'client_approved' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                          {sel === 'client_approved' ? '✓ Client Approved — Collect Advance Payment' : 'Mark Client Rejected'}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              6. PRODUCTION ASSIGN — LM uploads job sheet to Admin
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'production_assign' && role !== 'lead_manager' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Package} color="bg-orange-50 border border-orange-200 text-orange-700"
              title="Waiting for Job Sheet"
              sub="Sales Team is preparing and sending the job sheet to Production Incharge" />
          )}

          {stage === 'production_assign' && role !== 'lead_manager' && role !== 'owner' && !demoOverride && canDemoOverride && (
            <DemoControlCard
              waitingFor="Sales Team"
              description="LM needs to upload the job sheet and send it to Admin. For demo, do it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}

          {stage === 'production_assign' && (role === 'lead_manager' || role === 'owner' || demoOverride) && (
            <>
              {demoOverride && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">Demo Override — Acting as Sales Team</p>
                  </div>
                  <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
                </div>
              )}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Send Job Sheet to Production Incharge</p>

              <div className="space-y-2">
                <label className={lbl}>Job Sheet {req}</label>
                <MultiFileUploadField label="" accept=".pdf,.jpg,.png,.xlsx,.xls"
                  files={jobSheetFiles} onChange={setJobSheetFiles} helperText="Upload job sheet file" />
                <p className="text-[11px] text-slate-400 text-center">— OR type job sheet details below —</p>
                <textarea rows={3} value={jobSheetText} onChange={e => setJobSheetText(e.target.value)}
                  placeholder="Type job sheet details: product specs, dimensions, quantities…"
                  className={`${inp} resize-none`} />
              </div>

              <div>
                <label className={lbl}>Glass Sheet <span className="text-slate-300 font-normal">(optional)</span></label>
                <MultiFileUploadField label="" accept=".pdf,.jpg,.png,.xlsx" files={glassSheetFiles} onChange={setGlassSheetFiles} />
              </div>

              <div>
                <label className={lbl}>Cutting Sheet <span className="text-slate-300 font-normal">(optional)</span></label>
                <MultiFileUploadField label="" accept=".pdf,.jpg,.png,.xlsx" files={cuttingSheetFiles} onChange={setCuttingSheetFiles} />
              </div>

              <div>
                <label className={lbl}>Additional Documents <span className="text-slate-300 font-normal">(optional)</span></label>
                <MultiFileUploadField label="" accept=".pdf,.jpg,.png,.xlsx,.doc,.docx" files={additionalDocs} onChange={setAdditionalDocs} helperText="Any extra reference files" />
              </div>

              <div>
                <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={prodAssignNote} onChange={e => setProdAssignNote(e.target.value)}
                  placeholder="Special instructions for production team…" className={`${inp} resize-none`} />
              </div>

              <button type="button" onClick={submitProductionAssign}
                className="w-full py-4 rounded-2xl bg-orange-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <Package size={15} /> Send Job Sheet to Admin
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              7a. PRODUCTION CHECK — Production Incharge
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'production_check' && role === 'production_admin' && flowStatus !== 'not_available' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Material Availability Check</p>

              {task.paidAmount != null && (
                <div className="bg-emerald-50 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Advance Received</p>
                  <p className="text-sm font-bold text-emerald-700">₹{task.paidAmount.toLocaleString('en-IN')}</p>
                </div>
              )}

              <div className="space-y-2">
                {availChecklist.map((item, idx) => {
                  const isOptional = item.id === 'glass'
                  const borderCls = item.status === 'available' ? 'border-emerald-200 bg-emerald-50'
                    : item.status === 'order' ? 'border-amber-200 bg-amber-50'
                    : 'border-red-200 bg-red-50'
                  return (
                    <div key={item.id} className={`rounded-xl border-2 p-3 space-y-2 transition-all ${borderCls}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.label}</p>
                          {isOptional && <p className="text-[10px] text-slate-400 font-semibold">optional</p>}
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button"
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'available',reason:''}; setAvailChecklist(n) }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${item.status === 'available' ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-600 border border-emerald-300'}`}>
                            Available
                          </button>
                          <button type="button"
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'not_available'}; setAvailChecklist(n) }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${item.status === 'not_available' ? 'bg-red-500 text-white' : 'bg-white text-red-500 border border-red-300'}`}>
                            N/A
                          </button>
                          <button type="button"
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'order',reason:''}; setAvailChecklist(n) }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${item.status === 'order' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 border border-amber-300'}`}>
                            Ordered
                          </button>
                        </div>
                      </div>
                      {item.status === 'not_available' && (
                        <input type="text" value={item.reason}
                          onChange={e => { const n=[...availChecklist]; n[idx]={...item,reason:e.target.value}; setAvailChecklist(n) }}
                          placeholder={isOptional ? 'Reason (optional)' : 'Reason — required'}
                          className="w-full text-xs bg-white border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400" />
                      )}
                    </div>
                  )
                })}
              </div>

              {(() => {
                const mandatory = availChecklist.filter(i => i.id !== 'glass')
                const allMandOk = mandatory.every(i => i.status !== 'not_available')
                return allMandOk ? (
                  <button type="button" onClick={submitProductionCheck}
                    className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90">
                    ✓ Confirm — Start Production
                  </button>
                ) : (
                  <button type="button" onClick={submitProductionCheck}
                    className="w-full py-4 rounded-2xl bg-red-600 text-white text-sm font-extrabold active:opacity-90">
                    Report Not Available
                  </button>
                )
              })()}
            </>
          )}

          {/* 7b. PRODUCTION CHECK — LM / other roles waiting */}
          {stage === 'production_check' && role !== 'production_admin' && flowStatus !== 'not_available' && !demoOverride && (
            <WaitingView icon={Package} color="bg-amber-50 border border-amber-200 text-amber-700"
              title={flowStatus === 'materials_ordered'
                ? `Admin Ordered — Waiting for Delivery`
                : 'Checking Material Availability'}
              sub={flowStatus === 'materials_ordered'
                ? `Materials have been ordered. Production starts when they arrive.`
                : 'Production Incharge is verifying Profile / Glass / Hardware stock'} />
          )}

          {/* DEMO CONTROL: Production Check */}
          {stage === 'production_check' && canDemoOverride && flowStatus !== 'not_available' && !demoOverride && (
            <DemoControlCard
              waitingFor="Production Incharge"
              description="Production Incharge needs to check material availability (Profile/Glass/Hardware). For demo, confirm it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {stage === 'production_check' && canDemoOverride && flowStatus !== 'not_available' && demoOverride && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Demo Override — Acting as Production Incharge</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Material Availability Check</p>
              <div className="space-y-2">
                {availChecklist.map((item, idx) => {
                  const isOptional = item.id === 'glass'
                  const borderCls = item.status === 'available' ? 'border-emerald-200 bg-emerald-50'
                    : item.status === 'order' ? 'border-amber-200 bg-amber-50'
                    : 'border-red-200 bg-red-50'
                  return (
                    <div key={item.id} className={`rounded-xl border-2 p-3 space-y-2 transition-all ${borderCls}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.label}</p>
                          {isOptional && <p className="text-[10px] text-slate-400 font-semibold">optional</p>}
                        </div>
                        <div className="flex gap-1.5">
                          <button type="button"
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'available',reason:''}; setAvailChecklist(n) }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${item.status === 'available' ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-600 border border-emerald-300'}`}>
                            Available
                          </button>
                          <button type="button"
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'not_available'}; setAvailChecklist(n) }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${item.status === 'not_available' ? 'bg-red-500 text-white' : 'bg-white text-red-500 border border-red-300'}`}>
                            N/A
                          </button>
                          <button type="button"
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'order',reason:''}; setAvailChecklist(n) }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${item.status === 'order' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 border border-amber-300'}`}>
                            Ordered
                          </button>
                        </div>
                      </div>
                      {item.status === 'not_available' && (
                        <input type="text" value={item.reason}
                          onChange={e => { const n=[...availChecklist]; n[idx]={...item,reason:e.target.value}; setAvailChecklist(n) }}
                          placeholder={isOptional ? 'Reason (optional)' : 'Reason — required'}
                          className="w-full text-xs bg-white border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400" />
                      )}
                    </div>
                  )
                })}
              </div>

              {(() => {
                const mandatory = availChecklist.filter(i => i.id !== 'glass')
                const allMandOk = mandatory.every(i => i.status !== 'not_available')
                return allMandOk ? (
                  <button type="button" onClick={submitDemoProductionCheck}
                    className="w-full py-4 rounded-2xl bg-amber-600 text-white text-sm font-extrabold active:opacity-90">
                    ✓ Confirm — Start Production (Demo Override)
                  </button>
                ) : (
                  <button type="button" onClick={submitDemoProductionCheck}
                    className="w-full py-4 rounded-2xl bg-red-600 text-white text-sm font-extrabold active:opacity-90">
                    Report Not Available (Demo Override)
                  </button>
                )
              })()}
            </div>
          )}

          {stage === 'production_check' && flowStatus === 'not_available' && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-2">
                <p className="text-xs font-bold text-red-600 uppercase">Materials Not Available</p>
                <p className="text-sm text-red-700">{task.notAvailableReason}</p>
                <p className="text-xs text-red-400">Production Incharge reported unavailability.</p>
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sales Team Action</p>
              <Opt value="wait"      label="Wait for Stock"               sub="Keep status and wait for material arrival"       accent="border-slate-200"  sel={notAvailLmAction} onPick={setNotAvailLmAction} />
              <Opt value="recheck"   label="Recheck Availability"         sub="Send back to Production Incharge to recheck"         accent="border-amber-200"  sel={notAvailLmAction} onPick={setNotAvailLmAction} />
              <Opt value="assign_pm" label="Assign to Production Incharge" sub="Materials resolved — proceed with production"     accent="border-emerald-200" sel={notAvailLmAction} onPick={setNotAvailLmAction} />

              {notAvailLmAction && (
                <button type="button" onClick={submitNotAvailLmAction}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${notAvailLmAction === 'assign_pm' ? 'bg-emerald-600' : notAvailLmAction === 'recheck' ? 'bg-amber-600' : 'bg-slate-500'}`}>
                  {notAvailLmAction === 'wait' ? 'Keep Waiting' : notAvailLmAction === 'recheck' ? 'Send Back to Production Incharge' : '✓ Assign to Production Incharge'}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              8. ADVANCE PAYMENT — LM only
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'advance_payment' && role !== 'lead_manager' && role !== 'owner' && (
            <WaitingView icon={CreditCard} color="bg-emerald-50 border border-emerald-200 text-emerald-700"
              title="Waiting for Advance Payment"
              sub={flowStatus === 'pending' ? 'Sales Team collecting advance payment from client' : `Advance received — production starting soon`} />
          )}

          {stage === 'advance_payment' && (role === 'lead_manager' || role === 'owner') && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Advance Payment</p>

              {task.quotationAmount && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Total Project Value</p>
                  <p className="text-xl font-extrabold text-emerald-700">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                </div>
              )}

              {flowStatus === 'pending' ? (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs text-red-700 font-bold">🚫 Production is blocked</p>
                  <p className="text-xs text-red-600">Advance payment is pending. Production cannot start until payment is received.</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-amber-700 font-semibold">⚠ Production starts only after advance payment is collected.</p>
                </div>
              )}

              <Opt value="pending"      label="Pending"      sub="No payment received yet"                accent="border-slate-200"   sel={sel} onPick={pick} />
              <Opt value="advance_paid" label="Advance Paid" sub="Client paid advance — start production" accent="border-emerald-200" sel={sel} onPick={pick} />
              <Opt value="partial_paid" label="Partial Paid" sub="Partial amount received"                accent="border-amber-200"   sel={sel} onPick={pick} />
              <Opt value="full_paid"    label="Full Paid"    sub="Complete payment received"              accent="border-green-200"   sel={sel} onPick={pick} />

              {(sel === 'advance_paid' || sel === 'partial_paid' || sel === 'full_paid') && (
                <div className="space-y-3">
                  {task.quotationAmount && (
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-slate-500">Quotation Total</span>
                      <span className="text-sm font-bold text-slate-700">₹{task.quotationAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div>
                    <label className={lbl}>Paid Amount (₹) {req}</label>
                    <input type="text" inputMode="numeric" value={advPaidAmt}
                      onChange={e => {
                        const paid = e.target.value.replace(/[^0-9]/g, '')
                        setAdvPaidAmt(paid)
                        const total = task.quotationAmount ?? 0
                        if (paid && total) setAdvBalAmt(String(Math.max(0, total - Number(paid))))
                        else setAdvBalAmt('')
                      }}
                      placeholder="e.g. 50000" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Balance Amount (₹) <span className="text-slate-300 font-normal">(auto-calculated)</span></label>
                    <input type="text" inputMode="numeric" value={advBalAmt}
                      onChange={e => setAdvBalAmt(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Auto-calculated from quotation total"
                      className={`${inp} ${advBalAmt ? 'bg-amber-50 border-amber-200' : ''}`} />
                  </div>
                  <div>
                    <label className={lbl}>Payment Note <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea rows={2} value={advNote} onChange={e => setAdvNote(e.target.value)}
                      placeholder="Payment method, reference number…" className={`${inp} resize-none`} />
                  </div>
                  <MultiFileUploadField label="Payment Screenshot" accept="image/*,.pdf" files={advPayScreenshot} onChange={setAdvPayScreenshot} helperText="Optional — upload payment proof" />
                </div>
              )}

              {sel && (
                <button type="button" onClick={submitAdvancePayment}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${sel === 'pending' ? 'bg-slate-500' : 'bg-emerald-600'}`}>
                  {sel === 'pending' ? 'Keep as Pending' : `✓ ${sel === 'advance_paid' ? 'Advance Paid' : sel === 'partial_paid' ? 'Part Paid' : 'Full Paid'} — Start Production`}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              9a. PRODUCTION WORK — Production Incharge (6-step checklist)
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'production_work' && role === 'production_manager' && flowStatus !== 'overdue' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Production Checklist</p>

              {task.paidAmount != null && (
                <div className="bg-emerald-50 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Advance Received</p>
                  <p className="text-sm font-bold text-emerald-700">₹{task.paidAmount.toLocaleString('en-IN')}</p>
                </div>
              )}
              {flowStatus === 'date_updated' && task.productionNewDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-blue-700 font-semibold">Updated deadline: {task.productionNewDate}</p>
                  {task.note && <p className="text-xs text-blue-500 mt-0.5">{task.note}</p>}
                </div>
              )}

              {/* 6-step checklist */}
              <div className="space-y-2">
                {prodChecklist.map((item, idx) => (
                  <button key={item.id} type="button"
                    onClick={() => { const n=[...prodChecklist]; n[idx]={...item,done:!item.done}; setProdChecklist(n) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${item.done ? 'bg-emerald-50 border-emerald-300' : 'border-slate-200 bg-white'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${item.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                      {item.done && <CheckCircle2 size={11} className="text-white" />}
                    </div>
                    <p className={`text-sm font-semibold ${item.done ? 'text-emerald-700' : 'text-slate-800'}`}>{item.label}</p>
                    {item.done && <span className="ml-auto text-[10px] text-emerald-500 font-bold">DONE</span>}
                  </button>
                ))}
              </div>

              {/* Progress bar */}
              {(() => {
                const doneCt = prodChecklist.filter(i => i.done).length
                const pct = Math.round((doneCt / prodChecklist.length) * 100)
                return (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-600">Production Progress</span>
                      <span className="font-bold text-slate-800">{doneCt}/{prodChecklist.length} · {pct}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}

              {/* Submit Progress — always available when at least 1 step done */}
              {!prodChecklist.every(i => i.done) && prodChecklist.some(i => i.done) && (
                <button type="button" onClick={submitProductionProgress}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-extrabold active:opacity-90">
                  Save Progress ({prodChecklist.filter(i=>i.done).length}/{prodChecklist.length} done)
                </button>
              )}

              {/* Ready to Dispatch — only when all done */}
              {prodChecklist.every(i => i.done) && (
                <button type="button" onClick={submitProductionWork}
                  className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                  <Package size={15} /> Ready to Dispatch →
                </button>
              )}

              {/* Overdue option */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 font-semibold">Report delay:</p>
                <Opt value="overdue" label="Report Overdue" sub="Work cannot be completed on time" accent="border-red-200" sel={sel} onPick={pick} />
                {sel === 'overdue' && (
                  <div className="space-y-3">
                    <NoteWithFilesField label="Reason for Overdue" required
                      noteValue={overdueNote} onNoteChange={setOverdueNote}
                      files={overdueFiles} onFilesChange={setOverdueFiles}
                      placeholder="Why is production overdue?" />
                    <div>
                      <label className={lbl}>New Expected Date {req}</label>
                      <input type="date" value={overdueNewDate} onChange={e => setOverdueNewDate(e.target.value)} className={inp} />
                    </div>
                    <button type="button" onClick={submitProductionWorkOverdue}
                      className="w-full py-4 rounded-2xl bg-red-600 text-white text-sm font-extrabold active:opacity-90">
                      Submit Overdue Report
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {stage === 'production_work' && role === 'production_manager' && flowStatus === 'overdue' && (
            <WaitingView icon={Clock} color="bg-red-50 border border-red-200 text-red-700"
              title="Overdue Report Submitted" sub="Waiting for Sales Team to update the schedule" />
          )}

          {/* 9b. PRODUCTION WORK — LM / other roles waiting / overdue update */}
          {stage === 'production_work' && role !== 'production_manager' && flowStatus !== 'overdue' && !demoOverride && (
            <WaitingView icon={Package} color="bg-blue-50 border border-blue-200 text-blue-700"
              title="Production Work In Progress"
              sub={task.productionNewDate ? `Updated deadline: ${task.productionNewDate}` : 'Production Incharge is working on it'} />
          )}

          {/* DEMO CONTROL: Production Work */}
          {stage === 'production_work' && canDemoOverride && flowStatus !== 'overdue' && !demoOverride && (
            <DemoControlCard
              waitingFor="Production Incharge"
              description="Production Incharge needs to complete all 6 production steps and mark Ready to Dispatch. For demo, complete it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {stage === 'production_work' && canDemoOverride && flowStatus !== 'overdue' && demoOverride && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Demo Override — Acting as Production Incharge</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>

              {task.paidAmount != null && (
                <div className="bg-emerald-50 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Advance Received</p>
                  <p className="text-sm font-bold text-emerald-700">₹{task.paidAmount.toLocaleString('en-IN')}</p>
                </div>
              )}

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Production Checklist</p>
              <div className="space-y-2">
                {prodChecklist.map((item, idx) => (
                  <button key={item.id} type="button"
                    onClick={() => { const n=[...prodChecklist]; n[idx]={...item,done:!item.done}; setProdChecklist(n) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${item.done ? 'bg-emerald-50 border-emerald-300' : 'border-slate-200 bg-white'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${item.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                      {item.done && <CheckCircle2 size={11} className="text-white" />}
                    </div>
                    <p className={`text-sm font-semibold ${item.done ? 'text-emerald-700' : 'text-slate-800'}`}>{item.label}</p>
                    {item.done && <span className="ml-auto text-[10px] text-emerald-500 font-bold">DONE</span>}
                  </button>
                ))}
              </div>
              {(() => {
                const doneCt = prodChecklist.filter(i => i.done).length
                const pct = Math.round((doneCt / prodChecklist.length) * 100)
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-600">Production Progress</span>
                      <span className="font-bold text-slate-800">{doneCt}/{prodChecklist.length} · {pct}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}

              {!prodChecklist.every(i => i.done) && prodChecklist.some(i => i.done) && (
                <button type="button" onClick={submitDemoProductionProgress}
                  className="w-full py-3.5 rounded-2xl bg-blue-500 text-white text-sm font-extrabold active:opacity-90">
                  Save Progress (Demo) — {prodChecklist.filter(i=>i.done).length}/{prodChecklist.length} done
                </button>
              )}
              {prodChecklist.every(i => i.done) ? (
                <button type="button" onClick={submitDemoProductionWork}
                  className="w-full py-4 rounded-2xl bg-amber-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                  <Package size={15} /> Ready to Dispatch (Demo Override) →
                </button>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <p className="text-[11px] text-slate-400 font-semibold">Or report delay (demo):</p>
                  <Opt value="overdue" label="Report Overdue" sub="Work cannot be completed on time" accent="border-red-200" sel={sel} onPick={pick} />
                  {sel === 'overdue' && (
                    <div className="space-y-3">
                      <NoteWithFilesField label="Reason for Overdue" required
                        noteValue={overdueNote} onNoteChange={setOverdueNote}
                        files={overdueFiles} onFilesChange={setOverdueFiles}
                        placeholder="Why is production overdue?" />
                      <div>
                        <label className={lbl}>New Expected Date {req}</label>
                        <input type="date" value={overdueNewDate} onChange={e => setOverdueNewDate(e.target.value)} className={inp} />
                      </div>
                      <button type="button" onClick={submitDemoProductionWorkOverdue}
                        className="w-full py-4 rounded-2xl bg-red-600 text-white text-sm font-extrabold active:opacity-90">
                        Submit Overdue Report (Demo Override)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {stage === 'production_work' && role !== 'production_manager' && flowStatus === 'overdue' && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-1">
                <p className="text-xs font-bold text-red-600 uppercase">Production Overdue</p>
                <p className="text-sm text-red-700">{task.productionOverdueReason}</p>
                {task.productionNewDate && <p className="text-xs text-red-500">PM's new date: {task.productionNewDate}</p>}
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Update Schedule</p>
              <div>
                <label className={lbl}>New Date to Send to Production {req}</label>
                <input type="date" value={lmNewDate} onChange={e => setLmNewDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Note <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={lmNote} onChange={e => setLmNote(e.target.value)}
                  placeholder="Instructions for production team…" className={`${inp} resize-none`} />
              </div>
              <button type="button" onClick={submitLmOverdueUpdate}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white text-sm font-extrabold active:opacity-90">
                Update Date &amp; Send Back to Production
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              10. INSTALLATION ASSIGN — LM only
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'installation_assign' && role !== 'technician' && role !== 'installation_incharge' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Wrench} color="bg-rose-50 border border-rose-200 text-rose-700"
              title="Ready to Dispatch"
              sub="Installation Incharge will assign the installer and schedule the date" />
          )}

          {stage === 'installation_assign' && role !== 'technician' && role !== 'installation_incharge' && role !== 'owner' && !demoOverride && canDemoOverride && (
            <DemoControlCard
              waitingFor="Installation Incharge"
              description="Installation Incharge assigns the installer and date. For demo, do it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}

          {stage === 'installation_assign' && (role === 'technician' || role === 'installation_incharge' || role === 'owner' || demoOverride) && (
            <>
              {demoOverride && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">Demo Override — Acting as Installation Incharge</p>
                  </div>
                  <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
                </div>
              )}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assign Installation</p>

              <div>
                <label className={lbl}>Installation Person {req}</label>
                <select value={instPerson} onChange={e => setInstPerson(e.target.value)} className={inp}>
                  <option value="">— Select installer —</option>
                  {installerOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lbl}><span className="flex items-center gap-1.5"><CalIcon /> Install Date</span></label>
                <input type="date" value={instDate} onChange={e => setInstDate(e.target.value)} className={inp} />
              </div>

              {(() => {
                const installLocation = task.locationPin?.label || task.locationPin?.mapLink
                  ? (task.locationPin.label || task.location || '')
                  : (task.location || '')
                return (
                  <div className="bg-teal-50 rounded-xl px-4 py-2.5">
                    <p className="text-[10px] font-bold text-teal-500 uppercase mb-0.5">Installation Location</p>
                    <p className="text-sm text-teal-800">{installLocation || '—'}</p>
                    {task.locationPin?.mapLink && (
                      <a href={task.locationPin.mapLink} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-teal-600 underline mt-1 block">Open in Maps</a>
                    )}
                  </div>
                )
              })()}

              <MultiFileUploadField label="Installation Sheet" accept=".pdf,.jpg,.png"
                files={instFiles} onChange={setInstFiles} helperText="Optional — upload installation plan" />

              <VoiceRecorder label="Special Note to Installation"
                savedIds={voiceNoteInstallationIds}
                onAdd={id => setVoiceNoteInstallationIds(prev => [...prev, id])}
                onRemove={id => setVoiceNoteInstallationIds(prev => prev.filter(x => x !== id))}
                helperText="Optional voice note for the installation team" />

              <div>
                <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={instNote} onChange={e => setInstNote(e.target.value)}
                  placeholder="Special instructions for installer…" className={`${inp} resize-none`} />
              </div>

              <button type="button" onClick={submitInstallationAssign}
                className="w-full py-4 rounded-2xl bg-rose-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <Wrench size={15} /> Assign Installation
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              11. INSTALLATION UPDATE — installation_incharge only
          ════════════════════════════════════════════════════════════════ */}

          {/* 11a. waiting view for non-incharge roles */}
          {stage === 'installation_update' && flowStatus !== 'mistake' && role !== 'technician' && role !== 'installation_incharge' && !demoOverride && (
            <WaitingView icon={Wrench} color="bg-rose-50 border border-rose-200 text-rose-700"
              title={`Installation ${flowStatus === 'not_completed' ? 'Not Completed' : 'In Progress'}`}
              sub={task.installationPerson ? `Installer: ${task.installationPerson}${task.installationDate ? ` · ${task.installationDate}` : ''}` : 'Waiting for installation incharge to update'} />
          )}

          {/* DEMO CONTROL for installation update */}
          {stage === 'installation_update' && flowStatus !== 'mistake' && role !== 'technician' && role !== 'installation_incharge' && !demoOverride && canDemoOverride && (
            <DemoControlCard
              waitingFor="Installation Incharge"
              description="Installation Incharge needs to report installation result. For demo, update it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}

          {stage === 'installation_update' && flowStatus !== 'mistake' && (role === 'technician' || role === 'installation_incharge' || demoOverride) && (
            <>{demoOverride && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Demo Override — Acting as Installation Incharge</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>
            )}</>
          )}

          {stage === 'installation_update' && flowStatus !== 'mistake' && (role === 'technician' || role === 'installation_incharge' || demoOverride) && (
            <>
              {task.installationPerson && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-rose-500 font-bold uppercase">Assigned Technician</p>
                  <p className="text-sm font-bold text-rose-700">{task.installationPerson}</p>
                  {task.installationDate && <p className="text-xs text-rose-400 mt-0.5">Date: {task.installationDate}</p>}
                  {hasCostDetails && (
                    <p className="text-xs text-rose-600 mt-1 font-semibold">
                      Total: ₹{totalCost.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Installation Result</p>

              <Opt value="completed"     label="Completed"     sub="Installation done successfully"         accent="border-emerald-200" sel={sel} onPick={pick} />
              <Opt value="not_completed" label="Not Completed" sub="Could not finish — rescheduling needed" accent="border-orange-200"  sel={sel} onPick={pick} />
              <Opt value="mistake"       label="Mistake"       sub="An issue occurred during installation"  accent="border-red-200"     sel={sel} onPick={pick} />

              {sel === 'not_completed' && (
                <NoteWithFilesField label="Reason" required
                  noteValue={instNotCompNote} onNoteChange={setInstNotCompNote}
                  files={instNotCompFiles} onFilesChange={setInstNotCompFiles}
                  placeholder="Why couldn't the installation be completed?" />
              )}

              {sel === 'mistake' && (
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>Mistake Details {req}</label>
                    <textarea rows={3} value={instMistakeNote} onChange={e => setInstMistakeNote(e.target.value)}
                      placeholder="Describe the installation mistake in detail…"
                      className={`${inp} resize-none`} />
                  </div>
                  <VoiceRecorder label="Voice Note (optional)"
                    savedIds={voiceNoteInstallationIds}
                    onAdd={id => setVoiceNoteInstallationIds(prev => [...prev, id])}
                    onRemove={id => setVoiceNoteInstallationIds(prev => prev.filter(x => x !== id))}
                    helperText="Record a voice note about the mistake" />
                </div>
              )}

              {sel && (
                <button type="button" onClick={submitInstallationUpdate}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${sel === 'completed' ? 'bg-emerald-600' : sel === 'mistake' ? 'bg-red-600' : 'bg-orange-500'}`}>
                  {sel === 'completed' ? '✓ Installation Completed — Collect Payment' : sel === 'mistake' ? 'Save Mistake' : 'Mark Not Completed'}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              11b. INSTALLATION MISTAKE REVIEW — LM
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'installation_update' && flowStatus === 'mistake' && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-2">
                <p className="text-xs font-bold text-red-600 uppercase">Installation Mistake Reported</p>
                {task.installationMistakeDetails && (
                  <p className="text-sm text-red-700">{task.installationMistakeDetails}</p>
                )}
                {task.installationPerson && (
                  <p className="text-xs text-red-400">Reported by installer: {task.installationPerson}</p>
                )}
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Review Action</p>

              <Opt value="send_back_prod_admin"    label="Send Back to Production Incharge"    sub="Material or profile issue — recheck availability"   accent="border-amber-200"  sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />
              <Opt value="send_back_prod_manager"  label="Send Back to Production Incharge"  sub="Rework required — send back to production"           accent="border-orange-200" sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />
              <Opt value="reassign_installation"   label="Reassign Installation"            sub="Send new installation team"                          accent="border-blue-200"   sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />
              <Opt value="mark_resolved"           label="Mark Resolved"                    sub="Issue is resolved — proceed to final payment"        accent="border-emerald-200" sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />

              {instMistakeReviewAction && (
                <button type="button" onClick={submitInstallationMistakeReview}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${instMistakeReviewAction === 'mark_resolved' ? 'bg-emerald-600' : instMistakeReviewAction === 'reassign_installation' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                  {instMistakeReviewAction === 'send_back_prod_admin' ? 'Send to Production Incharge' :
                   instMistakeReviewAction === 'send_back_prod_manager' ? 'Send to Production Incharge' :
                   instMistakeReviewAction === 'reassign_installation' ? 'Reassign Installation' :
                   '✓ Mark Resolved — Proceed to Payment'}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              12. FINAL PAYMENT — LM (balance collection only)
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'final_payment' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Final Collection</p>

              {(() => {
                const total   = task.quotationAmount ?? 0
                const paid    = task.paidAmount ?? 0
                const balance = Math.max(0, total - paid)
                return (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600">Total Project Value</span>
                        <span className="font-bold text-green-700">₹{total.toLocaleString('en-IN')}</span>
                      </div>
                      {paid > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-600">Already Paid</span>
                          <span className="font-bold text-emerald-700">₹{paid.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-t border-green-200 pt-1.5">
                        <span className="font-extrabold text-green-700">Balance Due</span>
                        <span className="font-extrabold text-green-800">₹{balance.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {balance <= 0 ? (
                      <button type="button" onClick={() => save({
                        flowStage: 'final_completion', flowStatus: 'full_paid', status: 'pending',
                        title: 'Complete Project', paidAmount: paid, balanceAmount: 0,
                      }, 'Full payment already received — completing project')}
                        className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                        <CheckCircle2 size={15} /> Complete Project
                      </button>
                    ) : (
                      <>
                        <div>
                          <label className={lbl}>Balance Amount Received (₹) {req}</label>
                          <input type="text" inputMode="numeric" value={finalPaidAmt}
                            onChange={e => setFinalPaidAmt(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder={String(balance)}
                            className={inp} />
                        </div>
                        <button type="button"
                          onClick={() => {
                            if (!finalPaidAmt) { setError('Enter the balance amount received.'); return }
                            const newPaid = Number(finalPaidAmt)
                            const totalPaid = paid + newPaid
                            save({
                              flowStage: 'final_completion', flowStatus: 'full_paid', status: 'pending',
                              title: 'Complete Project', paidAmount: totalPaid, balanceAmount: 0,
                            }, `Balance payment ₹${newPaid.toLocaleString('en-IN')} received — full payment collected`)
                          }}
                          disabled={!finalPaidAmt}
                          className="w-full py-4 rounded-2xl bg-green-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2 disabled:opacity-40">
                          <CreditCard size={15} /> Mark Balance Paid
                        </button>
                      </>
                    )}
                  </>
                )
              })()}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              12b. FINAL COMPLETION — after full paid
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'final_completion' && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-4 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                  <p className="text-sm font-bold text-green-700">Full Payment Received</p>
                </div>
                {task.paidAmount != null && (
                  <p className="text-2xl font-extrabold text-green-700 pl-7">₹{task.paidAmount.toLocaleString('en-IN')}</p>
                )}
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actual Project Expenses</p>

              {[
                { label: 'Material Cost (₹)',    val: actualMaterial,     set: setActualMaterial     },
                { label: 'Production Cost (₹)',  val: actualProduction,   set: setActualProduction   },
                { label: 'Installation Cost (₹)',val: actualInstallation, set: setActualInstallation },
                { label: 'Transport Cost (₹)',   val: actualTransport,    set: setActualTransport    },
                { label: 'Other Costs (₹)',      val: actualOther,        set: setActualOther        },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className={lbl}>{label} <span className="text-slate-300 font-normal">(optional)</span></label>
                  <input type="text" inputMode="numeric" value={val}
                    onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0" className={inp} />
                </div>
              ))}

              {(() => {
                const totalExpenses = [actualMaterial, actualProduction, actualInstallation, actualTransport, actualOther]
                  .reduce((s, v) => s + (Number(v) || 0), 0)
                const quotation = task.quotationAmount ?? task.costBreakdown?.quotationAmount ?? 0
                const profit = quotation - totalExpenses
                return (
                  <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Total Expenses</span>
                      <span className="font-bold text-slate-700">₹{totalExpenses.toLocaleString('en-IN')}</span>
                    </div>
                    {canSeeProfit && quotation > 0 && (
                      <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5">
                        <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>Profit</span>
                        <span className={`font-extrabold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          ₹{profit.toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}

              <button type="button"
                onClick={() => {
                  const totalExpenses = [actualMaterial, actualProduction, actualInstallation, actualTransport, actualOther]
                    .reduce((s, v) => s + (Number(v) || 0), 0)
                  if (task.projectId) {
                    updateProject(task.projectId, {
                      status: 'completed',
                      isCompleted: true,
                      completedAt: new Date().toISOString(),
                      actualCompletedDate: new Date().toISOString(),
                      workflowStatus: 'Finished',
                      paymentStatus: 'Full Paid',
                      progress: 100,
                      ...(totalExpenses > 0 ? {
                        actualCosts: {
                          quotationAmount: task.quotationAmount ?? task.costBreakdown?.quotationAmount ?? 0,
                          materialCost:    Number(actualMaterial)     || 0,
                          productionCost:  Number(actualProduction)   || 0,
                          installationCost:Number(actualInstallation) || 0,
                          transportCost:   Number(actualTransport)    || 0,
                          profit:          (task.quotationAmount ?? 0) - totalExpenses,
                        },
                      } : {}),
                    })
                  }
                  save({
                    flowStage: 'completed',
                    flowStatus: 'done',
                    status: 'completed',
                    title: 'Project Completed',
                  }, 'Project completed successfully')
                }}
                className="w-full py-4 rounded-2xl bg-slate-800 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Complete Project
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              13. COMPLETED
          ════════════════════════════════════════════════════════════════ */}
          {stage === 'completed' && (
            <div className="space-y-4">
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={52} className="text-emerald-500 mx-auto" />
                <h3 className="text-lg font-extrabold text-slate-800">Project Completed!</h3>
                <p className="text-sm text-slate-500">All stages done. Payment fully collected.</p>
                {task.quotationAmount && (
                  <p className="text-xl font-extrabold text-emerald-600">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                )}
              </div>
              {/* Google Review button */}
              {(() => {
                const clientName = task.clientName ?? 'Sir/Madam'
                const phone = (task.clientPhone ?? '6379859299').replace(/\D/g, '').replace(/^0/, '')
                const reviewLink = 'https://share.google/ZaHJQF6kz9Aja2qmg'
                const msg = `Hello ${clientName},\nThank you for choosing Fenster.\n\nWe would be happy if you could share your experience with us by leaving a Google review:\n${reviewLink}\n\nRegards,\nFenster Team`
                return (
                  <button type="button"
                    onClick={() => {
                      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                      save({}, 'Google review link sent to client.')
                    }}
                    className="w-full py-4 rounded-2xl bg-amber-500 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                    ⭐ Send Google Review Link
                  </button>
                )
              })()}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              NOTES & ACTIVITY HISTORY — always visible
          ════════════════════════════════════════════════════════════════ */}
          {hasHistory && (
            <div className="space-y-3 pt-3 mt-2 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <History size={13} className="text-slate-400" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Notes &amp; Activity</p>
              </div>

              <div className="space-y-3 divide-y divide-slate-100">

                {/* Quotation Cost Breakdown */}
                {task.costBreakdown && canSeeCosts && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-violet-500 uppercase mb-2">Quotation Cost Breakdown</p>
                    <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                      {task.costBreakdown.numberOfSqft && (
                        <div className="flex justify-between">
                          <p className="text-xs text-slate-600">Area</p>
                          <p className="text-xs font-semibold text-slate-800">{task.costBreakdown.numberOfSqft} sq.ft</p>
                        </div>
                      )}
                      {[
                        { label: 'Material',     val: task.costBreakdown.materialCost },
                        { label: 'Production',   val: task.costBreakdown.productionCost },
                        { label: 'Installation', val: task.costBreakdown.installationCost },
                        { label: 'Transport',    val: task.costBreakdown.transportCost },
                      ].map(({ label, val }) => val > 0 ? (
                        <div key={label} className="flex justify-between">
                          <p className="text-xs text-slate-600">{label}</p>
                          <p className="text-xs font-semibold text-slate-800">₹{val.toLocaleString('en-IN')}</p>
                        </div>
                      ) : null)}
                      {canSeeProfit && task.costBreakdown.profit != null && (() => {
                        const p = task.costBreakdown!.profit!
                        const pct = task.costBreakdown!.quotationAmount > 0 ? (p / task.costBreakdown!.quotationAmount * 100) : 0
                        return (
                          <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-0.5">
                            <p className="text-xs font-bold text-slate-800">Profit (MD/ED only)</p>
                            <p className={`text-xs font-bold ${p >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              ₹{p.toLocaleString('en-IN')} <span className="font-normal opacity-70">({pct.toFixed(1)}%)</span>
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* Cost Details */}
                {hasCostDetails && canSeeCosts && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Installation Cost Details</p>
                    <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                      {task.productCost ? (
                        <div className="flex justify-between">
                          <p className="text-xs text-slate-600">Product Cost</p>
                          <p className="text-xs font-semibold text-slate-800">₹{task.productCost.toLocaleString('en-IN')}</p>
                        </div>
                      ) : null}
                      {task.installationCost ? (
                        <div className="flex justify-between">
                          <p className="text-xs text-slate-600">Installation Cost</p>
                          <p className="text-xs font-semibold text-slate-800">₹{task.installationCost.toLocaleString('en-IN')}</p>
                        </div>
                      ) : null}
                      {task.materialCost ? (
                        <div className="flex justify-between">
                          <p className="text-xs text-slate-600">Material Cost</p>
                          <p className="text-xs font-semibold text-slate-800">₹{task.materialCost.toLocaleString('en-IN')}</p>
                        </div>
                      ) : null}
                      {task.transportCost ? (
                        <div className="flex justify-between">
                          <p className="text-xs text-slate-600">Transport Cost</p>
                          <p className="text-xs font-semibold text-slate-800">₹{task.transportCost.toLocaleString('en-IN')}</p>
                        </div>
                      ) : null}
                      <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-0.5">
                        <p className="text-xs font-bold text-slate-800">Total Cost</p>
                        <p className="text-xs font-bold text-slate-800">₹{totalCost.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Site Photos */}
                {task.sitePhotos?.length ? (
                  <div className="pt-3 first:pt-0">
                    <MediaPreviewList
                      files={task.sitePhotos}
                      title={`Site Photos (${task.sitePhotos.length})`}
                    />
                  </div>
                ) : null}

                {/* Voice Notes */}
                {(!!task.specialNoteProduction?.length || !!task.specialNoteInstallation?.length) && (
                  <div className="pt-3 first:pt-0">
                    <MediaPreviewList
                      files={[...(task.specialNoteProduction ?? []), ...(task.specialNoteInstallation ?? [])]}
                      title="Voice Notes"
                      voiceStore={voicePreviewStore}
                    />
                  </div>
                )}

                {/* Measurements */}
                {task.measurementDetails && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-violet-500 uppercase mb-1">Measurements</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{task.measurementDetails}</p>
                  </div>
                )}

                {/* Location */}
                {getSiteMapUrl(task) && (
                  <div className="pt-3 first:pt-0 space-y-2">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Site Location</p>
                    {(() => {
                      const readable = getReadableLocation(task)
                      const mapUrl   = getSiteMapUrl(task)
                      return (
                        <>
                          {readable
                            ? <p className="text-sm font-semibold text-slate-700">{readable}</p>
                            : <p className="text-sm text-slate-500 italic">Site location pinned</p>
                          }
                          <MapButton url={mapUrl}
                            className="flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold active:bg-green-700 w-full min-h-[44px]" />
                        </>
                      )
                    })()}
                  </div>
                )}

                {/* Reschedule info */}
                {(task.rescheduleReason || task.requestedVisitDate) && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">Reschedule Request</p>
                    {task.requestedVisitDate && (
                      <p className="text-xs text-slate-700">Requested: {task.requestedVisitDate}{task.requestedVisitTime ? ` at ${task.requestedVisitTime}` : ''}</p>
                    )}
                    {task.rescheduleReason && <p className="text-xs text-slate-600">Reason: {task.rescheduleReason}</p>}
                    {task.rescheduleApprovalStatus && (
                      <p className={`text-xs font-semibold mt-0.5 ${task.rescheduleApprovalStatus === 'approved' ? 'text-emerald-600' : task.rescheduleApprovalStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
                        Status: {task.rescheduleApprovalStatus.charAt(0).toUpperCase() + task.rescheduleApprovalStatus.slice(1)}
                        {task.rescheduleApprovedBy ? ` by ${task.rescheduleApprovedBy}` : ''}
                      </p>
                    )}
                    {task.rescheduleApprovalNote && (
                      <p className="text-xs text-slate-500 mt-0.5">LM Note: {task.rescheduleApprovalNote}</p>
                    )}
                  </div>
                )}

                {/* Quotation */}
                {task.quotationAmount != null && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-violet-500 uppercase mb-1">Quotation</p>
                    <p className="text-xs font-bold text-slate-800">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                    {task.quotationNotes && <p className="text-xs text-slate-500 mt-0.5">{task.quotationNotes}</p>}
                    {task.quotationFile && (
                      <div className="mt-1.5">
                        <MediaPreviewList files={[task.quotationFile]} />
                      </div>
                    )}
                  </div>
                )}

                {/* Job Sheet */}
                {(task.jobSheet || task.jobSheetDetails) && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-orange-500 uppercase mb-1">Job Sheet</p>
                    {task.jobSheet && <MediaPreviewList files={[task.jobSheet]} />}
                    {task.jobSheetDetails && <p className="text-xs text-slate-700 whitespace-pre-wrap mt-1">{task.jobSheetDetails}</p>}
                  </div>
                )}

                {/* Glass Sheet */}
                {task.glassSheet && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-cyan-500 uppercase mb-1">Glass Sheet</p>
                    <MediaPreviewList files={[task.glassSheet]} />
                  </div>
                )}

                {/* Cutting Sheet */}
                {task.cuttingSheet && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Cutting Sheet</p>
                    <MediaPreviewList files={[task.cuttingSheet]} />
                  </div>
                )}

                {/* Payment */}
                {task.paidAmount != null && task.paidAmount > 0 && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Payment</p>
                    <p className="text-xs font-bold text-slate-800">Paid: ₹{task.paidAmount.toLocaleString('en-IN')}</p>
                    {task.balanceAmount != null && <p className="text-xs text-slate-500">Balance: ₹{task.balanceAmount.toLocaleString('en-IN')}</p>}
                    {task.paymentNote && <p className="text-xs text-slate-400 mt-0.5">{task.paymentNote}</p>}
                  </div>
                )}

                {/* Production Overdue */}
                {task.productionOverdueReason && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Production Overdue</p>
                    <p className="text-xs text-slate-700">{task.productionOverdueReason}</p>
                    {task.productionNewDate && <p className="text-xs text-slate-500 mt-0.5">New date: {task.productionNewDate}</p>}
                  </div>
                )}

                {/* Installation */}
                {task.installationPerson && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Installation</p>
                    <p className="text-xs font-bold text-slate-800">{task.installationPerson}</p>
                    {task.installationDate && <p className="text-xs text-slate-500">Date: {task.installationDate}</p>}
                    {task.installationNote && <p className="text-xs text-slate-500 mt-0.5">{task.installationNote}</p>}
                    {hasCostDetails && (
                      <p className="text-xs text-slate-600 font-semibold mt-0.5">
                        Total Cost: ₹{totalCost.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                )}

                {/* Mistake */}
                {task.installationMistakeDetails && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Mistake / Issue</p>
                    <p className="text-xs text-slate-700">{task.installationMistakeDetails}</p>
                  </div>
                )}

                {/* Status history timeline */}
                {(task.statusHistory?.length ?? 0) > 0 && (
                  <div className="pt-3 first:pt-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Status Timeline</p>
                    <div className="space-y-2.5">
                      {[...task.statusHistory!].reverse().map((entry, i) => (
                        <div key={i} className="flex gap-2.5">
                          <div className="flex flex-col items-center pt-1">
                            <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            {i < task.statusHistory!.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[12px]" />}
                          </div>
                          <div className="pb-1 flex-1">
                            <p className="text-[11px] font-bold text-slate-700">{STAGE_LABEL[entry.stage] ?? entry.stage} — {entry.status}</p>
                            {entry.note && <p className="text-[11px] text-slate-500 mt-0.5">{entry.note}</p>}
                            {entry.files && entry.files.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {entry.files.slice(0, 3).map((f, fi) => (
                                  <p key={fi} className="text-[10px] text-slate-400">📎 {f}</p>
                                ))}
                                {entry.files.length > 3 && (
                                  <p className="text-[10px] text-slate-400">+{entry.files.length - 3} more files</p>
                                )}
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">{entry.updatedBy} · {entry.updatedAt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Global fullscreen image preview overlay ────────────────────────── */}
      {fullPreviewSrc && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setFullPreviewSrc(null)}>
          <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <p className="text-white text-xs font-semibold text-center mb-2 opacity-70 truncate">{fullPreviewName}</p>
            <img src={fullPreviewSrc} alt={fullPreviewName}
              className="w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl" />
            <button type="button" onClick={() => setFullPreviewSrc(null)}
              className="absolute top-8 right-2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-sm active:bg-white">
              <X size={18} className="text-slate-800" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inline icons ─────────────────────────────────────────────────────────────
function MapPinIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function CalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
