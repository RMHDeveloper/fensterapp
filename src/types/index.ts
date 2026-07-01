// ─── Auth & Roles ─────────────────────────────────────────────────────────────
export type UserRole =
  | 'owner'
  | 'lead_manager'
  | 'site_engineer'
  | 'production_admin'
  | 'production_manager'
  | 'technician'
  | 'viewer'
  | 'production_team'        // legacy alias kept for backward compat
  | 'installation_incharge'  // legacy alias — maps to technician

export type Permission =
  | 'view_home'
  | 'view_today'
  | 'view_projects'
  | 'create_project'
  | 'edit_project'
  | 'view_leads'
  | 'create_lead'
  | 'edit_lead'
  | 'view_site_visit'
  | 'update_site_visit'
  | 'view_quotation'
  | 'create_quotation'
  | 'send_quotation_for_approval'
  | 'approve_quotation'
  | 'reject_quotation'
  | 'view_production'
  | 'update_production'
  | 'view_delivery_qc'
  | 'update_qc'
  | 'view_mistakes'
  | 'create_mistake'
  | 'view_payments'
  | 'update_payments'
  | 'view_orders'
  | 'view_files'
  | 'upload_files'
  | 'view_reports'
  | 'view_settings'
  | 'manage_users'
  | 'approve_work'
  | 'delete_data'
  | 'view_installation'
  | 'update_installation'
  | 'view_profit'

export interface AuthUser {
  id: string
  name: string
  role: UserRole
  initials: string
  email: string
  displayRole?: string   // set for managed users; undefined for built-in demo accounts
  photo?: string         // Hostinger URL or dataUrl
}

// ─── Project Stage — overall project lifecycle ─────────────────────────────────
export type ProjectStage =
  | 'new_project'
  | 'measurement'
  | 'site_visit_assigned'
  | 'site_visit_completed'
  | 'quotation_preparation'
  | 'quotation_sent_owner'
  | 'owner_disapproved'
  | 'owner_approved'
  | 'sent_to_client'
  | 'client_approved'
  | 'negotiation'
  | 'advance_payment'
  | 'production_admin_check'
  | 'production_manager_work'
  | 'ready_to_dispatch'
  | 'installation'
  | 'final_payment'
  | 'completed'

export const PROJECT_STAGE_LABEL: Record<ProjectStage, string> = {
  new_project:            'New Project',
  measurement:            'Measurement',
  site_visit_assigned:    'Site Visit Assigned',
  site_visit_completed:   'Site Visit Completed',
  quotation_preparation:  'Quotation Preparation',
  quotation_sent_owner:   'Sent for Owner Approval',
  owner_disapproved:      'Owner Disapproved',
  owner_approved:         'Owner Approved',
  sent_to_client:         'Sent to Client',
  client_approved:        'Client Approved',
  negotiation:            'Negotiation',
  advance_payment:        'Advance Payment',
  production_admin_check: 'Production Check',
  production_manager_work:'Production Work',
  ready_to_dispatch:      'Ready to Dispatch',
  installation:           'Installation',
  final_payment:          'Final Payment',
  completed:              'Completed',
}

// Progress percentage for each project stage
export const PROJECT_STAGE_PROGRESS: Record<ProjectStage, number> = {
  new_project:            5,
  measurement:            10,
  site_visit_assigned:    15,
  site_visit_completed:   20,
  quotation_preparation:  25,
  quotation_sent_owner:   30,
  owner_disapproved:      30,
  owner_approved:         40,
  sent_to_client:         45,
  client_approved:        50,
  negotiation:            48,
  advance_payment:        55,
  production_admin_check: 60,
  production_manager_work:65,
  ready_to_dispatch:      80,
  installation:           85,
  final_payment:          90,
  completed:              100,
}

// ─── Proof Types ───────────────────────────────────────────────────────────────
export type ProofType =
  | 'none'
  | 'site_photo'
  | 'measurement_photo'
  | 'production_photo'
  | 'quotation_details'
  | 'approval_action'

