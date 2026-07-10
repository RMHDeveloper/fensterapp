import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, CheckCircle2, AlertTriangle, Camera, Clock, Send, PhoneCall,
  Package, Wrench, CreditCard, Eye, Download, FileText, Copy, Check, FolderOpen, MapPin,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { MultiFileUploadField } from '../../components/forms/MultiFileUploadField'
import { VoiceRecorder } from '../../components/forms/VoiceRecorder'
import { LocationPinField } from '../../components/forms/LocationPinField'
import { TimePickerField } from '../../components/forms/TimePickerField'
import { NoteWithFilesField } from '../../components/forms/NoteWithFilesField'
import type { Task, Project, LocationPin, StatusHistoryItem, FlowStage, CostBreakdown, ProjectStage, AvailabilityCheckItem } from '../../types'
import { PROJECT_STAGE_LABEL, PROJECT_STAGE_PROGRESS } from '../../types'
import { filePreviewStore, voicePreviewStore, isImageFileName, resolveFileUrl } from '../../utils/sessionStore'
import { MediaPreviewList } from '../../components/media/MediaPreviewList'
import { getActiveManagedUsersByDisplayRole, loadManagedUsers } from '../../utils/userStorage'
import { Dialog } from '../../components/feedback/Dialog'
import { recordUploadedFile, getQuotationVersions, subscribeToProjectFiles, type FileRow } from '../../services/fileService'
import { getFileUrl, getDisplayFileName } from '../../utils/fileStorage'
import { getAppSettings } from '../../utils/appSettings'

function recordQuotationVersion(task: Task, fileName: string, uploadedBy: string, uploadedByRole: string) {
  const url = fileName.startsWith('http') ? fileName : (getFileUrl(fileName) ?? fileName)
  const displayName = getDisplayFileName(fileName)
  recordUploadedFile({
    projectId: task.projectId,
    taskId: task.id,
    category: 'quotation',
    fileName: displayName,
    url,
    uploadedBy,
    uploadedByRole,
  }).catch(err => console.error('[Fenster] quotation version record failed:', err))
}

function isSameQuotationFile(a?: string, b?: string) {
  // Treat empty as different
  if (!a || !b) return false
  const resolve = (s: string) => {
    if (s.startsWith('http')) return s.trim()
    const url = getFileUrl(s)
    return (url ?? s).trim()
  }
  try {
    const ra = resolve(a)
    const rb = resolve(b)
    if (ra === rb) return true
    // Fallback: compare filename (basename) after decoding
    const base = (u: string) => decodeURIComponent((u.split('/').pop() ?? '').split('?')[0])
    return base(ra) !== '' && base(ra) === base(rb)
  } catch {
    return a.trim() === b.trim()
  }
}

// Display-only rename: the production_admin role's visible label is now "Admin" —
// internal role/displayRole matching is untouched, this only affects rendered text.
const PRODUCTION_ADMIN_LABEL = 'Admin'

// Map from task flowStage → project currentStage (for timeline / filter updates)
const FLOW_TO_PROJECT_STAGE: Partial<Record<string, ProjectStage>> = {
  site_visit:          'site_visit_assigned',
  reschedule_review:   'site_visit_assigned',
  site_review:         'quotation_preparation',
  owner_approval:      'quotation_sent_owner',
  send_to_client:      'owner_approved',
  advance_payment:     'advance_payment',
  production_assign:   'advance_payment',
  production_check:    'production_admin_check',
  production_work:          'production_manager_work',
  dispatch_assign:          'ready_to_dispatch',
  admin_availability_check: 'ready_to_dispatch',
  site_lead_approval:       'ready_to_dispatch',
  installation_assign: 'ready_to_dispatch',
  installation_update: 'installation',
  final_payment:       'final_payment',
  final_completion:    'final_payment',
  completed:           'completed',
}

function fmtVersionDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Full quotation version history, newest first — replaces the old single "latest + previous" pair. */
function QuotationVersionsPanel({ task }: { task: Task }) {
  const [versions, setVersions] = useState<FileRow[]>([])

  useEffect(() => {
    let cancelled = false
    getQuotationVersions(task.projectId, task.id).then(rows => { if (!cancelled) setVersions(rows) })
    const unsubscribe = subscribeToProjectFiles(task.projectId, () => {
      getQuotationVersions(task.projectId, task.id).then(rows => { if (!cancelled) setVersions(rows) })
    })
    return () => { cancelled = true; unsubscribe() }
  }, [task.projectId, task.id, task.quotationFile])

  // Fall back to the legacy single-file fields if no versions have been recorded in fenster_files yet
  if (versions.length === 0) {
    return (
      <>
        {task.quotationFile && (() => {
          const qFileUrl = resolveFileUrl(task.quotationFile!)
          return (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-indigo-500 uppercase mb-2">Latest Quotation File</p>
              <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-3 py-2.5">
                <FileText size={16} className="text-indigo-400 flex-shrink-0" />
                <p className="text-xs text-slate-700 flex-1 truncate">{getDisplayFileName(task.quotationFile!)}</p>
                {qFileUrl && (
                  <>
                    <a href={qFileUrl} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 active:bg-blue-100">
                      <Eye size={12} className="text-blue-500" />
                    </a>
                    <a href={qFileUrl} download={task.quotationFile} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 active:bg-emerald-100">
                      <Download size={12} className="text-emerald-600" />
                    </a>
                  </>
                )}
              </div>
            </div>
          )
        })()}
        {task.previousQuotationFile && (() => {
          const prevUrl = resolveFileUrl(task.previousQuotationFile!)
          return (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-red-500 uppercase mb-2">Previously Rejected Quotation</p>
              <div className="flex items-center gap-2 bg-white border border-red-100 rounded-xl px-3 py-2.5">
                <FileText size={13} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-700 flex-1 truncate">{getDisplayFileName(task.previousQuotationFile!)}</p>
                {prevUrl && (
                  <>
                    <a href={prevUrl} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0 active:bg-red-100">
                      <Eye size={11} className="text-red-500" />
                    </a>
                    <a href={prevUrl} download={task.previousQuotationFile} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 active:bg-emerald-100">
                      <Download size={11} className="text-emerald-600" />
                    </a>
                  </>
                )}
              </div>
              {task.ownerRejectionReason && (
                <p className="text-[10px] text-red-400 mt-2 italic">Rejection reason: {task.ownerRejectionReason}</p>
              )}
            </div>
          )
        })()}
      </>
    )
  }

  return (
    <div className="space-y-2">
      {versions.map((v, i) => {
        const isLatest = i === 0
        return (
          <div key={v.id} className={`border rounded-xl px-4 py-3 ${isLatest ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isLatest ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                V{v.versionNumber ?? 1}
              </span>
              <p className={`text-[10px] font-bold uppercase ${isLatest ? 'text-indigo-500' : 'text-slate-400'}`}>
                {isLatest ? 'Latest Quotation File' : 'Earlier Version'}
              </p>
              {isLatest && (
                <span className="text-[8px] bg-emerald-50 text-emerald-600 font-semibold px-1.5 py-0.5 rounded-full ml-auto">New</span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2.5">
              <FileText size={16} className={isLatest ? 'text-indigo-400 flex-shrink-0' : 'text-slate-400 flex-shrink-0'} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-700 truncate">{v.fileName}</p>
                <p className="text-[9px] text-slate-400">{v.uploadedBy ?? '—'} · {fmtVersionDateTime(v.uploadedAt)}</p>
              </div>
              <a href={v.url} target="_blank" rel="noopener noreferrer"
                className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 active:bg-blue-100">
                <Eye size={12} className="text-blue-500" />
              </a>
              <a href={v.url} download={v.fileName} target="_blank" rel="noopener noreferrer"
                className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 active:bg-emerald-100">
                <Download size={12} className="text-emerald-600" />
              </a>
            </div>
          </div>
        )
      })}
      {task.ownerRejectionReason && task.flowStatus !== 'client_approved' && (
        <p className="text-[10px] text-red-400 italic px-1">Latest rejection reason: {task.ownerRejectionReason}</p>
      )}
    </div>
  )
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

// ─── Override Control card (LO) / Take Control button (Owner) ────────────────

interface DemoControlCardProps {
  waitingFor: string
  description: string
  onOverride: () => void
  variant?: 'override' | 'owner'
}
function DemoControlCard({ waitingFor, description, onOverride, variant = 'override' }: DemoControlCardProps) {
  if (variant === 'owner') {
    return (
      <button type="button" onClick={onOverride}
        className="w-full py-3 rounded-xl bg-slate-800 text-white text-sm font-bold active:opacity-90 flex items-center justify-center gap-2">
        Take Control →
      </button>
    )
  }
  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-amber-200 rounded-md flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={11} className="text-amber-700" />
        </div>
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Override Control</p>
      </div>
      <p className="text-xs text-amber-700">
        <span className="font-semibold">{waitingFor}</span> needs to update this step.
      </p>
      <p className="text-[11px] text-amber-600">{description}</p>
      <button type="button" onClick={onOverride}
        className="w-full py-3 rounded-xl bg-amber-600 text-white text-sm font-bold active:opacity-90">
        Override This Step →
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
  production_work:          'bg-blue-600',
  dispatch_assign:          'bg-orange-500',
  admin_availability_check: 'bg-amber-500',
  site_lead_approval:       'bg-fuchsia-600',
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
  production_work:          'Production Work',
  dispatch_assign:          'Assign to Dispatch',
  admin_availability_check: 'Check Installation Availability',
  site_lead_approval:       'Approve Installation Availability',
  installation_assign: 'Installation Setup',
  installation_update: 'Installation',
  final_payment:       'Final Payment',
  final_completion:    'Complete Project',
  completed:           'Completed',
}

const FLOW_STAGES_ORDERED: string[] = [
  'site_assign','site_visit','reschedule_review','site_review','owner_approval',
  'send_to_client','production_assign','production_check','advance_payment',
  'production_work','dispatch_assign','admin_availability_check','site_lead_approval',
  'installation_update','final_payment',
  'final_completion','completed',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400'
const lbl = 'text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block'
const req = <span className="text-red-500"> *</span>

const DEFAULT_INSTALLERS    = ['Ravi Kumar', 'Mani K', 'Senthil R', 'Arjun S', 'Balamurugan R']

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

// Returns the Google Maps URL only if an actual link was provided (no fallback search URLs)
function getGoogleMapsUrl(task: Task, project?: Project): string {
  if (task.locationPin?.mapLink?.trim()) return task.locationPin.mapLink.trim()
  if (task.location && isMapUrl(task.location)) return task.location.trim()
  const projLoc = project?.location?.trim() ?? ''
  if (projLoc && isMapUrl(projLoc)) return projLoc
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
function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

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
        {phone ? (
          <a href={`https://wa.me/${formatWhatsAppNumber(phone)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-[#25D366] text-white rounded-xl py-3 text-sm font-bold min-h-[44px] active:opacity-90 transition-colors">
            💬 WhatsApp
          </a>
        ) : (
          <div className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 rounded-xl py-3 text-sm font-semibold min-h-[44px]">
            💬 No Phone
          </div>
        )}
      </div>
    </div>
  )
}

type AvailStatus = 'available' | 'not_available' | 'order'
type AvailItem = { id: string; label: string; status: AvailStatus; reason: string; dueDate?: string }
const DEFAULT_AVAIL: AvailItem[] = [
  { id: 'profile',  label: 'Profile',  status: 'available', reason: '', dueDate: '' },
  { id: 'glass',    label: 'Glass',    status: 'available', reason: '', dueDate: '' },
  { id: 'hardware', label: 'Hardware', status: 'available', reason: '', dueDate: '' },
]

// ─────────────────────────────────────────────────────────────────────────────

export function DemoFlowSheet({ isOpen, onClose, task, onUpdate }: Props) {
  const { user, can }                        = useAuth()
  const { updateTask: ctxUpdateTask, updateProject, tasks, projects, leads, updateLeadStatus } = useAppData()
  const navigate                             = useNavigate()
  const role                                 = user?.role ?? 'lead_manager'
  const todayStr                             = new Date().toISOString().slice(0, 10)
  const project                              = projects.find(p => p.id === task.projectId)
  const leadOwnerName                        = project?.leadId ? leads.find(l => l.id === project.leadId)?.assignee ?? project.ownerName : project?.ownerName
  const [{ productionRate, installationRate }] = useState(getAppSettings)

  // Site engineer dropdown shows only real managed users — no seed/demo names
  const engineerOptions = getActiveManagedUsersByDisplayRole('Site Engineer')
  const installerOptions = [
    ...DEFAULT_INSTALLERS,
    ...getActiveManagedUsersByDisplayRole('Installation Incharge').filter(n => !DEFAULT_INSTALLERS.includes(n)),
    ...getActiveManagedUsersByDisplayRole('Installation Technician').filter(n => !DEFAULT_INSTALLERS.includes(n)),
  ]
  // Matched by internal role, not the stored displayRole string, which has been
  // ambiguously reused for both production_admin and production_manager
  // elsewhere in the app, so role is the only reliable filter.
  const productionAdminOptions = loadManagedUsers()
    .filter(u => u.role === 'production_admin' && u.status === 'active').map(u => u.fullName)
  const productionManagerOptions = loadManagedUsers()
    .filter(u => u.role === 'production_manager' && u.status === 'active').map(u => u.fullName)

  const [sel,   setSel]   = useState('')
  const [error, setError] = useState('')
  const [jobSheetAssignee, setJobSheetAssignee] = useState('')
  const [pmAssignee, setPmAssignee] = useState('')
  const [showLossWarn, setShowLossWarn] = useState(false)
  const lossConfirmCb = useRef<(() => void) | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function copyToClipboard(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2000)
    })
  }

  // ── SITE ASSIGN ─────────────────────────────────────────────────────────────
  const [engineerName,   setEngineerName]   = useState('Kavya M')
  const [visitDate,      setVisitDate]      = useState('')
  const [visitTime,      setVisitTime]      = useState('')
  const [assignNote,     setAssignNote]     = useState('')
  const [assignLocation, setAssignLocation] = useState('')
  const [assignMapLink,  setAssignMapLink]  = useState('')

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
  const [lmReschedNote,    setLmReschedNote]    = useState('')
  const [lmNewVisitDate,   setLmNewVisitDate]   = useState('')
  const [lmNewVisitTime,   setLmNewVisitTime]   = useState('')

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
  const [restockDate, setRestockDate] = useState('')

  // ── ADVANCE PAYMENT ───────────────────────────────────────────────────────
  const [advPaidAmt,       setAdvPaidAmt]       = useState('')
  const [advBalAmt,        setAdvBalAmt]        = useState('')
  const [advDueDate,       setAdvDueDate]       = useState('')
  const [advNote,          setAdvNote]          = useState('')
  const [advPayScreenshot, setAdvPayScreenshot] = useState<string[]>([])
  const [finalPayScreenshot, setFinalPayScreenshot] = useState<string[]>([])
  // Advance received -> Convert to Project, chained into the same step so LM
  // doesn't have to go find this project again on the Leads screen afterward.
  const [showAdvanceConvert, setShowAdvanceConvert] = useState(false)
  const [convProjectName,   setConvProjectName]   = useState('')
  const [convDueDate,       setConvDueDate]       = useState('')
  const [convNotes,         setConvNotes]         = useState('')

  // ── PRODUCTION WORK ───────────────────────────────────────────────────────
  const [overdueNote,    setOverdueNote]    = useState('')
  const [overdueFiles,   setOverdueFiles]   = useState<string[]>([])
  const [overdueNewDate, setOverdueNewDate] = useState('')
  const [lmNewDate,      setLmNewDate]      = useState('')
  const [lmNote,         setLmNote]         = useState('')

  // ── DISPATCH → INSTALLATION AVAILABILITY APPROVAL CHAIN ───────────────────
  const [proposedInstPerson, setProposedInstPerson] = useState('')
  const [proposedInstDate,   setProposedInstDate]   = useState('')
  const [adminAvailNotes,    setAdminAvailNotes]    = useState('')
  const [siteLeadAction,     setSiteLeadAction]     = useState<'assign' | 'change' | ''>('')
  const [changedInstPerson,  setChangedInstPerson]  = useState('')
  const [changedInstDate,    setChangedInstDate]    = useState('')
  const [changedInstNotes,   setChangedInstNotes]   = useState('')

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
  const [instNextVisitDate,     setInstNextVisitDate]     = useState('')
  const [instNotCompExtraNotes, setInstNotCompExtraNotes] = useState('')
  const [instMistakeNote,       setInstMistakeNote]       = useState('')
  const [instMistakePhotos,     setInstMistakePhotos]     = useState<string[]>([])
  const [instMistakeReviewAction, setInstMistakeReviewAction] = useState('')
  const [instCompletedPhotos,   setInstCompletedPhotos]   = useState<string[]>([])

  // ── PRODUCTION ASSIGN extra sheets ────────────────────────────────────────
  const [extraSheets, setExtraSheets] = useState<string[][]>([])

  // ── OWNER STAGE NAVIGATION ─────────────────────────────────────────────────
  const [ownerNavStage, setOwnerNavStage] = useState<string | null>(null)

  // ── OWNER STAGE HISTORY BROWSING — Previous/Next stage buttons ────────────
  // null = viewing the live, actionable current stage. A number indexes into
  // task.statusHistory to show a summary of an earlier stage. Browsing alone
  // doesn't change anything — MD has to explicitly confirm "Roll Back to
  // This Stage" (below) before the project's real current stage moves.
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false)

  // ── FINAL PAYMENT ─────────────────────────────────────────────────────────
  const [finalPaidAmt,   setFinalPaidAmt]   = useState('')
  const [finalBalAmt,    setFinalBalAmt]    = useState('')
  const [extraChargeAmt, setExtraChargeAmt] = useState('')
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
  const [costWindows,  setCostWindows]  = useState('')
  const [costDoors,    setCostDoors]    = useState('')

  // ── PHASE 8: Admin availability checklist ──────────────────────
  const [availChecklist, setAvailChecklist] = useState<AvailItem[]>(DEFAULT_AVAIL)

  // ── PHASE 9: Production Manager 6-step checklist ──────────────────────────
  const [prodChecklist, setProdChecklist] = useState([
    { id: 'cutting',    label: 'Profile Cutting', done: false },
    { id: 'routing',    label: 'Routing',         done: false },
    { id: 'steel',      label: 'Steel',           done: false },
    { id: 'welding',    label: 'Welding',         done: false },
    { id: 'assembling', label: 'Assembling',      done: false },
    { id: 'glazing',    label: 'Glazing',         done: false },
  ])

  // ── Production Manager: editable material status (from Admin) ─────────────
  const [pmMaterialChecklist, setPmMaterialChecklist] = useState<AvailabilityCheckItem[]>([])

  // ── Ready to Pack checklist ────────────────────────────────────────────────
  const DEFAULT_PACK_CHECKLIST = [
    { id: 'profiles',  label: 'All profile pieces cut and ready', done: false },
    { id: 'glass',     label: 'Glass pieces confirmed and packed', done: false },
    { id: 'hardware',  label: 'Hardware (locks, handles) packed',  done: false },
    { id: 'rubber',    label: 'Rubber seals included',             done: false },
    { id: 'jobsheet',  label: 'Job sheet/delivery note included',  done: false },
    { id: 'labels',    label: 'Items labelled correctly',          done: false },
  ]
  const [packChecklist, setPackChecklist] = useState(DEFAULT_PACK_CHECKLIST.map(d => ({ ...d })))

  // ── Reset on open / task change ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setSel(''); setError(''); setLmReschedNote(''); setLmNewVisitDate(task.visitDate ?? todayStr); setLmNewVisitTime(task.visitTime ?? ''); setDemoOverride(false); setShowEditCost(false)
    setEngineerName(task.siteEngineerName ?? 'Kavya M')
    setVisitDate(task.visitDate ?? todayStr); setVisitTime(task.visitTime ?? '')
    setAssignNote(''); setAssignLocation(task.location ?? '')
    setAssignMapLink(task.locationPin?.mapLink ?? '')
    setReschedDate(todayStr); setReschedTime(''); setReschedReason('')
    setSitePhotos(task.sitePhotos ?? [])
    setMeasFiles(task.measurementFiles ?? [])
    setMeasDetails(task.measurementDetails ?? '')
    setLocPin(task.locationPin ?? { latitude: '', longitude: '', mapLink: '' })
    setSeNote('')
    setQuotAmt(task.quotationAmount ? String(task.quotationAmount) : '')
    // Don't pre-load the old file in revision mode — force a fresh upload so quotFiles[0] is always the new file
    const isRevision = (task.flowStage === 'owner_approval' && task.flowStatus === 'rejected')
                    || task.flowStatus === 'client_rejected'
    setQuotFiles((!isRevision && task.quotationFile) ? [task.quotationFile] : [])
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
    // Default Project Incharge to Santhanam when available; keep the task's existing
    // assignee if it was already set (e.g. re-opening an in-progress job sheet)
    setJobSheetAssignee(
      task.assignee && productionAdminOptions.includes(task.assignee) ? task.assignee
        : productionAdminOptions.includes('Santhanam') ? 'Santhanam'
        : ''
    )
    setNotAvailNote(''); setNotAvailFiles([]); setNotAvailLmAction(''); setRestockDate('')
    setAdvPaidAmt(task.paidAmount ? String(task.paidAmount) : '')
    setAdvPayScreenshot(task.advancePaymentScreenshot ?? [])
    setAdvBalAmt(task.balanceAmount ? String(task.balanceAmount) : '')
    setAdvNote('')
    setShowAdvanceConvert(false)
    setConvProjectName(task.projectName ?? '')
    setConvDueDate('')
    setConvNotes('')
    setOverdueNote(task.productionOverdueReason ?? '')
    setOverdueFiles([]); setOverdueNewDate(task.productionNewDate ?? todayStr)
    setLmNewDate(todayStr); setLmNote('')
    setProposedInstPerson(task.proposedInstallationPerson ?? '')
    setProposedInstDate(task.proposedInstallationDate ?? todayStr)
    setAdminAvailNotes('')
    setSiteLeadAction(''); setChangedInstPerson(''); setChangedInstDate(todayStr); setChangedInstNotes('')
    setInstPerson(task.installationPerson ?? '')
    setInstDate(task.installationDate ?? todayStr)
    setInstFiles([]); setInstNote(task.installationNote ?? '')
    setProductCost(task.productCost ? String(task.productCost) : '')
    setInstCost(task.installationCost ? String(task.installationCost) : '')
    setMatCost(task.materialCost ? String(task.materialCost) : '')
    setTransCost(task.transportCost ? String(task.transportCost) : '')
    setInstNotCompNote(''); setInstNotCompFiles([]); setInstNextVisitDate(todayStr); setInstNotCompExtraNotes('')
    setInstMistakeNote(''); setInstMistakePhotos([])
    setInstCompletedPhotos([])
    setExtraSheets([])
    setOwnerNavStage(null)
    setHistoryIndex(null)
    setFinalPaidAmt(task.paidAmount ? String(task.paidAmount) : '')
    setFinalBalAmt(task.balanceAmount ? String(task.balanceAmount) : '')
    setFinalPayScreenshot([])
    setExtraChargeAmt('')
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
    setCostWindows(task.costBreakdown?.numberOfWindows ? String(task.costBreakdown.numberOfWindows) : '')
    setCostDoors(task.costBreakdown?.numberOfDoors ? String(task.costBreakdown.numberOfDoors) : '')
    // Phase 8 — restore from task state if available, else use defaults
    setAvailChecklist(
      task.availabilityChecklist?.length
        ? task.availabilityChecklist.map(i => ({
            id: i.id, label: i.label,
            status: (i.ordered ? 'order' : i.available ? 'available' : 'not_available') as AvailStatus,
            reason: i.notAvailableReason ?? '',
            dueDate: i.dueDate ?? '',
          }))
        : DEFAULT_AVAIL.map(d => ({ ...d }))
    )
    setPmMaterialChecklist(task.availabilityChecklist?.length ? task.availabilityChecklist.map(i => ({ ...i })) : [])
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
    // Pack checklist — restore from task if saved
    setPackChecklist(
      (task as Task & { packChecklist?: { id: string; label: string; done: boolean }[] }).packChecklist?.length
        ? (task as Task & { packChecklist?: { id: string; label: string; done: boolean }[] }).packChecklist!
        : DEFAULT_PACK_CHECKLIST.map(d => ({ ...d }))
    )
  }, [isOpen, task.id, task.flowStatus, task.flowStage, task.quotationFile]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  const stage        = task.flowStage ?? 'site_assign'
  const stageHistory = task.statusHistory ?? []
  // Owner-only: browsing an earlier stage swaps the whole actionable stage
  // tree for a read-only summary card — '__history__' matches none of the
  // `displayStage === <FlowStage>` blocks below, so they all naturally
  // render nothing while history is open.
  const viewingHistory = role === 'owner' && historyIndex !== null && historyIndex >= 0 && historyIndex < stageHistory.length
  const displayStage = viewingHistory ? '__history__' : ((role === 'owner' && ownerNavStage) ? ownerNavStage : stage)
  const flowStatus   = task.flowStatus ?? 'ready'

  // Previous/Next STAGE — steps through this task's own statusHistory
  // (read-only), landing back on the live actionable stage at the end.
  const stageNavTotal   = stageHistory.length + 1
  const stageNavCurrent = viewingHistory ? historyIndex! + 1 : stageNavTotal
  const stageNavHasPrev = viewingHistory ? historyIndex! > 0 : stageHistory.length > 0
  const stageNavHasNext = viewingHistory

  function goPrevStage() {
    if (viewingHistory) {
      if (historyIndex! > 0) setHistoryIndex(historyIndex! - 1)
    } else if (stageHistory.length > 0) {
      setHistoryIndex(stageHistory.length - 1)
    }
  }
  function goNextStage() {
    if (!viewingHistory) return
    if (historyIndex! + 1 >= stageHistory.length) setHistoryIndex(null)
    else setHistoryIndex(historyIndex! + 1)
  }

  // Actually moves the project back to a previous stage — drops every
  // statusHistory entry after it and makes that stage live/editable again
  // (the real per-stage action forms take over once flowStage matches it).
  // Destructive: undoes whatever progress happened after this point, so it
  // only runs after the MD explicitly confirms via the dialog below.
  function rollbackToStage() {
    if (historyIndex === null) return
    const entry = stageHistory[historyIndex]
    if (!entry) return
    const now = new Date().toISOString()
    const truncated = stageHistory.slice(0, historyIndex + 1)
    const marker: StatusHistoryItem = {
      stage: entry.stage,
      status: entry.status,
      note: `Rolled back to this stage by ${user?.name ?? 'MD'}`,
      updatedBy: user?.name ?? 'MD',
      updatedRole: role,
      updatedAt: now,
    }
    onUpdate({
      flowStage: entry.stage,
      flowStatus: entry.status,
      statusHistory: [...truncated, marker],
    })
    if (task.projectId) {
      const newProjectStage = FLOW_TO_PROJECT_STAGE[entry.stage]
      if (newProjectStage) {
        updateProject(task.projectId, {
          currentStage: newProjectStage,
          stage: PROJECT_STAGE_LABEL[newProjectStage] ?? newProjectStage,
          progress: PROJECT_STAGE_PROGRESS[newProjectStage] ?? undefined,
          updatedAt: now,
        } as Partial<Project>)
      }
    }
    setHistoryIndex(null)
    setShowRollbackConfirm(false)
    onClose()
  }

  function pick(v: string) { setSel(v); setError('') }

  function save(updates: Partial<Task>, histNote?: string, histFiles?: string[]) {
    setError('')
    const now = new Date().toISOString()
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

    try { console.debug('[Fenster] save -> onUpdate', { updates, newEntries, taskId: task.id }) } catch {}
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
        if (stage === 'send_to_client' && updates.flowStatus === 'waiting_response') newProjectStage = 'sent_to_client'
        if (stage === 'send_to_client' && updates.flowStatus === 'client_approved') newProjectStage = 'client_approved'
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
      if (updates.costBreakdown) {
        updateProject(task.projectId, { costBreakdown: updates.costBreakdown } as Partial<import('../../types').Project>)
      }
    }

    onClose()
  }

  const STAGES_POST_CLIENT: string[] = ['advance_payment','production_assign','production_check','production_work','installation_assign','installation_update','final_payment','final_completion','completed']
  // MD/ED, Admin, and LO can see cost breakdown; profit only for MD/ED — not Admin, not LO, not anyone else
  const canSeeCosts  = role === 'owner' || role === 'lead_manager' || role === 'production_admin'
  const canEditCosts = role === 'owner'
  const canSeeProfit = role === 'owner' && (user?.displayRole?.includes('MD') || user?.displayRole?.includes('ED'))

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
              {isSiteStage && mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-slate-400 underline underline-offset-2">
                  📍 View in Google Maps
                </a>
              )}
            </>
          )
        })()}
        {task.siteEngineerName && stage !== 'site_assign' && (
          <p className="text-xs text-cyan-600 font-semibold pt-0.5">Engineer: {task.siteEngineerName}</p>
        )}
        {(role === 'owner' || role === 'lead_manager') && task.quotationAmount != null && !['site_assign','site_visit','site_review','reschedule_review'].includes(stage) && (
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
      ...(assignMapLink.trim() ? { locationPin: { latitude: '', longitude: '', mapLink: assignMapLink.trim(), label: assignLocation.trim() || undefined } } : {}),
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
      updatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
    }

    onUpdate({
      flowStatus: isApproved ? 'reschedule_approved' : 'pending',
      visitDate: isApproved ? (task.requestedVisitDate ?? task.visitDate) : (lmNewVisitDate || task.visitDate),
      visitTime: isApproved ? (task.requestedVisitTime ?? task.visitTime) : (lmNewVisitTime || task.visitTime),
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
        updatedAt: new Date().toISOString(),
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
    const prodC = sqft > 0 ? sqft * productionRate : 0
    const instC = sqft > 0 ? sqft * installationRate : 0
    const transC= costTransAmt ? Number(costTransAmt) : 0
    const windows = costWindows ? Number(costWindows) : 0
    const doors   = costDoors ? Number(costDoors) : 0
    const totalC = matC + prodC + instC + transC
    const hasCosts = matC > 0 || prodC > 0 || instC > 0 || transC > 0
    if (hasCosts && totalC > quotAmount) {
      lossConfirmCb.current = () => submitSiteReview()
      setShowLossWarn(true)
      return
    }
    setShowLossWarn(false)
    const breakdown: CostBreakdown | undefined = (hasCosts || windows > 0 || doors > 0) ? {
      quotationAmount: quotAmount,
      numberOfSqft:    sqft > 0 ? sqft : undefined,
      numberOfWindows: windows > 0 ? windows : undefined,
      numberOfDoors:   doors > 0 ? doors : undefined,
      materialCost:    matC,
      productionCost:  prodC,
      installationCost:instC,
      transportCost:   transC,
      profit:          quotAmount - totalC,
    } : undefined
    const latestQuot = quotFiles[quotFiles.length - 1] ?? quotFiles[0]
    save({
      flowStage: 'owner_approval', flowStatus: 'waiting', status: 'pending',
      title: 'Approve Quotation',
      quotationAmount: quotAmount,
      quotationFile: latestQuot,
      quotationNotes: quotNotes || undefined,
      costBreakdown: breakdown,
      previousQuotationFile: undefined,
    }, `Quotation ₹${quotAmount.toLocaleString('en-IN')} sent for owner approval`, quotFiles)
    recordQuotationVersion(task, latestQuot, user?.name ?? 'Sales Team', role)
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
    const latestQuot = quotFiles[quotFiles.length - 1] ?? quotFiles[0]
    if (isSameQuotationFile(latestQuot, task.quotationFile)) {
      setError('Upload a fresh revised quotation file before resending.')
      return
    }
    const quotAmount = Number(quotAmt)
    const sqft  = costSqft ? Number(costSqft) : 0
    const matC  = costMaterial ? Number(costMaterial) : 0
    const prodC = sqft > 0 ? sqft * productionRate : 0
    const instC = sqft > 0 ? sqft * installationRate : 0
    const transC= costTransAmt ? Number(costTransAmt) : 0
    const totalC = matC + prodC + instC + transC
    const hasCosts = matC > 0 || prodC > 0 || instC > 0 || transC > 0
    if (hasCosts && totalC > quotAmount) {
      lossConfirmCb.current = () => submitReviseQuotation()
      setShowLossWarn(true)
      return
    }
    setShowLossWarn(false)
    const breakdown: CostBreakdown | undefined = hasCosts ? {
      quotationAmount: quotAmount,
      numberOfSqft:    sqft > 0 ? sqft : undefined,
      materialCost:    matC,
      productionCost:  prodC,
      installationCost:instC,
      transportCost:   transC,
      profit:          quotAmount - totalC,
    } : undefined
    save({
      flowStage: 'owner_approval', flowStatus: 'waiting', status: 'pending',
      title: 'Approve Quotation',
      quotationAmount: quotAmount,
      quotationFile: latestQuot,
      quotationNotes: quotNotes || undefined,
      costBreakdown: breakdown,
      ownerRejectionReason: undefined,
      previousQuotationFile: undefined,
    }, `Revised quotation ₹${quotAmount.toLocaleString('en-IN')} resent for owner approval`, quotFiles)
    recordQuotationVersion(task, latestQuot, user?.name ?? 'Sales Team', role)
  }

  function submitSendToClient() {
    if (!sel) return
    if (sel === 'client_approved') {
      save({ flowStatus: 'client_approved', status: 'in_progress', title: 'Order Confirmed — Collect Advance Payment' },
        'Client approved — order confirmed')
    } else {
      save({ flowStatus: 'client_rejected', status: 'overdue', clientRejectionReason: clientRejReason || undefined },
        `Client rejected${clientRejReason ? ': ' + clientRejReason : ''}`)
    }
  }

  function submitOrderConfirmed() {
    save({
      flowStage: 'advance_payment', flowStatus: 'ready', status: 'pending',
      title: 'Collect Advance Payment',
    }, 'Order confirmed — moving to advance payment')
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
    const latestQuot = quotFiles[quotFiles.length - 1] ?? quotFiles[0]
    if (isSameQuotationFile(latestQuot, task.quotationFile)) {
      setError('Upload a fresh revised quotation file before resending.')
      return
    }
    const quotAmount = Number(quotAmt)
    const sqft  = costSqft ? Number(costSqft) : 0
    const matC  = costMaterial ? Number(costMaterial) : 0
    const prodC = sqft > 0 ? sqft * productionRate : 0
    const instC = sqft > 0 ? sqft * installationRate : 0
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
      quotationFile: latestQuot,
      quotationNotes: quotNotes || undefined,
      costBreakdown: breakdown,
      clientRejectionReason: undefined,
      previousQuotationFile: undefined,
    }, `Revised quotation ₹${quotAmount.toLocaleString('en-IN')} sent for owner approval after client rejection`, quotFiles)
    recordQuotationVersion(task, latestQuot, user?.name ?? 'Sales Team', role)
  }

  function submitEditCostBreakdown() {
    if (!quotAmt) { setError('Enter the quotation amount to save.'); return }
    const quotAmount = Number(quotAmt)
    const sqft  = costSqft ? Number(costSqft) : 0
    const matC  = costMaterial ? Number(costMaterial) : 0
    const prodC = sqft > 0 ? sqft * productionRate : 0
    const instC = sqft > 0 ? sqft * installationRate : 0
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
    if (productionAdminOptions.length > 0 && !jobSheetAssignee) { setError('Select an Admin.'); return }
    save({
      flowStage: 'production_check', flowStatus: 'waiting', status: 'pending',
      title: 'Check Material Availability',
      jobSheet: jobSheetFiles[0] ?? undefined,
      jobSheetDetails: jobSheetText || undefined,
      glassSheet: glassSheetFiles[0] ?? undefined,
      cuttingSheet: cuttingSheetFiles[0] ?? undefined,
      additionalDocs: [...additionalDocs, ...extraSheets.flat()].length > 0 ? [...additionalDocs, ...extraSheets.flat()] : undefined,
      productionSheetNote: prodAssignNote || undefined,
      assignee: jobSheetAssignee || undefined,
    }, `Job sheet sent to ${jobSheetAssignee || 'Admin'} — checking material availability`, [...jobSheetFiles, ...glassSheetFiles, ...cuttingSheetFiles, ...additionalDocs, ...extraSheets.flat()])
  }

  function submitProductionCheck() {
    const mandatory = availChecklist.filter(i => i.id !== 'glass' && i.id !== 'hardware')
    const notAvailMandatory = mandatory.filter(i => i.status === 'not_available')
    const orderedMandatory  = mandatory.filter(i => i.status === 'order')

    for (const item of notAvailMandatory) {
      if (!item.reason.trim()) { setError(`Enter reason for ${item.label} not available.`); return }
    }
    for (const item of orderedMandatory) {
      if (!item.dueDate) { setError(`Select expected due date for ${item.label}.`); return }
    }

    const savedChecklist = availChecklist.map(i => ({
      id: i.id, label: i.label,
      available: i.status === 'available',
      ordered: i.status === 'order',
      notAvailableReason: i.reason || undefined,
      dueDate: i.dueDate || undefined,
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

    // Ordered mandatory items aren't confirmed available yet — don't unlock
    // Assign to Production Manager until they're actually in stock.
    if (orderedMandatory.length > 0) {
      const orderedLabel = orderedMandatory.map(i => i.label).join(', ')
      save({
        flowStatus: 'not_available', status: 'overdue',
        notAvailableReason: `On order: ${orderedLabel}`,
        availabilityChecklist: savedChecklist,
      }, `Materials on order: ${orderedLabel}`, [])
      return
    }

    const optionalNote = (id: string, label: string) => {
      const item = availChecklist.find(i => i.id === id)
      return item?.status === 'not_available' ? ` (${label} noted as not available)` : item?.status === 'order' ? ` (${label} being ordered)` : ''
    }
    const glassNote = optionalNote('glass', 'Glass')
    const hardwareNote = optionalNote('hardware', 'Hardware')
    save({
      flowStage: 'production_work', flowStatus: 'ready', status: 'pending',
      title: 'Start Production Work',
      notAvailableReason: undefined,
      availabilityChecklist: savedChecklist,
      assignee: pmAssignee || undefined,
      dueDate: 'Today',
    }, `Materials checked${glassNote}${hardwareNote} — assigned to ${pmAssignee || 'Production Manager'}`)
  }

  function submitNotAvailLmAction() {
    if (!notAvailLmAction) return
    if (notAvailLmAction === 'wait') {
      save({ flowStatus: 'waiting_stock', status: 'overdue' }, 'Waiting for stock to arrive')
    } else if (notAvailLmAction === 'recheck') {
      const note = notAvailNote.trim()
      save({
        flowStage: 'production_check', flowStatus: 'waiting', status: 'pending',
        title: 'Check Material Availability',
        notAvailableReason: undefined,
        note: note || undefined,
      }, `Sales Team sent back to Admin for recheck${note ? `: ${note}` : ''}`)
    }
  }

  function submitRestockAvailability() {
    if (!notAvailNote.trim()) { setError('Enter restock notes.'); return }
    const by = role === 'owner' ? 'MD/ED' : 'Sales Team'
    save({
      flowStage: 'production_check', flowStatus: 'waiting', status: 'pending',
      title: 'Check Material Availability',
      notAvailableReason: notAvailNote.trim(),
      restockExpectedDate: restockDate || undefined,
    }, `Restock availability requested by ${by}${restockDate ? ` — expected ${restockDate}` : ''}`)
  }

  function openAdvanceConvert() {
    if (!sel) return
    if (sel === 'pending') {
      save({ flowStatus: 'pending', status: 'pending' }, 'Advance payment pending'); return
    }
    if (!advPaidAmt) { setError('Enter paid amount.'); return }
    if (!advDueDate) { setError('Enter due date.'); return }
    setError('')
    setShowAdvanceConvert(true)
  }

  function submitAdvanceAndConvert() {
    if (!convProjectName.trim()) { setError('Project name is required.'); return }
    if (!convDueDate)            { setError('Due date is required.'); return }
    const paid    = Number(advPaidAmt)
    const total   = task.quotationAmount ?? 0
    const balance = advBalAmt ? Number(advBalAmt) : Math.max(0, total - paid)
    if (task.projectId) {
      const proj = projects.find(p => p.id === task.projectId)
      updateProject(task.projectId, {
        pendingConversion: false,
        name: convProjectName.trim(),
        dueDate: convDueDate,
        currentStage: 'production_admin_check',
        ...(convNotes.trim() ? { description: proj?.description ? `${proj.description}\n\nConversion notes: ${convNotes.trim()}` : convNotes.trim() } : {}),
      })
      if (proj?.leadId) updateLeadStatus(proj.leadId, 'converted')
    }
    save({
      flowStage: 'production_assign', flowStatus: 'ready', status: 'pending',
      title: 'Upload Job Sheet to Admin',
      advancePaymentType: sel,
      paidAmount: paid, balanceAmount: balance,
      dueDate: advDueDate,
      paymentNote: advNote || undefined,
      advancePaymentScreenshot: advPayScreenshot.length > 0 ? advPayScreenshot : undefined,
    }, `Advance ₹${paid.toLocaleString('en-IN')} received — converted to project`, advPayScreenshot)
  }

  function AdvanceConvertBlock() {
    if (!sel) return null
    if (!showAdvanceConvert) {
      return (
        <button type="button" onClick={openAdvanceConvert}
          className="w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 bg-emerald-600">
          {`✓ ${sel === 'advance_paid' ? 'Advance Paid' : sel === 'partial_paid' ? 'Part Paid' : 'Full Paid'} — Convert to Project`}
        </button>
      )
    }
    return (
      <div className="space-y-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Convert to Project</p>
        <div>
          <label className={lbl}>Project Name {req}</label>
          <input type="text" value={convProjectName} onChange={e => setConvProjectName(e.target.value)}
            placeholder="e.g. Rajesh Kumar — Living Room Windows" className={inp} />
        </div>
        <div>
          <label className={lbl}>Project Due Date {req}</label>
          <input type="date" value={convDueDate} onChange={e => setConvDueDate(e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
          <textarea rows={2} value={convNotes} onChange={e => setConvNotes(e.target.value)}
            placeholder="Any additional notes…" className={`${inp} resize-none`} />
        </div>
        <button type="button" onClick={submitAdvanceAndConvert}
          className="w-full py-4 rounded-2xl bg-emerald-700 text-white text-sm font-extrabold active:opacity-90">
          ✓ Convert to Project
        </button>
      </div>
    )
  }

  function submitProductionWork() {
    save({
      flowStage: 'dispatch_assign', flowStatus: 'ready', status: 'pending',
      title: 'Assign to Dispatch',
      productionChecklist: prodChecklist,
      productionOverdueReason: undefined, productionNewDate: undefined,
    }, `Ready to Dispatch by ${user?.name ?? 'Production Manager'}`)
  }

  function submitMaterialStatusUpdate() {
    const overdueItems = pmMaterialChecklist.filter(i => i.overdue)
    const hasOverdue = overdueItems.length > 0
    save({
      availabilityChecklist: pmMaterialChecklist,
      materialStatusOverdue: hasOverdue,
      materialStatusNote: hasOverdue ? `Overdue: ${overdueItems.map(i => i.label).join(', ')}` : undefined,
    }, hasOverdue
      ? `Production Manager flagged material overdue — sent to Admin: ${overdueItems.map(i => i.label).join(', ')}`
      : 'Production Manager updated material status')
  }

  function submitAssignToDispatch() {
    save({
      flowStage: 'admin_availability_check', flowStatus: 'pending', status: 'pending',
      title: 'Check Installation Availability',
    }, 'Lead Owner sent project for dispatch assignment.')
  }

  function submitAdminAvailabilityCheck() {
    if (!proposedInstPerson) { setError('Select a proposed installation person.'); return }
    if (!proposedInstDate)   { setError('Select proposed installation date.'); return }
    save({
      flowStage: 'site_lead_approval', flowStatus: 'pending', status: 'pending',
      title: 'Approve Installation Availability',
      proposedInstallationPerson: proposedInstPerson,
      proposedInstallationDate: proposedInstDate,
      adminAvailabilityNotes: adminAvailNotes || undefined,
      availabilityStatus: 'need_approval',
    }, `Admin requested Site Engineer Lead approval for installation assignment — proposed ${proposedInstPerson} on ${proposedInstDate}`)
  }

  function submitSiteLeadAssignContinue() {
    const person = task.proposedInstallationPerson
    const date   = task.proposedInstallationDate
    if (!person || !date) { setError('No proposed installation person on file.'); return }
    save({
      flowStage: 'installation_update', flowStatus: 'assigned', status: 'in_progress',
      title: 'Update Installation Status',
      installationPerson: person,
      installationDate: date,
      installationApprovedBy: user?.name,
      assignedTo: person,
      assignee: person,
    }, `Site Engineer Lead approved installation person ${person} for ${date}.`)
  }

  function submitSiteLeadChangePerson() {
    if (!changedInstPerson) { setError('Select an installation person.'); return }
    if (!changedInstDate)   { setError('Select installation date.'); return }
    const oldPerson = task.proposedInstallationPerson ?? 'Unassigned'
    save({
      flowStage: 'installation_update', flowStatus: 'assigned', status: 'in_progress',
      title: 'Update Installation Status',
      installationPerson: changedInstPerson,
      installationDate: changedInstDate,
      installationApprovedBy: user?.name,
      installationPersonChangedFrom: oldPerson,
      note: changedInstNotes || undefined,
      assignedTo: changedInstPerson,
      assignee: changedInstPerson,
    }, `Site Engineer Lead changed installation person from ${oldPerson} to ${changedInstPerson}.`)
  }

  function submitSavePackProgress() {
    const doneCt = packChecklist.filter(i => i.done).length
    if (doneCt === 0) { setError('Tick at least one item before saving.'); return }
    const pct = Math.round((doneCt / packChecklist.length) * 100)
    const updates = { flowStatus: 'ready_to_pack', status: 'pending', packChecklist } as unknown as Partial<Task>
    save(updates, `Packing progress saved: ${doneCt}/${packChecklist.length} items (${pct}%)`)
  }

  function submitReadyToDispatch() {
    save({
      flowStage: 'installation_assign', flowStatus: 'ready', status: 'pending',
      title: 'Assign Installation',
    }, 'All items packed — Ready to Dispatch')
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
      assignedTo: instPerson,
      assignee: instPerson,
    }, `Installation assigned to ${instPerson} on ${instDate}`, instFiles)
  }

  function submitInstallationUpdate() {
    if (!sel) return
    if (sel === 'completed') {
      if (instCompletedPhotos.length === 0) { setError('Upload at least 1 installation photo before submitting.'); return }
      save({
        flowStage: 'final_payment', flowStatus: 'pending', status: 'pending', title: 'Collect Final Payment',
        installationFiles: instCompletedPhotos,
      }, 'Installation completed', instCompletedPhotos)
    } else if (sel === 'not_completed') {
      if (!instNotCompNote.trim()) { setError('Add reason before saving.'); return }
      if (!instNextVisitDate)      { setError('Select the next visit date.'); return }
      save({
        flowStatus: 'not_completed', status: 'overdue',
        installationMistakeDetails: instNotCompNote,
        installationNextVisitDate: instNextVisitDate,
        note: instNotCompExtraNotes || undefined,
      }, `Installation not completed. Next visit scheduled on ${instNextVisitDate}.`, instNotCompFiles)
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
      }, 'Installation mistake — sent back to Admin for material check')
    } else if (instMistakeReviewAction === 'send_back_prod_manager') {
      save({
        flowStage: 'production_work', flowStatus: 'pending', status: 'in_progress',
        title: 'Production Work',
      }, 'Installation mistake — sent back to Admin for rework')
    } else if (instMistakeReviewAction === 'reassign_installation') {
      save({
        flowStage: 'installation_assign', flowStatus: 'ready', status: 'pending',
        title: 'Assign Installation',
        installationPerson: undefined,
        installationDate: undefined,
        assignedTo: undefined,
        assignee: undefined,
      }, 'Installation mistake — reassigning installation team')
    } else if (instMistakeReviewAction === 'mark_resolved') {
      save({
        flowStage: 'final_payment', flowStatus: 'pending', status: 'pending',
        title: 'Collect Final Payment',
      }, 'Installation mistake resolved — collecting final payment')
    }
  }

  // Bundles "record the final balance payment" + "log actual expenses/extra
  // charge" + "mark the project completed" into a single save — previously
  // these were two separate steps and save() always closes the popup, so
  // completing a project in one go meant closing then having to reopen the
  // same task just to see the Extra Charge / Complete Project step.
  function completeProjectWithPayment(paidAmount: number, balanceAmount: number, paymentNote: string) {
    if ((role === 'owner' || role === 'lead_manager') && !extraChargeAmt.trim()) {
      setError('Enter Extra Cost (enter 0 if none).')
      return
    }
    const totalExpenses = [actualMaterial, actualProduction, actualInstallation, actualTransport]
      .reduce((s, v) => s + (Number(v) || 0), 0)
    const extraCharge = Number(extraChargeAmt) || 0
    if (task.projectId) {
      updateProject(task.projectId, {
        status: 'completed', isCompleted: true,
        completedAt: new Date().toISOString(),
        actualCompletedDate: new Date().toISOString(),
        workflowStatus: 'Finished', paymentStatus: 'Full Paid', progress: 100,
        ...(totalExpenses > 0 ? {
          actualCosts: {
            quotationAmount: task.quotationAmount ?? task.costBreakdown?.quotationAmount ?? 0,
            materialCost:    Number(actualMaterial)     || 0,
            productionCost:  Number(actualProduction)   || 0,
            installationCost:Number(actualInstallation) || 0,
            transportCost:   Number(actualTransport)    || 0,
            extraCharge,
            profit:          ((task.quotationAmount ?? 0) + extraCharge) - totalExpenses,
          },
        } : {}),
      } as Partial<Project>)
    }
    save({
      flowStage: 'completed', flowStatus: 'done', status: 'completed',
      title: 'Project Completed',
      paidAmount, balanceAmount,
      finalPaymentScreenshot: finalPayScreenshot.length > 0 ? finalPayScreenshot : undefined,
    }, `${paymentNote} — Project completed by ${user?.name ?? role}`, finalPayScreenshot)
  }

  function submitFinalPayment() {
    if (!sel) return
    if (sel === 'full_paid') {
      const advance = task.paidAmount ?? 0
      const total   = task.quotationAmount ?? 0
      const finalIncrement = Math.max(0, total - advance)
      const totalPaid = advance + finalIncrement
      save({
        flowStage: 'final_completion',
        flowStatus: 'full_paid',
        status: 'pending',
        title: 'Complete Project',
        paidAmount: totalPaid,
        balanceAmount: 0,
      }, `Final payment ₹${finalIncrement.toLocaleString('en-IN')} received (total ₹${totalPaid.toLocaleString('en-IN')})`)
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

  // ── DEMO OVERRIDE helpers ────────────────────────────────────────────────
  // Override (acting on behalf of another role's stage) is MD-only — Lead
  // Owner no longer gets it. Every canDemoOverride usage below is already
  // paired with `role !== 'owner'`, so restricting this to 'owner' makes
  // those LM-override blocks unreachable while leaving the owner's own
  // separate override path (gated directly on role === 'owner') untouched.
  const canDemoOverride = role === 'owner'

  function demoSave(updates: Partial<Task>, histNote?: string, histFiles?: string[]) {
    const by   = role === 'owner' ? 'MD/ED' : 'Sales Team'
    const note = histNote ? `${histNote} (Override by ${by})` : `(Override by ${by})`
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
    const mandatory = availChecklist.filter(i => i.id !== 'glass' && i.id !== 'hardware')
    const notAvailMandatory = mandatory.filter(i => i.status === 'not_available')
    const orderedMandatory  = mandatory.filter(i => i.status === 'order')

    for (const item of notAvailMandatory) {
      if (!item.reason.trim()) { setError(`Enter reason for ${item.label} not available.`); return }
    }
    for (const item of orderedMandatory) {
      if (!item.dueDate) { setError(`Select expected due date for ${item.label}.`); return }
    }

    const savedChecklist = availChecklist.map(i => ({
      id: i.id, label: i.label,
      available: i.status === 'available',
      ordered: i.status === 'order',
      notAvailableReason: i.reason || undefined,
      dueDate: i.dueDate || undefined,
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

    const optionalNote2 = (id: string, label: string) => {
      const item = availChecklist.find(i => i.id === id)
      return item?.status === 'order' ? ` (${label} being ordered)` : item?.status === 'not_available' ? ` (${label} noted)` : ''
    }
    const glassNote2 = optionalNote2('glass', 'Glass')
    const hardwareNote2 = optionalNote2('hardware', 'Hardware')
    const orderedNote2 = orderedMandatory.length > 0 ? ` — ordering: ${orderedMandatory.map(i => i.label).join(', ')}` : ''
    demoSave({
      flowStage: 'production_work', flowStatus: 'ready', status: 'pending',
      title: 'Start Production Work',
      notAvailableReason: undefined,
      availabilityChecklist: savedChecklist,
    }, `Materials checked${glassNote2}${hardwareNote2}${orderedNote2} — starting production`)
  }

  function submitDemoProductionWork() {
    demoSave({
      flowStage: 'dispatch_assign', flowStatus: 'ready', status: 'pending',
      title: 'Assign to Dispatch',
      productionChecklist: prodChecklist,
      productionOverdueReason: undefined, productionNewDate: undefined,
    }, 'All production steps completed — Ready to Dispatch')
  }

  function submitDemoProductionWorkOverdue() {
    if (!overdueNote.trim()) { setError('Add reason for overdue.'); return }
    if (!overdueNewDate)     { setError('Enter new expected date.'); return }
    demoSave({ flowStatus: 'overdue', status: 'overdue', productionOverdueReason: overdueNote, productionNewDate: overdueNewDate },
      `Production overdue: ${overdueNote}`, overdueFiles)
  }

  const totalCost = (task.productCost ?? 0) + (task.installationCost ?? 0) + (task.materialCost ?? 0) + (task.transportCost ?? 0)
  const hasCostDetails = !!(task.productCost || task.installationCost || task.materialCost || task.transportCost)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[94vh] overflow-y-auto">

        {/* Header */}
        <div className={`sticky top-0 z-10 ${STAGE_BG[displayStage] ?? 'bg-blue-600'} px-5 py-4 rounded-t-3xl`}>
          <div className="flex items-center justify-between">
            <div>
              {!project?.pendingConversion && (
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">{task.projectName}</p>
              )}
              <h2 className="text-white text-base font-extrabold leading-tight">
                {ownerNavStage ? STAGE_LABEL[ownerNavStage] ?? task.title : task.title}
              </h2>
              {leadOwnerName && (
                <p className="text-white/60 text-[10px] mt-0.5">Lead Owner: {leadOwnerName}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {task.projectId && !project?.pendingConversion && (
                <button type="button" onClick={() => { onClose(); navigate(`/project/${task.projectId}`) }}
                  className="flex items-center gap-1.5 px-3 h-8 bg-white/20 rounded-xl text-white text-xs font-bold active:bg-white/30">
                  <FolderOpen size={13} /> View Project
                </button>
              )}
              <button type="button" onClick={onClose} className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>

          {/* Previous/Next STAGE of this project — MD/ED/Owner only */}
          {role === 'owner' && (
            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/20">
              <button type="button" onClick={goPrevStage} disabled={!stageNavHasPrev}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold active:bg-white/30 disabled:opacity-30 disabled:pointer-events-none">
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-[11px] text-white/80 font-semibold flex-shrink-0">
                Stage {stageNavCurrent} of {stageNavTotal}
              </span>
              <button type="button" onClick={goNextStage} disabled={!stageNavHasNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold active:bg-white/30 disabled:opacity-30 disabled:pointer-events-none">
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-3 pb-10">

          <ContextStrip />

          {/* Site Engineer can view the quotation for their assigned project
              once one exists, even though quotation/approval isn't their stage. */}
          {role === 'site_engineer' && task.quotationFile && (
            <MediaPreviewList files={[task.quotationFile]} title="Quotation File" />
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-600">{error}</p>
            </div>
          )}

          {/* ── Read-only stage history (Previous/Next stage browsing) ────── */}
          {viewingHistory && (() => {
            const entry = stageHistory[historyIndex!]
            return (
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stage History</p>
                  <p className="text-sm font-extrabold text-slate-800">{STAGE_LABEL[entry.stage] ?? entry.stage}</p>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{entry.status.replace(/_/g, ' ')}</p>
                </div>
                {entry.note && (
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Note</p>
                    <p className="text-sm text-slate-700">{entry.note}</p>
                  </div>
                )}
                {entry.files && entry.files.length > 0 && (
                  <MediaPreviewList files={entry.files} title="Attachments" voiceStore={voicePreviewStore} />
                )}
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>{entry.updatedBy} · {entry.updatedRole}</span>
                  <span>{new Date(entry.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <button type="button" onClick={() => setShowRollbackConfirm(true)}
                  className="w-full py-3.5 rounded-2xl border-2 border-red-200 bg-red-50 text-red-600 text-sm font-extrabold active:bg-red-100">
                  ↺ Roll Back to This Stage
                </button>
                <Dialog
                  isOpen={showRollbackConfirm}
                  onClose={() => setShowRollbackConfirm(false)}
                  onConfirm={rollbackToStage}
                  variant="danger"
                  title="Roll back this project?"
                  message={`This moves the project back to "${STAGE_LABEL[entry.stage] ?? entry.stage}" and undoes everything that happened after it. This can't be undone.`}
                  confirmLabel="Roll Back"
                />
              </div>
            )
          })()}

          {/* ── Stage Hand-off Summary (3 specific transitions only) ──────── */}
          {(() => {
            // 1. LO → Admin → Production Manager: show what LO sent (job sheet,
            // glass/cutting sheet, voice note) at both stages that receive it.
            if (displayStage === 'production_check' || displayStage === 'production_work') {
              const assignEntry = [...(task.statusHistory ?? [])].reverse()
                .find(h => h.stage === 'production_assign' && h.status === 'completed')
              const uploadMeta = assignEntry
                ? `Uploaded by ${assignEntry.updatedBy} (${assignEntry.updatedRole}) · ${new Date(assignEntry.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : undefined
              const items: string[] = []
              if (!task.jobSheet && task.jobSheetDetails) items.push(`Job Sheet: ${task.jobSheetDetails.slice(0, 60)}`)
              if (task.productionSheetNote) items.push(`LO Notes: ${task.productionSheetNote.slice(0, 80)}`)
              if (displayStage === 'production_work' && task.availabilityChecklist?.length)
                task.availabilityChecklist.forEach(i => {
                  items.push(`${i.label}: ${i.available ? '✓ Available' : i.ordered ? '⏳ Ordered' : '✗ N/A'}`)
                })
              const hasDocs = !!(task.jobSheet || task.glassSheet || task.cuttingSheet || task.additionalDocs?.length || task.specialNoteProduction?.length)
              if (items.length === 0 && !hasDocs) return null
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2.5">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Production Documents from LO / Admin</p>
                  {task.jobSheet && <MediaPreviewList files={[task.jobSheet]} title="Job Sheet" />}
                  {task.glassSheet && <MediaPreviewList files={[task.glassSheet]} title="Glass Sheet" />}
                  {task.cuttingSheet && <MediaPreviewList files={[task.cuttingSheet]} title="Cutting Sheet" />}
                  {task.additionalDocs && task.additionalDocs.length > 0 && (
                    <MediaPreviewList files={task.additionalDocs} title="Additional Docs" />
                  )}
                  {task.specialNoteProduction && task.specialNoteProduction.length > 0 && (
                    <MediaPreviewList files={task.specialNoteProduction} title="Voice Note to Production" voiceStore={voicePreviewStore} />
                  )}
                  {uploadMeta && <p className="text-[10px] text-amber-500">{uploadMeta}</p>}
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-300 text-xs mt-0.5">·</span>
                      <p className="text-xs text-amber-800">{item}</p>
                    </div>
                  ))}
                </div>
              )
            }

            // 2. Production Manager → Lead Owner: show PM completion summary
            if (displayStage === 'installation_assign') {
              const items: string[] = []
              items.push('All production steps completed ✓')
              items.push('Ready to Dispatch ✓')
              if (task.productionChecklist?.length) {
                task.productionChecklist.forEach(step => {
                  items.push(`${step.label}: ${step.done ? '✓ Done' : '— Pending'}`)
                })
              }
              if (task.availabilityChecklist?.length) {
                const allConfirmed = task.availabilityChecklist.every(i => i.available || i.ordered)
                items.push(`Materials: ${allConfirmed ? 'All confirmed' : 'Verify with production'}`)
              }
              if (items.length === 0) return null
              return (
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Production Manager Update</p>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-teal-300 text-xs mt-0.5">·</span>
                      <p className="text-xs text-teal-800">{item}</p>
                    </div>
                  ))}
                </div>
              )
            }

            // 3. Production availability check → Installation team
            if (displayStage === 'installation_update' || displayStage === 'site_lead_approval') {
              const items: string[] = []
              if (task.availabilityChecklist?.length)
                task.availabilityChecklist.forEach(i => {
                  items.push(`${i.label}: ${i.available ? '✓ Available' : i.ordered ? '⏳ Ordered' : '✗ N/A'}`)
                })
              const hasDocs = !!(task.jobSheet || task.glassSheet || task.specialNoteInstallation?.length)
              if (items.length === 0 && !hasDocs) return null
              return (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 space-y-2.5">
                  <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Production Availability Check</p>
                  {task.jobSheet && <MediaPreviewList files={[task.jobSheet]} title="Job Sheet" />}
                  {task.glassSheet && <MediaPreviewList files={[task.glassSheet]} title="Glass Sheet" />}
                  {task.specialNoteInstallation && task.specialNoteInstallation.length > 0 && (
                    <MediaPreviewList files={task.specialNoteInstallation} title="Voice Note to Installation" voiceStore={voicePreviewStore} />
                  )}
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-purple-300 text-xs mt-0.5">·</span>
                      <p className="text-xs text-purple-800">{item}</p>
                    </div>
                  ))}
                </div>
              )
            }

            return null
          })()}

          {/* ═══════════════════════════════════════════════════════════════
              1. SITE ASSIGN
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'site_assign' && (
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
                <label className={lbl}>Map Link <span className="text-slate-300 font-normal">(optional)</span></label>
                <input type="text" value={assignMapLink}
                  onChange={e => setAssignMapLink(e.target.value)}
                  placeholder="Paste Google Maps link" className={inp} />
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
          {displayStage === 'site_visit' && (role === 'site_engineer' || (role === 'owner' && demoOverride)) && (
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

                  <Opt value="completed"  label="Completed"   sub="Visit done — upload photos and measurements"   accent="border-emerald-200" sel={sel} onPick={pick} />

                  {sel === 'completed' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 bg-teal-50 rounded-xl px-3 py-2">
                        <Camera size={14} className="text-teal-500 flex-shrink-0" />
                        <p className="text-xs text-teal-700 font-semibold">All fields below are required.</p>
                      </div>

                      <MultiFileUploadField label="Site Photos" required accept="image/*,.png,.jpg,.jpeg,.webp,.heic"
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
                        onReplace={(oldId, url) => setVoiceNoteProductionIds(prev => prev.map(x => x === oldId ? url : x))}
                        helperText="Optional voice note for production team" />

                      <VoiceRecorder label="Voice Note to Installation"
                        savedIds={voiceNoteInstallationIds}
                        onAdd={id => setVoiceNoteInstallationIds(prev => [...prev, id])}
                        onRemove={id => setVoiceNoteInstallationIds(prev => prev.filter(x => x !== id))}
                        onReplace={(oldId, url) => setVoiceNoteInstallationIds(prev => prev.map(x => x === oldId ? url : x))}
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

                  <div className="border-t border-slate-100 pt-2">
                    <Opt value="reschedule" label="Reschedule"  sub="Cannot visit as planned — request new date"   accent="border-amber-200"   sel={sel} onPick={pick} />
                  </div>

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
                        Send Reschedule Request to Lead Owner
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
          {displayStage === 'site_visit' && role !== 'site_engineer' && role !== 'owner' && (
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
                <Opt value="approved" label="Approve Reschedule" sub="Allow site visit to move to the requested date" accent="border-emerald-200" sel={sel} onPick={pick} />
                <Opt value="rejected" label="Reject &amp; Set New Date" sub="Assign a different date for the site visit" accent="border-red-200" sel={sel} onPick={pick} />

                {sel === 'rejected' && (
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>New Visit Date {req}</label>
                      <input type="date" value={lmNewVisitDate} onChange={e => setLmNewVisitDate(e.target.value)} className={inp} />
                    </div>
                    <TimePickerField label="New Visit Time" value={lmNewVisitTime} onChange={setLmNewVisitTime} />
                    <div>
                      <label className={lbl}>Rejection Note <span className="text-slate-300 font-normal">(optional)</span></label>
                      <textarea rows={2} value={lmReschedNote} onChange={e => setLmReschedNote(e.target.value)}
                        placeholder="Reason for rejecting the requested date…" className={`${inp} resize-none`} />
                    </div>
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

          {/* CONTROL: Site Visit — owner sees Take Control, LM sees Override */}
          {displayStage === 'site_visit' && role === 'owner' && flowStatus !== 'reschedule_requested' && !demoOverride && (
            <>
              <WaitingView icon={MapPinIcon} color="bg-teal-50 border border-teal-200 text-teal-700"
                title={`Site Visit Pending — ${task.siteEngineerName ?? 'Engineer'}`}
                sub={`Visit ${task.visitDate ? `on ${task.visitDate}` : 'date TBD'}${task.visitTime ? ` at ${task.visitTime}` : ''}`} />
              <DemoControlCard waitingFor="Site Engineer" description="Site Engineer needs to complete the site visit."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}
          {displayStage === 'site_visit' && canDemoOverride && role !== 'owner' && flowStatus !== 'reschedule_requested' && !demoOverride && (
            <DemoControlCard
              waitingFor="Site Engineer"
              description="Site Engineer needs to complete the site visit. For demo, submit it directly."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {displayStage === 'site_visit' && canDemoOverride && role !== 'owner' && flowStatus !== 'reschedule_requested' && demoOverride && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Override Active — Acting as Site Engineer</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>

              {/* Customer contact card in demo override */}
              <CustomerDetailsCard task={task} project={project} />

              <div className="flex items-center gap-2 bg-teal-50 rounded-xl px-3 py-2">
                <Camera size={14} className="text-teal-500 flex-shrink-0" />
                <p className="text-xs text-teal-700 font-semibold">Upload site visit data below.</p>
              </div>

              <MultiFileUploadField label="Site Photos" required accept="image/*,.png,.jpg,.jpeg,.webp,.heic"
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
                onReplace={(oldId, url) => setVoiceNoteProductionIds(prev => prev.map(x => x === oldId ? url : x))}
                helperText="Optional voice note for production team" />

              <VoiceRecorder label="Voice Note to Installation"
                savedIds={voiceNoteInstallationIds}
                onAdd={id => setVoiceNoteInstallationIds(prev => [...prev, id])}
                onRemove={id => setVoiceNoteInstallationIds(prev => prev.filter(x => x !== id))}
                onReplace={(oldId, url) => setVoiceNoteInstallationIds(prev => prev.map(x => x === oldId ? url : x))}
                helperText="Optional voice note for installation team" />

              <div>
                <label className={lbl}>Note <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={seNote} onChange={e => setSeNote(e.target.value)}
                  placeholder="Any observations…" className={`${inp} resize-none`} />
              </div>

              <button type="button" onClick={submitDemoSiteVisitComplete}
                className="w-full py-4 rounded-2xl bg-amber-600 text-white text-sm font-extrabold active:opacity-90">
                ✓ Submit Site Visit (Override) →
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              RESCHEDULE REVIEW — LM approves or rejects SE reschedule
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'reschedule_review' && (
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
          {displayStage === 'site_review' && (
            <>
              {/* ── Site Visit Summary (moved to top — everything except site location) ── */}
              {(task.siteEngineerName || task.visitDate || task.sitePhotos?.length || task.measurementDetails) && (
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Site Visit Summary</p>

                  {(task.siteEngineerName || task.visitDate) && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 space-y-0.5">
                      <p className="text-[10px] font-bold text-cyan-500 uppercase mb-1">Site Engineer Details</p>
                      {task.siteEngineerName && <p className="text-sm font-bold text-cyan-800">{task.siteEngineerName}</p>}
                      {task.visitDate && <p className="text-xs text-cyan-600">Visit Date: {task.visitDate}{task.visitTime ? ` at ${task.visitTime}` : ''}</p>}
                      {task.note && <p className="text-xs text-cyan-500 italic mt-0.5">"{task.note}"</p>}
                    </div>
                  )}
                  {task.sitePhotos && task.sitePhotos.length > 0 && (
                    <div className="bg-teal-50 rounded-xl px-4 py-3">
                      <MediaPreviewList files={task.sitePhotos} title={`Site Photos (${task.sitePhotos.length})`} />
                    </div>
                  )}
                  {task.measurementFiles && task.measurementFiles.length > 0 && (
                    <div className="bg-violet-50 rounded-xl px-4 py-3">
                      <MediaPreviewList files={task.measurementFiles} title={`Measurement Files (${task.measurementFiles.length})`} />
                    </div>
                  )}
                  {task.measurementDetails && (
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Measurements</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{task.measurementDetails}</p>
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
                </div>
              )}

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Create Quotation</p>

              <MultiFileUploadField label="Quotation File" required accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
                files={quotFiles} onChange={setQuotFiles}
                helperText="Upload quotation PDF or document — required" />

              <div>
                <label className={lbl}>Quotation Amount (₹) {req}</label>
                <input type="text" inputMode="numeric" value={quotAmt}
                  onChange={e => setQuotAmt(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 175000" className={inp} />
              </div>

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
                  <label className={lbl}>Total Sq. ft</label>
                  <input type="text" inputMode="numeric" value={costSqft}
                    onChange={e => setCostSqft(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 120 — drives production & installation cost" className={inp} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>No. of Windows <span className="text-slate-300 font-normal">(optional)</span></label>
                    <input type="text" inputMode="numeric" value={costWindows}
                      onChange={e => setCostWindows(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="0" className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>No. of Doors <span className="text-slate-300 font-normal">(optional)</span></label>
                    <input type="text" inputMode="numeric" value={costDoors}
                      onChange={e => setCostDoors(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="0" className={inp} />
                  </div>
                </div>

                {(costSqft || costMaterial || costTransAmt) && (() => {
                  const sqft       = Number(costSqft) || 0
                  const matC       = Number(costMaterial) || 0
                  const prodC      = sqft * productionRate
                  const instC      = sqft * installationRate
                  const transC     = Number(costTransAmt) || 0
                  const totalC     = matC + prodC + instC + transC
                  const quotAmount = Number(quotAmt) || 0
                  const isLoss     = quotAmount > 0 && totalC > quotAmount
                  const profit     = quotAmount - totalC
                  return (
                    <div className="space-y-1.5">
                      {matC > 0 && (
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                          <span className="text-xs font-semibold text-slate-600">Material Cost</span>
                          <span className="text-sm font-extrabold text-slate-700">₹{matC.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {sqft > 0 && canSeeCosts && (
                        <>
                          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                            <span className="text-xs font-semibold text-blue-700">Production Cost <span className="font-normal text-blue-400">(₹{productionRate} × sq.ft)</span></span>
                            <span className="text-sm font-extrabold text-blue-700">₹{prodC.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                            <span className="text-xs font-semibold text-violet-700">Installation Cost <span className="font-normal text-violet-400">(₹{installationRate} × sq.ft)</span></span>
                            <span className="text-sm font-extrabold text-violet-700">₹{instC.toLocaleString('en-IN')}</span>
                          </div>
                        </>
                      )}
                      {transC > 0 && (
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                          <span className="text-xs font-semibold text-amber-700">Transport Cost</span>
                          <span className="text-sm font-extrabold text-amber-700">₹{transC.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className={`rounded-xl px-4 py-2.5 space-y-1.5 ${canSeeProfit && isLoss ? 'bg-red-50 border border-red-200' : 'bg-slate-100'}`}>
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-700">Total Costs</span>
                          <span className={`font-extrabold ${canSeeProfit && isLoss ? 'text-red-600' : 'text-slate-800'}`}>
                            ₹{totalC.toLocaleString('en-IN')}
                          </span>
                        </div>
                        {canSeeProfit && quotAmount > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className={isLoss ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'}>
                              {isLoss ? 'Loss' : 'Profit'}
                            </span>
                            <span className={`font-bold ${isLoss ? 'text-red-600' : 'text-emerald-600'}`}>
                              ₹{Math.abs(profit).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                        {canSeeProfit && isLoss && (
                          <p className="text-[11px] text-red-600 font-semibold pt-0.5">
                            ⚠ Quotation is lower than estimated cost — this project will run at a loss.
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <button type="button" onClick={submitSiteReview}
                className="w-full py-4 rounded-2xl bg-violet-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <Send size={15} /> Send Quotation for Approval
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              4a. OWNER APPROVAL — Owner only
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'owner_approval' && role === 'owner' && flowStatus === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-1">
              <p className="text-xs font-bold text-red-600 uppercase">You Rejected This Quotation</p>
              <p className="text-sm text-red-700">{task.ownerRejectionReason}</p>
              <p className="text-xs text-red-500 pt-1">Waiting for Sales Team to revise and resend.</p>
            </div>
          )}

          {displayStage === 'owner_approval' && role === 'owner' && flowStatus !== 'rejected' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quotation Review</p>

              <QuotationVersionsPanel task={task} />

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

              {task.costBreakdown && (task.costBreakdown.numberOfWindows || task.costBreakdown.numberOfDoors) && (
                <div className="grid grid-cols-2 gap-3">
                  {task.costBreakdown.numberOfWindows != null && (
                    <div className="bg-slate-50 rounded-xl px-4 py-2.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">No. of Windows</p>
                      <p className="text-sm font-bold text-slate-700">{task.costBreakdown.numberOfWindows}</p>
                    </div>
                  )}
                  {task.costBreakdown.numberOfDoors != null && (
                    <div className="bg-slate-50 rounded-xl px-4 py-2.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">No. of Doors</p>
                      <p className="text-sm font-bold text-slate-700">{task.costBreakdown.numberOfDoors}</p>
                    </div>
                  )}
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
          {displayStage === 'owner_approval' && role !== 'owner' && flowStatus !== 'rejected' && !demoOverride && (
            <WaitingView icon={Clock} color="bg-purple-50 border border-purple-200 text-purple-700"
              title="Waiting for MD/ED Approval"
              sub={`Quotation ₹${task.quotationAmount?.toLocaleString('en-IN') ?? '—'} sent for MD/ED review`} />
          )}

          {/* OVERRIDE CONTROL: Owner Approval — LM only (owner has their own form above) */}
          {displayStage === 'owner_approval' && canDemoOverride && role !== 'owner' && flowStatus !== 'rejected' && !demoOverride && (
            <DemoControlCard
              waitingFor="MD/ED"
              description="MD/ED needs to approve or reject the quotation. You can override and process it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {displayStage === 'owner_approval' && canDemoOverride && role !== 'owner' && flowStatus !== 'rejected' && demoOverride && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Override Active — Acting as MD/ED</p>
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
                  {sel === 'approved' ? '✓ Approve Quotation (Override)' : 'Reject Quotation (Override)'}
                </button>
              )}
            </div>
          )}

          {/* 4c. OWNER APPROVAL — LM revision after rejection */}
          {displayStage === 'owner_approval' && role !== 'owner' && flowStatus === 'rejected' && (
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

              <MultiFileUploadField label="Quotation File" required accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png" files={quotFiles} onChange={setQuotFiles} helperText="Upload revised quotation document" />

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

              {(costSqft || costMaterial || costTransAmt) && (() => {
                const sqft  = Number(costSqft) || 0
                const matC  = Number(costMaterial) || 0
                const prodC = sqft * productionRate
                const instC = sqft * installationRate
                const transC = Number(costTransAmt) || 0
                const total = matC + prodC + instC + transC
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-600">Material Cost</span>
                      <span className="text-sm font-extrabold text-slate-700">₹{matC.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-semibold text-blue-700">Production Cost <span className="font-normal text-blue-400">(₹{productionRate} × sq.ft)</span></span>
                      <span className="text-sm font-extrabold text-blue-700">₹{prodC.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-semibold text-violet-700">Installation Cost <span className="font-normal text-violet-400">(₹{installationRate} × sq.ft)</span></span>
                      <span className="text-sm font-extrabold text-violet-700">₹{instC.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-semibold text-amber-700">Transport Cost</span>
                      <span className="text-sm font-extrabold text-amber-700">₹{transC.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-100 rounded-xl px-4 py-2.5">
                      <span className="text-xs font-bold text-slate-700">Total Costs</span>
                      <span className="text-sm font-extrabold text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )
              })()}

              <div>
                <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={quotNotes} onChange={e => setQuotNotes(e.target.value)}
                  placeholder="Changes made or additional notes…" className={`${inp} resize-none`} />
              </div>

              <button type="button" onClick={submitReviseQuotation}
                className="w-full py-4 rounded-2xl bg-violet-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <Send size={15} /> Resend Quotation for Approval
              </button>

              {/* ── Site Visit Summary below resend button ── */}
              {(task.siteEngineerName || task.visitDate || task.sitePhotos?.length || task.measurementDetails) && (
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Site Visit Summary</p>
                  {(task.siteEngineerName || task.visitDate) && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 space-y-0.5">
                      <p className="text-[10px] font-bold text-cyan-500 uppercase mb-1">Site Engineer Details</p>
                      {task.siteEngineerName && <p className="text-sm font-bold text-cyan-800">{task.siteEngineerName}</p>}
                      {task.visitDate && <p className="text-xs text-cyan-600">Visit Date: {task.visitDate}{task.visitTime ? ` at ${task.visitTime}` : ''}</p>}
                    </div>
                  )}
                  {task.sitePhotos && task.sitePhotos.length > 0 && (
                    <div className="bg-teal-50 rounded-xl px-4 py-3">
                      <MediaPreviewList files={task.sitePhotos} title={`Site Photos (${task.sitePhotos.length})`} />
                    </div>
                  )}
                  {task.measurementDetails && (
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Measurements</p>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{task.measurementDetails}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              5. SEND TO CLIENT — two-step: send → mark sent → client response
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'send_to_client' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Send} color="bg-indigo-50 border border-indigo-200 text-indigo-700"
                title="Waiting for Sales Team — Send Quotation"
                sub="Sales Team will send the approved quotation to the client and collect response" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team sends the quotation and records the client response."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}
          {displayStage === 'send_to_client' && (role === 'lead_manager' || demoOverride) && (
            <>
              {demoOverride && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">Override Active — Acting as Sales Team</p>
                  </div>
                  <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
                </div>
              )}
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

                      <MultiFileUploadField label="Quotation File" required accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
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

                      {(costSqft || costMaterial || costTransAmt) && (() => {
                        const sqft  = Number(costSqft) || 0
                        const matC  = Number(costMaterial) || 0
                        const prodC = sqft * productionRate
                        const instC = sqft * installationRate
                        const transC = Number(costTransAmt) || 0
                        const total = matC + prodC + instC + transC
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-slate-600">Material Cost</span>
                              <span className="text-sm font-extrabold text-slate-700">₹{matC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-blue-700">Production Cost <span className="font-normal text-blue-400">(₹{productionRate} × sq.ft)</span></span>
                              <span className="text-sm font-extrabold text-blue-700">₹{prodC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-violet-700">Installation Cost <span className="font-normal text-violet-400">(₹{installationRate} × sq.ft)</span></span>
                              <span className="text-sm font-extrabold text-violet-700">₹{instC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-amber-700">Transport Cost</span>
                              <span className="text-sm font-extrabold text-amber-700">₹{transC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-slate-100 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-bold text-slate-700">Total Costs</span>
                              <span className="text-sm font-extrabold text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        )
                      })()}

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
                      {(costSqft || costMaterial || costTransAmt) && (() => {
                        const sqft  = Number(costSqft) || 0
                        const matC  = Number(costMaterial) || 0
                        const prodC = sqft * productionRate
                        const instC = sqft * installationRate
                        const transC = Number(costTransAmt) || 0
                        const total = matC + prodC + instC + transC
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-slate-600">Material Cost</span>
                              <span className="text-sm font-extrabold text-slate-700">₹{matC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-blue-700">Production Cost <span className="font-normal text-blue-400">(₹{productionRate} × sq.ft)</span></span>
                              <span className="text-sm font-extrabold text-blue-700">₹{prodC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-violet-700">Installation Cost <span className="font-normal text-violet-400">(₹{installationRate} × sq.ft)</span></span>
                              <span className="text-sm font-extrabold text-violet-700">₹{instC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-semibold text-amber-700">Transport Cost</span>
                              <span className="text-sm font-extrabold text-amber-700">₹{transC.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between bg-slate-100 rounded-xl px-4 py-2.5">
                              <span className="text-xs font-bold text-slate-700">Total Costs</span>
                              <span className="text-sm font-extrabold text-slate-800">₹{total.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        )
                      })()}
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

                  {/* Step 1: Send buttons — hidden after client has already responded */}
                  {flowStatus !== 'waiting_response' && flowStatus !== 'client_approved' && (() => {
                    const clientName = task.clientName ?? 'Sir/Madam'
                    const projName   = project?.pendingConversion ? (task.clientName ?? 'your enquiry') : (task.projectName ?? 'your project')
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
                            <p className="text-[10px] font-bold text-violet-500 uppercase">Approved Quotation File</p>
                            <MediaPreviewList files={[task.quotationFile]} />
                          </div>
                        ) : (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
                            <p className="text-xs text-amber-700 font-semibold">No quotation file attached. Upload one in the Quotation step.</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => copyToClipboard('quotation_send', waMsg)}
                            className="py-4 rounded-2xl bg-slate-100 text-slate-700 text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                            {copiedKey === 'quotation_send' ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy to Clipboard</>}
                          </button>
                          <button type="button" onClick={handleShareToWhatsApp}
                            className="py-4 rounded-2xl bg-green-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                            <PhoneCall size={16} /> WhatsApp
                          </button>
                        </div>

                        <button type="button" onClick={() => setShowSentConfirm(true)}
                          className="w-full py-4 rounded-2xl bg-slate-800 text-white text-sm font-extrabold active:opacity-90">
                          ✓ Mark as Sent to Client
                        </button>

                        <Dialog
                          isOpen={showSentConfirm}
                          onClose={() => setShowSentConfirm(false)}
                          onConfirm={() => { setShowSentConfirm(false); save({ flowStatus: 'waiting_response', title: 'Waiting Client Response' }, 'Quotation sent to client — waiting for response') }}
                          title="Confirm Sent to Client"
                          message="Are you sure you've sent the quotation to the client?"
                          confirmLabel="Yes, Sent"
                        />
                      </>
                    )
                  })()}

                  {/* Step 2: Client response */}
                  {flowStatus === 'waiting_response' && (
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
                          {sel === 'client_approved' ? '✓ Mark Client Approved' : 'Mark Client Rejected'}
                        </button>
                      )}
                    </>
                  )}

                  {/* Step 3: Client approved — show advance payment form inline */}
                  {flowStatus === 'client_approved' && (
                    <>
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-700">Client Approved — Order Confirmed!</p>
                          <p className="text-[11px] text-emerald-600 mt-0.5">Collect advance payment below to proceed to production.</p>
                        </div>
                      </div>
                      {task.quotationAmount && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Project Value</p>
                          <p className="text-xl font-extrabold text-slate-800">₹{task.quotationAmount.toLocaleString('en-IN')}</p>
                        </div>
                      )}
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Advance Payment</p>
                      <Opt value="advance_paid" label="Advance Paid" sub="Client paid advance — start production" accent="border-emerald-200" sel={sel} onPick={pick} />
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
                            <label className={lbl}>Due Date {req}</label>
                            <input type="date" value={advDueDate} onChange={e => setAdvDueDate(e.target.value)} className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>Payment Note <span className="text-slate-300 font-normal">(optional)</span></label>
                            <textarea rows={2} value={advNote} onChange={e => setAdvNote(e.target.value)}
                              placeholder="Payment method, reference number…" className={`${inp} resize-none`} />
                          </div>
                          <MultiFileUploadField label="Payment Screenshot" accept=".jpg,.jpeg,.png,.webp,.pdf" files={advPayScreenshot} onChange={setAdvPayScreenshot} helperText="Optional — upload payment proof" />
                        </div>
                      )}
                      <AdvanceConvertBlock />
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              6. PRODUCTION ASSIGN — LM uploads job sheet to Admin
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'production_assign' && role !== 'lead_manager' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Package} color="bg-orange-50 border border-orange-200 text-orange-700"
              title="Waiting for Job Sheet"
              sub="Sales Team is preparing and sending the job sheet to Admin" />
          )}

          {/* CONTROL: Production Assign — owner sees Take Control */}
          {displayStage === 'production_assign' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Package} color="bg-orange-50 border border-orange-200 text-orange-700"
                title="Waiting for Job Sheet"
                sub="Sales Team is preparing and sending the job sheet to Admin" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team needs to upload and send the job sheet."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'production_assign' && (role === 'lead_manager' || demoOverride) && (
            <>
              {demoOverride && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">Override Active — Acting as Sales Team</p>
                  </div>
                  <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
                </div>
              )}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Send Job Sheet to Admin</p>

              <div className="space-y-2">
                <label className={lbl}>Job Sheet {req}</label>
                <MultiFileUploadField label="" accept=".pdf,application/pdf" uploadButtonLabel="Upload Job Sheet PDF"
                  files={jobSheetFiles} onChange={setJobSheetFiles} helperText="PDF only" />
                <p className="text-[11px] text-slate-400 text-center">— OR type job sheet details below —</p>
                <textarea rows={3} value={jobSheetText} onChange={e => setJobSheetText(e.target.value)}
                  placeholder="Type job sheet details: product specs, dimensions, quantities…"
                  className={`${inp} resize-none`} />
              </div>

              {productionAdminOptions.length > 0 && (
                <div>
                  <label className={lbl}>Assign to {PRODUCTION_ADMIN_LABEL} {req}</label>
                  <select value={jobSheetAssignee} onChange={e => setJobSheetAssignee(e.target.value)} className={inp}>
                    <option value="" disabled>Select {PRODUCTION_ADMIN_LABEL}</option>
                    {productionAdminOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {jobSheetAssignee && (
                    <p className="text-[11px] text-slate-400 mt-1">Project Incharge: {jobSheetAssignee}</p>
                  )}
                </div>
              )}

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

              {extraSheets.map((files, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className={lbl}>Additional Sheet {idx + 1}</label>
                    <button type="button" onClick={() => setExtraSheets(prev => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-red-400 underline">Remove</button>
                  </div>
                  <MultiFileUploadField label="" accept=".pdf,.jpg,.png,.xlsx,.doc,.docx"
                    files={files}
                    onChange={updated => setExtraSheets(prev => prev.map((f, i) => i === idx ? updated : f))} />
                </div>
              ))}

              <button type="button" onClick={() => setExtraSheets(prev => [...prev, []])}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 active:bg-slate-50">
                + Add More Files
              </button>

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
              7a. PRODUCTION CHECK — Admin
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'production_check' && (role === 'production_admin' || (role === 'owner' && demoOverride)) && flowStatus !== 'not_available' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Material Availability Check</p>

              {task.paidAmount != null && role === 'owner' && (
                <div className="bg-emerald-50 rounded-xl px-4 py-2.5">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Advance Received</p>
                  <p className="text-sm font-bold text-emerald-700">₹{task.paidAmount.toLocaleString('en-IN')}</p>
                </div>
              )}

              <div className="space-y-2">
                {availChecklist.map((item, idx) => {
                  const isOptional = item.id === 'glass' || item.id === 'hardware'
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
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'order',reason:'',dueDate:''}; setAvailChecklist(n) }}
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
                      {item.status === 'order' && (
                        <div>
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1 block">Expected Due Date {!isOptional && <span className="text-red-500">*</span>}</label>
                          <input type="date" value={item.dueDate ?? ''}
                            onChange={e => { const n=[...availChecklist]; n[idx]={...item,dueDate:e.target.value}; setAvailChecklist(n) }}
                            className="w-full text-xs bg-white border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {(() => {
                const mandatory = availChecklist.filter(i => i.id !== 'glass' && i.id !== 'hardware')
                const allMandOk = mandatory.every(i => i.status === 'available')
                return allMandOk ? (
                  <>
                    {productionManagerOptions.length > 0 && (
                      <div>
                        <label className={lbl}>Assign to Production Manager <span className="text-slate-300 font-normal">(optional)</span></label>
                        <select value={pmAssignee} onChange={e => setPmAssignee(e.target.value)} className={inp}>
                          <option value="">Any available Production Manager</option>
                          {productionManagerOptions.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button type="button" onClick={submitProductionCheck}
                      className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90">
                      ✓ Confirm — Start Production
                    </button>
                  </>
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
          {displayStage === 'production_check' && role !== 'production_admin' && role !== 'owner' && flowStatus !== 'not_available' && !demoOverride && (
            <WaitingView icon={Package} color="bg-amber-50 border border-amber-200 text-amber-700"
              title={flowStatus === 'materials_ordered'
                ? `Admin Ordered — Waiting for Delivery`
                : 'Checking Material Availability'}
              sub={flowStatus === 'materials_ordered'
                ? `Materials have been ordered. Production starts when they arrive.`
                : 'Admin is verifying Profile / Glass / Hardware stock'} />
          )}

          {/* CONTROL: Production Check — owner sees Take Control, LM sees Override */}
          {displayStage === 'production_check' && role === 'owner' && flowStatus !== 'not_available' && !demoOverride && (
            <>
              <WaitingView icon={Package} color="bg-amber-50 border border-amber-200 text-amber-700"
                title={flowStatus === 'materials_ordered' ? 'Admin Ordered — Waiting for Delivery' : 'Checking Material Availability'}
                sub={flowStatus === 'materials_ordered' ? 'Materials ordered. Production starts when they arrive.' : 'Admin is verifying Profile / Glass / Hardware stock'} />
              <DemoControlCard waitingFor="Admin" description="Admin needs to check material availability."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}
          {displayStage === 'production_check' && canDemoOverride && role !== 'owner' && flowStatus !== 'not_available' && !demoOverride && (
            <DemoControlCard
              waitingFor="Admin"
              description="Admin needs to check material availability (Profile/Glass/Hardware). For demo, confirm it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {displayStage === 'production_check' && canDemoOverride && role !== 'owner' && flowStatus !== 'not_available' && demoOverride && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Override Active — Acting as Admin</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Material Availability Check</p>
              <div className="space-y-2">
                {availChecklist.map((item, idx) => {
                  const isOptional = item.id === 'glass' || item.id === 'hardware'
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
                            onClick={() => { const n=[...availChecklist]; n[idx]={...item,status:'order',reason:'',dueDate:''}; setAvailChecklist(n) }}
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
                      {item.status === 'order' && (
                        <div>
                          <label className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1 block">Expected Due Date {!isOptional && <span className="text-red-500">*</span>}</label>
                          <input type="date" value={item.dueDate ?? ''}
                            onChange={e => { const n=[...availChecklist]; n[idx]={...item,dueDate:e.target.value}; setAvailChecklist(n) }}
                            className="w-full text-xs bg-white border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {(() => {
                const mandatory = availChecklist.filter(i => i.id !== 'glass' && i.id !== 'hardware')
                const allMandOk = mandatory.every(i => i.status !== 'not_available')
                return allMandOk ? (
                  <button type="button" onClick={submitDemoProductionCheck}
                    className="w-full py-4 rounded-2xl bg-amber-600 text-white text-sm font-extrabold active:opacity-90">
                    ✓ Confirm — Start Production (Override)
                  </button>
                ) : (
                  <button type="button" onClick={submitDemoProductionCheck}
                    className="w-full py-4 rounded-2xl bg-red-600 text-white text-sm font-extrabold active:opacity-90">
                    Report Not Available (Override)
                  </button>
                )
              })()}
            </div>
          )}

          {displayStage === 'production_check' && flowStatus === 'not_available' && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-2">
                <p className="text-xs font-bold text-red-600 uppercase">Materials Not Available</p>
                <p className="text-sm text-red-700">{task.notAvailableReason}</p>
                <p className="text-xs text-red-400">Admin reported unavailability.</p>
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sales Team Action</p>
              <Opt value="wait"      label="Wait for Stock"        sub="Keep status and wait for material arrival" accent="border-slate-200"   sel={notAvailLmAction} onPick={setNotAvailLmAction} />
              <Opt value="recheck"   label="Recheck Availability"  sub="Send back to Admin to recheck"              accent="border-amber-200"   sel={notAvailLmAction} onPick={setNotAvailLmAction} />
              <Opt value="restock"   label="Restock Availability"  sub="Log a restock request with expected date"   accent="border-orange-200"  sel={notAvailLmAction} onPick={setNotAvailLmAction} />

              {notAvailLmAction === 'restock' && (
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>Restock Notes {req}</label>
                    <textarea rows={3} value={notAvailNote} onChange={e => setNotAvailNote(e.target.value)}
                      placeholder="What's being restocked, supplier, quantity…" className={`${inp} resize-none`} />
                  </div>
                  <div>
                    <label className={lbl}>Expected Availability Date <span className="text-slate-300 font-normal">(optional)</span></label>
                    <input type="date" value={restockDate} onChange={e => setRestockDate(e.target.value)} className={inp} />
                  </div>
                  <button type="button" onClick={submitRestockAvailability}
                    className="w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 bg-orange-600">
                    Submit Restock Update
                  </button>
                </div>
              )}

              {notAvailLmAction === 'recheck' && (
                <div>
                  <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                  <textarea rows={2} value={notAvailNote} onChange={e => setNotAvailNote(e.target.value)}
                    placeholder="Anything Admin should know before rechecking…" className={`${inp} resize-none`} />
                </div>
              )}

              {(notAvailLmAction === 'wait' || notAvailLmAction === 'recheck') && (
                <button type="button" onClick={submitNotAvailLmAction}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${notAvailLmAction === 'recheck' ? 'bg-amber-600' : 'bg-slate-500'}`}>
                  {notAvailLmAction === 'wait' ? 'Keep Waiting' : 'Send Back to Admin'}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              8. ADVANCE PAYMENT — LM only
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'advance_payment' && role !== 'lead_manager' && role !== 'owner' && (
            <WaitingView icon={CreditCard} color="bg-emerald-50 border border-emerald-200 text-emerald-700"
              title="Waiting for Advance Payment"
              sub={flowStatus === 'pending' ? 'Sales Team collecting advance payment from client' : `Advance received — production starting soon`} />
          )}

          {displayStage === 'advance_payment' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={CreditCard} color="bg-emerald-50 border border-emerald-200 text-emerald-700"
                title="Waiting for Advance Payment"
                sub="Sales Team is collecting the advance payment from the client" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team collects and records the advance payment."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'advance_payment' && (role === 'lead_manager' || demoOverride) && (
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

              <Opt value="advance_paid" label="Advance Paid" sub="Client paid advance — start production" accent="border-emerald-200" sel={sel} onPick={pick} />
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
                    <label className={lbl}>Due Date {req}</label>
                    <input type="date" value={advDueDate} onChange={e => setAdvDueDate(e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Payment Note <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea rows={2} value={advNote} onChange={e => setAdvNote(e.target.value)}
                      placeholder="Payment method, reference number…" className={`${inp} resize-none`} />
                  </div>
                  <MultiFileUploadField label="Payment Screenshot" accept=".jpg,.jpeg,.png,.webp,.pdf" files={advPayScreenshot} onChange={setAdvPayScreenshot} helperText="Optional — upload payment proof" />
                </div>
              )}

              <AdvanceConvertBlock />
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              9a. PRODUCTION WORK — Production Manager (6-step checklist)
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'production_work' && (role === 'production_manager' || (role === 'owner' && demoOverride)) && flowStatus !== 'overdue' && flowStatus !== 'ready_to_pack' && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Production Checklist</p>

              {task.paidAmount != null && role === 'owner' && (
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

              {/* Material status from Admin check — editable by Production Manager */}
              {pmMaterialChecklist.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Material Status (from Admin)</p>
                  {pmMaterialChecklist.map((item, idx) => {
                    const base = item.available ? 'available' : item.ordered ? 'ordered' : 'not_available'
                    const current = item.overdue ? 'overdue' : base
                    const statusColor = current === 'overdue' ? 'border-red-300 text-red-700 bg-red-50'
                      : current === 'available' ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                      : current === 'ordered' ? 'border-amber-300 text-amber-700 bg-amber-50'
                      : 'border-red-300 text-red-700 bg-red-50'
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                        <select value={current}
                          onChange={e => {
                            const v = e.target.value
                            const n = [...pmMaterialChecklist]
                            if (v === 'overdue') n[idx] = { ...item, overdue: true }
                            else if (v === 'available') n[idx] = { ...item, available: true, ordered: false, overdue: false }
                            else n[idx] = { ...item, available: base === 'available', ordered: base === 'ordered', overdue: false }
                            setPmMaterialChecklist(n)
                          }}
                          className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border focus:outline-none ${statusColor}`}>
                          {base === 'not_available' && <option value="not_available">N/A</option>}
                          {base === 'ordered' && <option value="ordered">Ordered</option>}
                          {base === 'available' && <option value="available">Available</option>}
                          {base !== 'available' && <option value="available">{base === 'ordered' ? 'Received' : 'Available'}</option>}
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                    )
                  })}
                  {JSON.stringify(pmMaterialChecklist) !== JSON.stringify(task.availabilityChecklist ?? []) && (
                    <button type="button" onClick={submitMaterialStatusUpdate}
                      className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold active:opacity-90">
                      {pmMaterialChecklist.some(i => i.overdue) ? 'Send Overdue Status to Admin' : 'Save Material Status'}
                    </button>
                  )}
                </div>
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

          {displayStage === 'production_work' && role === 'production_manager' && flowStatus === 'overdue' && (
            <WaitingView icon={Clock} color="bg-red-50 border border-red-200 text-red-700"
              title="Overdue Report Submitted" sub="Waiting for Sales Team to update the schedule" />
          )}

          {/* 9b. PRODUCTION WORK — LM / other roles waiting / overdue update */}
          {displayStage === 'production_work' && role !== 'production_manager' && role !== 'owner' && flowStatus !== 'overdue' && flowStatus !== 'ready_to_pack' && !demoOverride && (
            <>
              <WaitingView icon={Package} color="bg-blue-50 border border-blue-200 text-blue-700"
                title="Production Work In Progress"
                sub={task.productionNewDate ? `Updated deadline: ${task.productionNewDate}` : 'Production Manager is working on it'} />
              {task.materialStatusOverdue && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  <p className="text-xs font-bold text-red-700">⚠ Material Overdue</p>
                  <p className="text-xs text-red-600 mt-0.5">{task.materialStatusNote ?? 'Production Manager reported a material issue — sent to Admin.'}</p>
                </div>
              )}
            </>
          )}

          {/* CONTROL: Production Work — owner sees Take Control, LM sees Override */}
          {displayStage === 'production_work' && role === 'owner' && flowStatus !== 'overdue' && flowStatus !== 'ready_to_pack' && !demoOverride && (
            <>
              <WaitingView icon={Package} color="bg-blue-50 border border-blue-200 text-blue-700"
                title="Production Work In Progress"
                sub={task.productionNewDate ? `Updated deadline: ${task.productionNewDate}` : 'Production Manager is working on it'} />
              <DemoControlCard waitingFor="Production Manager" description="Production Manager needs to complete the 6-step production checklist."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}
          {displayStage === 'production_work' && canDemoOverride && role !== 'owner' && flowStatus !== 'overdue' && flowStatus !== 'ready_to_pack' && !demoOverride && (
            <DemoControlCard
              waitingFor="Production Manager"
              description="Production Manager needs to complete all 6 production steps and mark Ready to Dispatch. For demo, complete it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}
          {displayStage === 'production_work' && canDemoOverride && role !== 'owner' && flowStatus !== 'overdue' && flowStatus !== 'ready_to_pack' && demoOverride && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Override Active — Acting as Production Manager</p>
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
                  <Package size={15} /> Assign to Dispatch (Override) →
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
                        Submit Overdue Report (Override)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {displayStage === 'production_work' && role === 'owner' && flowStatus === 'overdue' && !demoOverride && (
            <>
              <WaitingView icon={Clock} color="bg-red-50 border border-red-200 text-red-700"
                title="Overdue Report Submitted" sub="Waiting for Sales Team to approve or disapprove the new date" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team reviews the overdue report and sets the new production date."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'production_work' && (role === 'lead_manager' || demoOverride) && flowStatus === 'overdue' && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-1">
                <p className="text-xs font-bold text-red-600 uppercase">Production Overdue Report</p>
                <p className="text-sm text-red-700">{task.productionOverdueReason}</p>
                {task.productionNewDate && (
                  <p className="text-xs text-red-500 font-semibold">PM requested new date: {task.productionNewDate}</p>
                )}
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Approve or Disapprove</p>
              <Opt value="approve_overdue"    label="Approve New Date" sub="Accept PM's new expected date and continue production" accent="border-emerald-200" sel={sel} onPick={pick} />
              <Opt value="disapprove_overdue" label="Disapprove"       sub="Reject the delay — send back to PM with reason"       accent="border-red-200"     sel={sel} onPick={pick} />
              {sel === 'approve_overdue' && (
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>Confirmed Date {req}</label>
                    <input type="date" value={lmNewDate} onChange={e => setLmNewDate(e.target.value)} className={inp}
                      defaultValue={task.productionNewDate ?? ''} />
                  </div>
                  <div>
                    <label className={lbl}>Note <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea rows={2} value={lmNote} onChange={e => setLmNote(e.target.value)}
                      placeholder="Any instructions for the team…" className={`${inp} resize-none`} />
                  </div>
                  <button type="button" onClick={submitLmOverdueUpdate}
                    className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90">
                    ✓ Approve New Date &amp; Continue Production
                  </button>
                </div>
              )}
              {sel === 'disapprove_overdue' && (
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>Reason for Disapproval {req}</label>
                    <textarea rows={2} value={lmNote} onChange={e => setLmNote(e.target.value)}
                      placeholder="Why is the delay not accepted?" className={`${inp} border-red-200 resize-none focus:border-red-400`} />
                  </div>
                  <button type="button"
                    onClick={() => {
                      if (!lmNote.trim()) { setError('Add a reason for disapproving.'); return }
                      save({ flowStatus: 'in_progress', status: 'in_progress', note: `Overdue disapproved: ${lmNote}` },
                        `Overdue disapproved by ${user?.name ?? 'Sales Team'}: ${lmNote}`)
                    }}
                    className="w-full py-4 rounded-2xl bg-red-600 text-white text-sm font-extrabold active:opacity-90">
                    Send Back to Production Manager
                  </button>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              9c. READY TO PACK — LO confirms all materials before dispatch
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'production_work' && flowStatus === 'ready_to_pack' && role === 'production_manager' && (
            <WaitingView icon={Package} color="bg-emerald-50 border border-emerald-200 text-emerald-700"
              title="Sent to Sales Team for Packing Confirmation"
              sub="Waiting for Sales Team to confirm all materials are ready to pack" />
          )}

          {displayStage === 'production_work' && flowStatus === 'ready_to_pack' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Package} color="bg-emerald-50 border border-emerald-200 text-emerald-700"
                title="Production Done — Waiting for Sales Team to Pack"
                sub="Sales Team needs to confirm all items are packed and ready to dispatch" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team confirms the packing checklist and dispatches."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'production_work' && flowStatus === 'ready_to_pack' && (role === 'lead_manager' || demoOverride) && (
            <>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <Package size={14} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-700">Production Completed — Ready to Pack</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Tick each item as packed. Save progress anytime. Dispatch unlocks when all done.</p>
                </div>
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Packing Checklist</p>

              <div className="space-y-2">
                {packChecklist.map((item, idx) => (
                  <button key={item.id} type="button"
                    onClick={() => { const n = [...packChecklist]; n[idx] = { ...item, done: !item.done }; setPackChecklist(n) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${item.done ? 'bg-emerald-50 border-emerald-300' : 'border-slate-200 bg-white'}`}>
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${item.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                      {item.done && <CheckCircle2 size={11} className="text-white" />}
                    </div>
                    <p className={`text-sm font-semibold ${item.done ? 'text-emerald-700' : 'text-slate-800'}`}>{item.label}</p>
                    {item.done && <span className="ml-auto text-[10px] text-emerald-500 font-bold">✓</span>}
                  </button>
                ))}
              </div>

              {(() => {
                const doneCt = packChecklist.filter(i => i.done).length
                const pct = Math.round((doneCt / packChecklist.length) * 100)
                const allDone = doneCt === packChecklist.length
                return (
                  <>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-600">Packing Progress</span>
                        <span className="font-bold text-slate-800">{doneCt}/{packChecklist.length} · {pct}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {!allDone && doneCt > 0 && (
                      <button type="button" onClick={submitSavePackProgress}
                        className="w-full py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-extrabold active:opacity-90">
                        Save Progress ({doneCt}/{packChecklist.length} done)
                      </button>
                    )}
                    <button type="button" disabled={!allDone} onClick={submitReadyToDispatch}
                      className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2 ${allDone ? 'bg-rose-600' : 'bg-slate-200 text-slate-400'}`}>
                      <Package size={15} /> {allDone ? '✓ All Packed — Ready to Dispatch' : `Dispatch (${doneCt}/${packChecklist.length} done)`}
                    </button>
                  </>
                )
              })()}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              9b. DISPATCH ASSIGN — Lead Owner
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'dispatch_assign' && role !== 'lead_manager' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Package} color="bg-orange-50 border border-orange-200 text-orange-700"
              title="Ready to Dispatch"
              sub="Sales Team will assign this project for dispatch" />
          )}
          {displayStage === 'dispatch_assign' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Package} color="bg-orange-50 border border-orange-200 text-orange-700"
                title="Ready to Dispatch"
                sub="Sales Team needs to assign this project for dispatch" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team assigns the project for dispatch."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}
          {displayStage === 'dispatch_assign' && (role === 'lead_manager' || (role === 'owner' && demoOverride)) && (() => {
            const checklist = task.productionChecklist ?? []
            const doneCt = checklist.filter(i => i.done).length
            const pct = checklist.length > 0 ? Math.round((doneCt / checklist.length) * 100) : 0
            const allDone = checklist.length === 0 || doneCt === checklist.length
            const workEntry = [...(task.statusHistory ?? [])].reverse().find(h => h.stage === 'production_work' && h.status === 'completed')
            return (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Production Manager Status</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Production Manager</span>
                    <span className="font-semibold text-slate-700">{task.assignee || '—'}</span>
                  </div>
                  {checklist.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Checklist Progress</span>
                        <span className="font-bold text-slate-700">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="space-y-1 pt-1">
                        {checklist.map(item => (
                          <div key={item.id} className="flex items-center gap-1.5 text-[11px]">
                            <span className={item.done ? 'text-emerald-600' : 'text-slate-400'}>{item.done ? '✓' : '○'}</span>
                            <span className={item.done ? 'text-slate-600' : 'text-slate-400'}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                    <span className="text-slate-500">Ready to Dispatch</span>
                    <span className={`font-bold ${allDone ? 'text-emerald-600' : 'text-amber-600'}`}>{allDone ? 'Yes ✓' : 'Not yet'}</span>
                  </div>
                  {workEntry && (
                    <p className="text-[10px] text-slate-400">
                      Last updated {new Date(workEntry.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {task.productionOverdueReason && (
                    <p className="text-[11px] text-amber-600">Notes: {task.productionOverdueReason}</p>
                  )}
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-orange-600 flex-shrink-0" />
                    <p className="text-sm font-bold text-orange-700">Production Complete — Ready to Dispatch</p>
                  </div>
                  <p className="text-xs text-orange-600 pl-6">Send this project to Admin to check installation availability.</p>
                </div>

                {allDone ? (
                  <button type="button" onClick={submitAssignToDispatch}
                    className="w-full py-4 rounded-2xl bg-orange-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                    <Package size={15} /> Assign to Dispatch
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-red-600">Production is not fully completed yet.</p>
                  </div>
                )}
              </>
            )
          })()}

          {/* ═══════════════════════════════════════════════════════════════
              9c. ADMIN AVAILABILITY CHECK — Admin (production_admin)
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'admin_availability_check' && role !== 'production_admin' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Wrench} color="bg-amber-50 border border-amber-200 text-amber-700"
              title="Checking Installation Availability"
              sub="Admin is checking installation person availability" />
          )}
          {displayStage === 'admin_availability_check' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Wrench} color="bg-amber-50 border border-amber-200 text-amber-700"
                title="Checking Installation Availability"
                sub="Admin needs to check installation person availability and propose a person" />
              <DemoControlCard waitingFor="Admin" description="Admin checks installation availability and proposes a person."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}
          {displayStage === 'admin_availability_check' && (role === 'production_admin' || (role === 'owner' && demoOverride)) && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Check Installation Availability</p>
              <div>
                <label className={lbl}>Proposed Installation Technician / Person {req}</label>
                <select value={proposedInstPerson} onChange={e => setProposedInstPerson(e.target.value)} className={inp}>
                  <option value="">Select installation person…</option>
                  {installerOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Proposed Installation Date {req}</label>
                <input type="date" value={proposedInstDate} onChange={e => setProposedInstDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea rows={2} value={adminAvailNotes} onChange={e => setAdminAvailNotes(e.target.value)}
                  placeholder="Any notes for Site Engineer Lead…" className={`${inp} resize-none`} />
              </div>
              <button type="button" onClick={submitAdminAvailabilityCheck}
                className="w-full py-4 rounded-2xl bg-amber-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Need Site Engineer Lead Approval
              </button>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              9d. SITE ENGINEER LEAD APPROVAL
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'site_lead_approval' && role !== 'site_engineer_lead' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Wrench} color="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700"
              title="Waiting for Site Engineer Lead Approval"
              sub="Site Engineer Lead is reviewing the proposed installation person" />
          )}
          {displayStage === 'site_lead_approval' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Wrench} color="bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700"
                title="Waiting for Site Engineer Lead Approval"
                sub="Site Engineer Lead needs to approve or change the proposed installation person" />
              <DemoControlCard waitingFor="Site Engineer Lead" description="Site Engineer Lead approves or changes the proposed installation person."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}
          {displayStage === 'site_lead_approval' && (role === 'site_engineer_lead' || (role === 'owner' && demoOverride)) && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Project Summary</p>
              <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Project</span>
                  <span className="font-semibold text-slate-700">{task.projectName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Customer</span>
                  <span className="font-semibold text-slate-700">{task.clientName ?? '—'}</span>
                </div>
                {task.location && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Location</span>
                    <a href={task.locationPin?.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 font-semibold text-blue-600 underline">
                      <MapPin size={11} /> {task.location}
                    </a>
                  </div>
                )}
                <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">Status</span>
                  <span className="font-semibold text-emerald-600">Ready to Dispatch</span>
                </div>
              </div>

              <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-[10px] font-bold text-fuchsia-500 uppercase">Admin Proposal</p>
                <div className="flex justify-between text-xs">
                  <span className="text-fuchsia-600">Proposed Person</span>
                  <span className="font-bold text-fuchsia-800">{task.proposedInstallationPerson ?? '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-fuchsia-600">Proposed Date</span>
                  <span className="font-bold text-fuchsia-800">{task.proposedInstallationDate ?? '—'}</span>
                </div>
                {task.adminAvailabilityNotes && (
                  <p className="text-xs text-fuchsia-600 pt-1 border-t border-fuchsia-200">Notes: {task.adminAvailabilityNotes}</p>
                )}
              </div>

              {siteLeadAction === '' && (
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={submitSiteLeadAssignContinue}
                    className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90">
                    ✓ Assign and Continue
                  </button>
                  <button type="button" onClick={() => setSiteLeadAction('change')}
                    className="w-full py-4 rounded-2xl border-2 border-fuchsia-300 text-fuchsia-700 text-sm font-extrabold active:bg-fuchsia-50">
                    Change Person
                  </button>
                </div>
              )}

              {siteLeadAction === 'change' && (
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>Installation Person {req}</label>
                    <select value={changedInstPerson} onChange={e => setChangedInstPerson(e.target.value)} className={inp}>
                      <option value="">Select installation person…</option>
                      {installerOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Installation Date {req}</label>
                    <input type="date" value={changedInstDate} onChange={e => setChangedInstDate(e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea rows={2} value={changedInstNotes} onChange={e => setChangedInstNotes(e.target.value)}
                      placeholder="Reason for change…" className={`${inp} resize-none`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setSiteLeadAction('')}
                      className="w-full py-3.5 rounded-2xl border-2 border-slate-200 text-slate-500 text-sm font-bold active:bg-slate-50">
                      Cancel
                    </button>
                    <button type="button" onClick={submitSiteLeadChangePerson}
                      className="w-full py-3.5 rounded-2xl bg-fuchsia-600 text-white text-sm font-extrabold active:opacity-90">
                      Assign
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              10. INSTALLATION ASSIGN — LM only (legacy — pre dispatch-approval chain)
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'installation_assign' && role !== 'technician' && role !== 'installation_incharge' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Wrench} color="bg-rose-50 border border-rose-200 text-rose-700"
              title="Ready to Dispatch"
              sub="Installation Technician will assign the installer and schedule the date" />
          )}

          {/* CONTROL: Installation Assign — owner sees Take Control, others see Override */}
          {displayStage === 'installation_assign' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Wrench} color="bg-rose-50 border border-rose-200 text-rose-700"
                title="Ready to Dispatch"
                sub="Installation Technician will assign the installer and schedule the date" />
              <DemoControlCard waitingFor="Installation Technician" description="Installation Technician assigns the installer and date."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'installation_assign' && role !== 'technician' && role !== 'installation_incharge' && role !== 'owner' && !demoOverride && canDemoOverride && (
            <DemoControlCard
              waitingFor="Installation Technician"
              description="Installation Technician assigns the installer and date. For demo, do it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}

          {displayStage === 'installation_assign' && (role === 'technician' || role === 'installation_incharge' || demoOverride) && (
            <>
              {demoOverride && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-700">Override Active — Acting as Installation Technician</p>
                  </div>
                  <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
                </div>
              )}

              {/* Packing status summary from previous step */}
              {(() => {
                const saved = (task as Task & { packChecklist?: { id: string; label: string; done: boolean }[] }).packChecklist
                if (!saved?.length) return null
                const doneItems = saved.filter(i => i.done)
                const allDone = doneItems.length === saved.length
                return (
                  <div className={`rounded-xl px-4 py-2.5 space-y-1 ${allDone ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <p className={`text-[10px] font-bold uppercase ${allDone ? 'text-emerald-600' : 'text-amber-600'}`}>
                      Packing Status: {doneItems.length}/{saved.length} items
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {saved.map(i => (
                        <span key={i.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${i.done ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {i.done ? '✓' : '✗'} {i.label.split(' ').slice(0, 2).join(' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}

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
                onReplace={(oldId, url) => setVoiceNoteInstallationIds(prev => prev.map(x => x === oldId ? url : x))}
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
          {displayStage === 'installation_update' && flowStatus !== 'mistake' && flowStatus !== 'not_completed' && role !== 'technician' && role !== 'installation_incharge' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Wrench} color="bg-rose-50 border border-rose-200 text-rose-700"
              title={`Installation ${flowStatus === 'not_completed' ? 'Not Completed' : 'In Progress'}`}
              sub={task.installationPerson ? `Installer: ${task.installationPerson}${task.installationDate ? ` · ${task.installationDate}` : ''}` : 'Waiting for installation incharge to update'} />
          )}

          {/* CONTROL: Installation Update — owner sees Take Control, others see Override */}
          {displayStage === 'installation_update' && flowStatus !== 'mistake' && flowStatus !== 'not_completed' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Wrench} color="bg-rose-50 border border-rose-200 text-rose-700"
                title={`Installation ${flowStatus === 'not_completed' ? 'Not Completed' : 'In Progress'}`}
                sub={task.installationPerson ? `Installer: ${task.installationPerson}${task.installationDate ? ` · ${task.installationDate}` : ''}` : 'Waiting for installation incharge to update'} />
              <DemoControlCard waitingFor="Installation Technician" description="Installation Technician needs to report the installation result."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'installation_update' && flowStatus !== 'mistake' && flowStatus !== 'not_completed' && role !== 'technician' && role !== 'installation_incharge' && role !== 'owner' && !demoOverride && canDemoOverride && (
            <DemoControlCard
              waitingFor="Installation Technician"
              description="Installation Technician needs to report installation result. For demo, update it yourself."
              onOverride={() => setDemoOverride(true)}
            />
          )}

          {displayStage === 'installation_update' && flowStatus !== 'mistake' && flowStatus !== 'not_completed' && (role === 'technician' || role === 'installation_incharge' || demoOverride) && (
            <>{demoOverride && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Override Active — Acting as Installation Technician</p>
                </div>
                <button type="button" onClick={() => setDemoOverride(false)} className="text-xs text-slate-400 underline">Cancel</button>
              </div>
            )}</>
          )}

          {displayStage === 'installation_update' && flowStatus !== 'mistake' && flowStatus !== 'not_completed' && (role === 'technician' || role === 'installation_incharge' || demoOverride) && (
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

              {task.location && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-[10px] text-teal-500 font-bold uppercase">Site Location</p>
                  <p className="text-sm font-semibold text-teal-800">{task.location}</p>
                  <a href={task.locationPin?.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-teal-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold active:bg-teal-700 w-full min-h-[44px]">
                    <MapPin size={15} /> Open in Maps
                  </a>
                </div>
              )}

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Installation Result</p>

              <Opt value="completed"     label="Completed"     sub="Installation done successfully"         accent="border-emerald-200" sel={sel} onPick={pick} />
              <Opt value="not_completed" label="Not Completed" sub="Could not finish — rescheduling needed" accent="border-orange-200"  sel={sel} onPick={pick} />
              <Opt value="mistake"       label="Mistake"       sub="An issue occurred during installation"  accent="border-red-200"     sel={sel} onPick={pick} />

              {sel === 'not_completed' && (
                <div className="space-y-3">
                  <NoteWithFilesField label="Reason" required
                    noteValue={instNotCompNote} onNoteChange={setInstNotCompNote}
                    files={instNotCompFiles} onFilesChange={setInstNotCompFiles}
                    placeholder="Why couldn't the installation be completed?" />
                  <div>
                    <label className={lbl}>Next Visit Date {req}</label>
                    <input type="date" value={instNextVisitDate} onChange={e => setInstNextVisitDate(e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Notes <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea rows={2} value={instNotCompExtraNotes} onChange={e => setInstNotCompExtraNotes(e.target.value)}
                      placeholder="Any additional notes…" className={`${inp} resize-none`} />
                  </div>
                </div>
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
                    onReplace={(oldId, url) => setVoiceNoteInstallationIds(prev => prev.map(x => x === oldId ? url : x))}
                    helperText="Record a voice note about the mistake" />
                </div>
              )}

              {sel === 'completed' && (
                <div className="space-y-2">
                  <MultiFileUploadField
                    label="Installation Photos"
                    required
                    accept="image/*,.png,.jpg,.jpeg,.webp,.heic"
                    files={instCompletedPhotos}
                    onChange={setInstCompletedPhotos}
                    helperText="Upload at least 1 photo to confirm installation" />
                </div>
              )}

              {sel && (
                <button type="button" onClick={submitInstallationUpdate}
                  disabled={sel === 'completed' && instCompletedPhotos.length === 0}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 disabled:opacity-40 ${sel === 'completed' ? 'bg-emerald-600' : sel === 'mistake' ? 'bg-red-600' : 'bg-orange-500'}`}>
                  {sel === 'completed' ? '✓ Installation Completed — Collect Payment' : sel === 'mistake' ? 'Save Mistake' : 'Mark Not Completed'}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              11b. INSTALLATION MISTAKE REVIEW — LM
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'installation_update' && (flowStatus === 'mistake' || flowStatus === 'not_completed') && role !== 'lead_manager' && role !== 'owner' && !demoOverride && (
            <WaitingView icon={Wrench} color="bg-red-50 border border-red-200 text-red-700"
              title={flowStatus === 'not_completed' ? 'Installation Not Completed' : 'Installation Mistake Reported'}
              sub="Waiting for Sales Team to review and decide next steps" />
          )}

          {displayStage === 'installation_update' && (flowStatus === 'mistake' || flowStatus === 'not_completed') && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={Wrench} color="bg-red-50 border border-red-200 text-red-700"
                title={flowStatus === 'not_completed' ? 'Installation Not Completed' : 'Installation Mistake Reported'}
                sub="Sales Team needs to review and decide next steps" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team reviews the installation issue and decides next steps."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'installation_update' && (flowStatus === 'mistake' || flowStatus === 'not_completed') && (role === 'lead_manager' || demoOverride) && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-4 space-y-2">
                <p className="text-xs font-bold text-red-600 uppercase">
                  {flowStatus === 'not_completed' ? 'Installation Not Completed' : 'Installation Mistake Reported'}
                </p>
                {task.installationMistakeDetails && (
                  <p className="text-sm text-red-700">{task.installationMistakeDetails}</p>
                )}
                {flowStatus === 'not_completed' && task.installationNextVisitDate && (
                  <p className="text-xs font-semibold text-red-600">Next Visit Date: {task.installationNextVisitDate}</p>
                )}
                {task.note && (
                  <p className="text-xs text-red-500">Notes: {task.note}</p>
                )}
                {task.installationPerson && (
                  <p className="text-xs text-red-400">Reported by installer: {task.installationPerson}</p>
                )}
              </div>

              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Review Action</p>

              <Opt value="send_back_prod_admin"    label="Send Back to Production Admin"    sub="Material or profile issue — recheck availability"   accent="border-amber-200"  sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />
              <Opt value="send_back_prod_manager"  label="Send Back to Production Manager"  sub="Rework required — send back to production"           accent="border-orange-200" sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />
              <Opt value="reassign_installation"   label="Reassign Installation"            sub="Send new installation team"                          accent="border-blue-200"   sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />
              <Opt value="mark_resolved"           label="Mark Resolved"                    sub="Issue is resolved — proceed to final payment"        accent="border-emerald-200" sel={instMistakeReviewAction} onPick={setInstMistakeReviewAction} />

              {instMistakeReviewAction && (
                <button type="button" onClick={submitInstallationMistakeReview}
                  className={`w-full py-4 rounded-2xl text-white text-sm font-extrabold active:opacity-90 ${instMistakeReviewAction === 'mark_resolved' ? 'bg-emerald-600' : instMistakeReviewAction === 'reassign_installation' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                  {instMistakeReviewAction === 'send_back_prod_admin' ? 'Send to Production Admin' :
                   instMistakeReviewAction === 'send_back_prod_manager' ? 'Send to Production Manager' :
                   instMistakeReviewAction === 'reassign_installation' ? 'Reassign Installation' :
                   '✓ Mark Resolved — Proceed to Payment'}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              12. FINAL PAYMENT — collect balance; Complete Project only when balance = 0
          ════════════════════════════════════════════════════════════════ */}
          {displayStage === 'final_payment' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={CreditCard} color="bg-emerald-50 border border-emerald-200 text-emerald-700"
                title="Waiting for Final Payment Collection"
                sub="Sales Team is collecting the balance payment from the client" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team collects the final balance payment."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'final_payment' && (role === 'lead_manager' || demoOverride) && (
            <>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Project Payment Details</p>

              {(() => {
                const total   = task.quotationAmount ?? 0
                const paid    = task.paidAmount ?? 0
                const balance = task.balanceAmount != null ? task.balanceAmount : Math.max(0, total - paid)
                const allPaid = balance <= 0

                const totalExpenses = [actualMaterial, actualProduction, actualInstallation, actualTransport]
                  .reduce((s, v) => s + (Number(v) || 0), 0)
                const extraCharge  = Number(extraChargeAmt) || 0
                const totalRevenue = total + extraCharge
                const profit       = totalRevenue - totalExpenses
                const profitPct    = totalRevenue > 0 ? (profit / totalRevenue * 100) : 0

                const expensesAndCompletion = (
                  <>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actual Project Expenses</p>
                    {([
                      { label: 'Material Cost (₹)',     val: actualMaterial,     set: setActualMaterial     },
                      { label: 'Production Cost (₹)',   val: actualProduction,   set: setActualProduction   },
                      { label: 'Installation Cost (₹)', val: actualInstallation, set: setActualInstallation },
                      { label: 'Transport Cost (₹)',    val: actualTransport,    set: setActualTransport    },
                    ]).map(({ label, val, set }) => (
                      <div key={label}>
                        <label className={lbl}>{label} <span className="text-slate-300 font-normal">(optional)</span></label>
                        <input type="text" inputMode="numeric" value={val}
                          onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="0" className={inp} />
                      </div>
                    ))}
                    {/* Extra Cost — mandatory, visible to MD/ED/Admin/LO */}
                    {(role === 'owner' || role === 'lead_manager') && (
                      <div>
                        <label className={lbl}>Extra Cost (₹) {req}</label>
                        <input type="text" inputMode="numeric" value={extraChargeAmt}
                          onChange={e => setExtraChargeAmt(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="0 (enter 0 if no additional work was done)" className={inp} />
                        {extraChargeAmt.trim() !== '' && (
                          <p className="text-xs font-semibold text-blue-700 mt-1.5">
                            Extra Cost: ₹{extraCharge.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    )}

                    {totalExpenses > 0 && (
                      <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                        {role === 'owner' && (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Project Value</span>
                              <span className="font-semibold text-slate-700">₹{total.toLocaleString('en-IN')}</span>
                            </div>
                            {extraCharge > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-blue-500">Extra Charge</span>
                                <span className="font-semibold text-blue-700">+₹{extraCharge.toLocaleString('en-IN')}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs border-t border-slate-200 pt-1">
                              <span className="text-slate-600 font-semibold">Total Revenue</span>
                              <span className="font-bold text-slate-800">₹{totalRevenue.toLocaleString('en-IN')}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Total Expenses</span>
                          <span className="font-bold text-slate-700">₹{totalExpenses.toLocaleString('en-IN')}</span>
                        </div>
                        {role === 'owner' && total > 0 && (
                          <div className={`flex justify-between text-sm border-t border-slate-200 pt-1.5 mt-0.5 rounded-xl px-2 py-1.5 ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <span className={`font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{profit >= 0 ? 'Profit' : 'Loss'}</span>
                            <span className={`font-extrabold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                              ₹{Math.abs(profit).toLocaleString('en-IN')}
                              <span className="text-xs font-normal opacity-70"> ({profitPct.toFixed(1)}%)</span>
                            </span>
                          </div>
                        )}
                        {role !== 'owner' && canSeeProfit && total > 0 && (
                          <div className="flex justify-between text-xs border-t border-slate-200 pt-1.5">
                            <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>Profit</span>
                            <span className={`font-extrabold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{profit.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )

                return (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600">Total Project Value</span>
                        <span className="font-bold text-green-700">₹{total.toLocaleString('en-IN')}</span>
                      </div>
                      {paid > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-600">Total Paid</span>
                          <span className="font-bold text-emerald-700">₹{paid.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className={`flex justify-between text-sm border-t border-green-200 pt-1.5`}>
                        <span className={`font-extrabold ${allPaid ? 'text-emerald-700' : 'text-red-600'}`}>{allPaid ? 'Fully Paid ✓' : 'Balance Due'}</span>
                        <span className={`font-extrabold ${allPaid ? 'text-emerald-700' : 'text-red-600'}`}>{allPaid ? 'Nil' : `₹${balance.toLocaleString('en-IN')}`}</span>
                      </div>
                    </div>

                    {!allPaid && (
                      <div className="space-y-3">
                        <Opt value="partial_paid" label="Partial Paid" sub="Enter the amount received now" accent="border-amber-200" sel={sel} onPick={pick} />
                        <Opt value="full_paid"    label="Balance Paid" sub="Full remaining balance received" accent="border-green-200" sel={sel} onPick={pick} />

                        {sel === 'partial_paid' && (
                          <div>
                            <label className={lbl}>Amount Received (₹) {req}</label>
                            <input type="text" inputMode="numeric" value={finalPaidAmt}
                              onChange={e => setFinalPaidAmt(e.target.value.replace(/[^0-9]/g, ''))}
                              placeholder="e.g. 20000" className={inp} />
                          </div>
                        )}
                        {sel === 'full_paid' && (
                          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                            <span className="text-xs text-slate-500">Balance to be Paid</span>
                            <span className="text-sm font-bold text-slate-700">₹{balance.toLocaleString('en-IN')}</span>
                          </div>
                        )}

                        {sel === 'partial_paid' && (
                          <>
                            <MultiFileUploadField
                              label="Payment Screenshot"
                              accept=".jpg,.jpeg,.png,.webp,.pdf"
                              files={finalPayScreenshot}
                              onChange={setFinalPayScreenshot}
                              helperText="Upload payment proof / bank screenshot (optional)" />
                            <button type="button"
                              onClick={() => {
                                const amt = Number(finalPaidAmt) || 0
                                if (amt <= 0) { setError('Enter the amount received.'); return }
                                const totalPaid = paid + amt
                                const newBalance = Math.max(0, total - totalPaid)
                                save({
                                  paidAmount: totalPaid,
                                  balanceAmount: newBalance,
                                  flowStatus: newBalance <= 0 ? 'full_paid' : 'partial_paid',
                                  finalPaymentScreenshot: finalPayScreenshot.length > 0 ? finalPayScreenshot : undefined,
                                }, `Partial payment ₹${amt.toLocaleString('en-IN')} received`, finalPayScreenshot)
                              }}
                              className="w-full py-4 rounded-2xl bg-green-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                              <CreditCard size={15} /> Record Partial Payment
                            </button>
                          </>
                        )}

                        {sel === 'full_paid' && (
                          <>
                            <MultiFileUploadField
                              label="Payment Screenshot"
                              accept=".jpg,.jpeg,.png,.webp,.pdf"
                              files={finalPayScreenshot}
                              onChange={setFinalPayScreenshot}
                              helperText="Upload payment proof / bank screenshot (optional)" />
                            {expensesAndCompletion}
                            <button type="button"
                              onClick={() => completeProjectWithPayment(paid + balance, 0, `Payment ₹${balance.toLocaleString('en-IN')} received — fully paid`)}
                              className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                              <CheckCircle2 size={15} /> Complete Project
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {allPaid && (
                      <>
                        {expensesAndCompletion}
                        <button type="button"
                          onClick={() => completeProjectWithPayment(paid, 0, 'Final balance already settled')}
                          className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                          <CheckCircle2 size={15} /> Complete Project
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
          {displayStage === 'final_completion' && role === 'owner' && !demoOverride && (
            <>
              <WaitingView icon={CheckCircle2} color="bg-green-50 border border-green-200 text-green-700"
                title="Waiting for Sales Team to Complete Project"
                sub="Sales Team confirms final handover and marks the project as complete" />
              <DemoControlCard waitingFor="Sales Team (LO)" description="Sales Team marks the final handover and completes the project."
                onOverride={() => setDemoOverride(true)} variant="owner" />
            </>
          )}

          {displayStage === 'final_completion' && (role === 'lead_manager' || demoOverride) && (
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
                { label: 'Material Cost (₹)',    val: actualMaterial,     set: setActualMaterial,     required: false },
                { label: 'Production Cost (₹)',  val: actualProduction,   set: setActualProduction,   required: false },
                { label: 'Installation Cost (₹)',val: actualInstallation, set: setActualInstallation, required: false },
                { label: 'Transport Cost (₹)',   val: actualTransport,    set: setActualTransport,    required: false },
                { label: 'Other Costs (₹)',      val: actualOther,        set: setActualOther,        required: true  },
              ].map(({ label, val, set, required }) => (
                <div key={label}>
                  <label className={lbl}>{label} {required ? req : <span className="text-slate-300 font-normal">(optional)</span>}</label>
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
                  if (!actualOther.trim()) { setError('Enter Other Costs (enter 0 if none).'); return }
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
          {displayStage === 'completed' && (
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
                const reviewLink = 'https://maps.app.goo.gl/SRqthqnsFTo5UdHL9'
                const msg = `Hello ${clientName},\nThank you for choosing Fenster.\n\nWe would be happy if you could share your experience with us by leaving a Google review:\n${reviewLink}\n\nRegards,\nFenster Team`
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button"
                      onClick={() => copyToClipboard('google_review', msg)}
                      className="py-4 rounded-2xl bg-slate-100 text-slate-700 text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                      {copiedKey === 'google_review' ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy to Clipboard</>}
                    </button>
                    <button type="button"
                      onClick={() => {
                        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                        save({}, 'Google review link sent to client.')
                      }}
                      className="py-4 rounded-2xl bg-amber-500 text-white text-sm font-extrabold active:opacity-90 flex items-center justify-center gap-2">
                      ⭐ Send via WhatsApp
                    </button>
                  </div>
                )
              })()}
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

      {/* ── Loss Warning Confirmation ── */}
      {showLossWarn && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <p className="text-red-600 font-extrabold text-base">Running at a Loss</p>
            </div>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              The total estimated cost exceeds the quotation amount. This project will run at a loss.
              Are you sure you want to proceed?
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowLossWarn(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 active:bg-slate-50">
                Go Back
              </button>
              <button type="button" onClick={() => {
                setShowLossWarn(false)
                lossConfirmCb.current?.()
                lossConfirmCb.current = null
              }}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-extrabold active:bg-red-700">
                Proceed Anyway
              </button>
            </div>
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