// ─── Status Types ──────────────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type ProjectStatus = 'new' | 'active' | 'on_hold' | 'completed' | 'cancelled'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
export type QuotationStatus = 'draft' | 'waiting_approval' | 'approved' | 'rejected' | 'sent_to_client' | 'converted' | 'lost'
export type OrderStatus = 'confirmed' | 'in_production' | 'dispatched' | 'delivered' | 'cancelled'
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue'
export type ProductionStage = 'cutting' | 'routing' | 'welding' | 'assembly' | 'glazing' | 'packing' | 'dispatch_ready'
export type MistakeStatus = 'open' | 'in_progress' | 'rework' | 'resolved'
export type InstallationStatus = 'scheduled' | 'in_progress' | 'completed' | 'rescheduled'
export type FileCategory = 'site_photo' | 'quotation' | 'job_sheet' | 'qc_photo' | 'cutting_sheet' | 'glass_sheet' | 'proof' | 'voice_note' | 'other'
export type LeadSource = 'cold_call' | 'referral' | 'walk_in' | 'online' | 'whatsapp' | 'instagram' | 'facebook' | 'existing_customer' | 'other'

// ─── Flow Stage — per-task active workflow step ────────────────────────────────
export type FlowStage =
  | 'site_assign'          // LM assigns site engineer
  | 'site_visit'           // SE does site visit
  | 'reschedule_review'    // LM reviews SE reschedule request
  | 'site_review'          // LM reviews + creates quotation + sends to Owner
  | 'owner_approval'       // Owner approves or rejects quotation
  | 'send_to_client'       // LM sends approved quotation to client
  | 'production_assign'    // LM assigns to production with sheets
  | 'production_check'     // Production Admin checks material availability
  | 'advance_payment'      // LM collects advance payment
  | 'production_work'      // Production Manager does production work
  | 'installation_assign'  // LM assigns installation incharge
  | 'installation_update'  // Installation Incharge marks result
  | 'final_payment'        // LM collects final payment
  | 'final_completion'     // After full paid — complete project
  | 'completed'            // Project finished

// ─── Cost Breakdown ────────────────────────────────────────────────────────────
export interface CostBreakdown {
  quotationAmount: number
  numberOfSqft?: number
  materialCost: number
  productionCost: number
  installationCost: number
  transportCost: number
  profit?: number     // visible to Owner only — never show to other roles
}

// ─── File Attachment (enriched, supports preview) ──────────────────────────────
export interface FileAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize?: number
  category: FileCategory
  uploadedBy: string
  uploadedRole: string
  uploadedAt: string
  previewUrl?: string    // object URL valid for current session only
  description?: string
}

// ─── Voice Note ────────────────────────────────────────────────────────────────
export interface VoiceNote {
  id: string
  fileName: string
  fileType: string
  durationSeconds?: number
  uploadedBy: string
  uploadedRole: string
  uploadedAt: string
  previewUrl?: string
  noteType: 'production' | 'installation' | 'general'
}

// ─── Production Admin checklist ─────────────────────────────────────────────────
export interface AvailabilityCheckItem {
  id: string
  label: string
  available: boolean
  ordered?: boolean
  notAvailableReason?: string
}

// ─── Production Manager checklist ───────────────────────────────────────────────
export interface ProductionCheckItem {
  id: string
  label: string
  done: boolean
  doneAt?: string
  doneBy?: string
}

export const DEFAULT_AVAILABILITY_CHECKLIST: Omit<AvailabilityCheckItem, 'available'>[] = [
  { id: 'avail_profile',  label: 'Profile'   },
  { id: 'avail_glass',    label: 'Glass'     },
  { id: 'avail_hardware', label: 'Hardware'  },
]

export const DEFAULT_PRODUCTION_CHECKLIST: Omit<ProductionCheckItem, 'done'>[] = [
  { id: 'prod_cutting',    label: 'Profile Cutting' },
  { id: 'prod_routing',    label: 'Routing'         },
  { id: 'prod_steel',      label: 'Steel'           },
  { id: 'prod_welding',    label: 'Welding'         },
  { id: 'prod_assembling', label: 'Assembling'      },
  { id: 'prod_glazing',    label: 'Glazing'         },
]

// ─── Location Pin ──────────────────────────────────────────────────────────────
export interface LocationPin {
  latitude: string
  longitude: string
  mapLink: string
  label?: string
}

// ─── Status History ────────────────────────────────────────────────────────────
export interface StatusHistoryItem {
  id?: string
  stage: FlowStage
  status: string
  note?: string
  reason?: string
  files?: string[]
  updatedBy: string
  updatedRole: string
  updatedAt: string
}

// ─── Checklist (generic) ───────────────────────────────────────────────────────
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  dueDate: string
  dueTime?: string
  assignee: string
  projectId: string
  projectName: string
  customer?: string
  location?: string
  type: 'site_visit' | 'qc_check' | 'production' | 'payment' | 'delivery' | 'call' | 'other'
  description?: string
  checklistItems?: ChecklistItem[]
  tags?: string[]
  createdAt: string

  // Role ownership
  roleOwner?: UserRole

  // Proof / completion validation
  requiredProofType?: ProofType
  proofUploads?: string[]
  note?: string

  // Enriched files and media
  files?: FileAttachment[]
  photoFiles?: FileAttachment[]
  voiceNotes?: VoiceNote[]

  // Cost breakdown (production / installation stages)
  costBreakdown?: CostBreakdown

  // Production checklists
  productionChecklist?: ProductionCheckItem[]
  availabilityChecklist?: AvailabilityCheckItem[]

  // Workflow fields
  taskKind?: 'work' | 'followup'
  workerName?: string
  workerRole?: string
  workflowStep?: string
  measurementDetails?: string
  quotationProductType?: string
  quotationQuantity?: number
  labourName?: string

  // ── Demo Flow fields ────────────────────────────────────────────────────────
  flowStage?: FlowStage
  flowStatus?: string
  clientName?: string
  clientRequirement?: string
  clientPhone?: string
  clientEmail?: string

  // Site assignment
  siteEngineerName?: string
  visitDate?: string
  visitTime?: string

  // Site visit completion
  sitePhotos?: string[]
  measurementFiles?: string[]
  measurementType?: string
  locationPin?: LocationPin
  rescheduleDate?: string
  rescheduleTime?: string
  rescheduleReason?: string
  specialNoteProduction?: string[]
  specialNoteInstallation?: string[]

  // Quotation
  quotationAmount?: number
  quotationFile?: string
  quotationNotes?: string
  ownerRejectionReason?: string
  clientRejectionReason?: string

  // Production assignment
  jobSheet?: string
  jobSheetDetails?: string
  glassSheet?: string
  cuttingSheet?: string
  productionSheetNote?: string
  additionalDocs?: string[]     // extra documents in job sheet stage

  // Production check
  notAvailableReason?: string

  // Payment (advance + final)
  advancePaymentType?: string
  paidAmount?: number
  balanceAmount?: number
  paymentNote?: string
  advancePaymentScreenshot?: string[]  // screenshots of advance payment

  // Production work
  productionOverdueReason?: string
  productionNewDate?: string

  // Installation
  installationPerson?: string
  installationDate?: string
  installationFiles?: string[]
  installationNote?: string
  productCost?: number
  installationCost?: number
  materialCost?: number
  transportCost?: number
  installationMistakeDetails?: string

  // Reschedule approval flow
  requestedVisitDate?: string
  requestedVisitTime?: string
  rescheduleApprovalStatus?: 'pending' | 'approved' | 'rejected'
  rescheduleApprovedBy?: string
  rescheduleApprovalNote?: string
  linkedSiteTaskId?: string

  // Activity history
  statusHistory?: StatusHistoryItem[]

  // Assignment tracking
  assignedTo?: string
  assignedRole?: string
  assignedBy?: string
  assignedByRole?: string
  assignedAt?: string

  // Legacy compat
  sitePhoto?: string
  measurementPhoto?: string
  productionPerson?: string
  assignedPerson?: string
  workDate?: string
  mistakeDetails?: string
  disapprovedReason?: string
}

// ─── Project ──────────────────────────────────────────────────────────────────
export interface Project {
  id: string
  number: string
  name: string
  // Client info
  client: string            // display name
  customerName?: string     // same as client — used in new project form
  clientPhone: string
  clientEmail?: string
  // Project details
  requirement?: string      // what the client wants
  location?: string         // full address / area
  budgetOptional?: string   // optional budget (may be empty)
  // Status
  status: ProjectStatus
  currentStage?: ProjectStage   // typed lifecycle stage
  progress: number
  pendingTasks: number
  stage: string             // human-readable stage label
  // Dates & value
  dueDate: string
  startDate?: string
  value: number
  createdAt: string
  // Location (legacy)
  city: string
  productType: string
  // Linked data
  taskIds?: string[]
  notes?: string[]
  files?: FileAttachment[]
  voiceNotes?: VoiceNote[]
  costBreakdown?: CostBreakdown
  quotationAmount?: number         // cache of costBreakdown.quotationAmount for easy access
  // Payment
  paymentStatus?: string
  // Completion tracking
  isCompleted?: boolean
  completedAt?: string
  actualCompletedDate?: string     // set when project is marked completed
  workflowStatus?: string
  updatedAt?: string
  // Optional extras
  description?: string
  teamMembers?: string[]
  leadFrom?: string
  // Ownership
  ownerId?: string       // user.id of the lead_manager who owns this project
  ownerName?: string     // display name of the owner
  // Actual costs (entered by LO before completion)
  actualCosts?: CostBreakdown
  spentCost?: number     // running total of extra mistake costs
}

// ─── Approval ─────────────────────────────────────────────────────────────────
export interface Approval {
  id: string
  title: string
  meta: string
  icon: string
  type: 'invoice' | 'pto' | 'expense' | 'other'
}

// ─── Lead ─────────────────────────────────────────────────────────────────────
export type LeadInterest = 'hot' | 'medium' | 'cold'

export interface Lead {
  id: string
  name: string
  phone: string
  email?: string
  requirement: string
  source: LeadSource
  status: LeadStatus
  followUpDate: string
  priority: Priority
  interest?: LeadInterest
  lostReason?: string
  lastContact?: string
  notes?: string
  assignee: string
  city: string
  location?: string
  budgetRange?: string
  createdAt?: string
}

// ─── Quotation ────────────────────────────────────────────────────────────────
export interface Quotation {
  id: string
  quotationNumber: string
  clientName: string
  projectId: string
  projectName: string
  productType: string
  totalAmount: number
  status: QuotationStatus
  createdAt: string
  validityDate?: string
  preparedBy: string
}

// ─── Order ────────────────────────────────────────────────────────────────────
export interface OrderItem {
  id: string
  description: string
  quantity: number
  unit: string
  rate: number
  amount: number
}

export interface Order {
  id: string
  orderNumber: string
  clientName: string
  clientPhone: string
  projectId: string
  projectName: string
  items: OrderItem[]
  orderValue: number
  advanceAmount: number
  balanceAmount: number
  status: OrderStatus
  expectedDelivery: string
  confirmedAt: string
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export interface PaymentHistory {
  id: string
  amount: number
  date: string
  method: string
  reference?: string
}

export interface Payment {
  id: string
  projectId: string
  projectName: string
  clientName: string
  clientPhone: string
  totalAmount: number
  received: number
  pending: number
  status: PaymentStatus
  dueDate: string
  lastReminder?: string
  history: PaymentHistory[]
}

// ─── Production ───────────────────────────────────────────────────────────────
export interface ProductionItem {
  id: string
  projectId: string
  projectName: string
  clientName: string
  productType: string
  stage: ProductionStage
  status?: 'pending' | 'started' | 'done'
  assignedManager: string
  startDate: string
  promisedDelivery: string
  delayDays: number
  progressPct?: number
}

// ─── Mistake ──────────────────────────────────────────────────────────────────
export interface Mistake {
  id: string
  projectId: string
  projectName: string
  title: string
  category: string
  description: string
  priority: Priority
  status: MistakeStatus
  reportedBy: string
  assignedTo?: string
  reportedAt: string
  resolvedAt?: string
  madeBy?: string          // user name who made the mistake
  madeByRole?: string      // their role
  extraCost?: number       // extra cost incurred due to this mistake
  statusHistory?: StatusHistoryItem[]  // lifecycle log of the mistake
  sentToRole?: string      // role the mistake was sent to for rework
  sentToStage?: string     // stage within that role
}

// ─── Installation ─────────────────────────────────────────────────────────────
export interface Installation {
  id: string
  projectId: string
  projectName: string
  clientName: string
  clientPhone: string
  address: string
  scheduledDate: string
  scheduledTime: string
  team: string[]
  status: InstallationStatus
  checklist: ChecklistItem[]
  notes?: string
  customerSignature?: boolean
}

// ─── Site Visit ───────────────────────────────────────────────────────────────
export interface SiteVisit {
  id: string
  projectId: string
  projectName: string
  clientName: string
  clientPhone: string
  address: string
  scheduledDate: string
  scheduledTime: string
  engineer: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
}

// ─── File Item (legacy) ───────────────────────────────────────────────────────
export interface FileItem {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  projectName?: string
  uploadedBy: string
  uploadedAt: string
  category: FileCategory
}

// ─── Team Activity ────────────────────────────────────────────────────────────
export interface TeamActivity {
  id: string
  person: string
  initials: string
  action: string
  time: string
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  phone: string
  email: string
  role: string
  initials: string
}

// ─── Managed User (created via User Management) ────────────────────────────────
export interface ManagedUser {
  id: string
  fullName: string
  mobile: string
  email: string
  password: string
  role: UserRole        // internal role key used for permissions
  displayRole: string   // human-readable label shown in UI
  department?: string
  status: 'active' | 'inactive'
  notes?: string
  createdBy: string
  createdByRole: string
  createdAt: string
  updatedAt: string
  photo?: string        // Hostinger URL or dataUrl
}
