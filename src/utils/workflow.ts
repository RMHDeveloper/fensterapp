import type {
  Task, TaskStatus, Project, ProjectStage, FlowStage,
  StatusHistoryItem, CostBreakdown, UserRole,
  AvailabilityCheckItem, ProductionCheckItem,
} from '../types'
import {
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_PROGRESS,
  DEFAULT_AVAILABILITY_CHECKLIST,
  DEFAULT_PRODUCTION_CHECKLIST,
} from '../types'

// ─── Legacy workflow step type ─────────────────────────────────────────────────
export type WorkflowStep =
  | 'site_visit'
  | 'site_visit_followup'
  | 'quotation_draft'
  | 'quotation_owner_approval'
  | 'quotation_send_client'
  | 'production_check'
  | 'installation_assign'
  | 'installation_work'
  | 'finished'

// ─── Create project from new-project form ──────────────────────────────────────
export interface CreateProjectFormData {
  customerName: string
  phone: string
  projectName: string
  requirement?: string
  location: string
  city?: string
  email?: string
  budgetOptional?: string
  notes?: string
  productType?: string
  assignee?: string
  leadFrom?: string
  startDate?: string
  dueDate?: string
}

export function createProjectFromForm(data: CreateProjectFormData): Omit<Project, 'id'> {
  const now = new Date()
  return {
    number:        `FC-${String(now.getTime()).slice(-4)}`,
    name:          data.projectName.trim(),
    client:        data.customerName.trim(),
    customerName:  data.customerName.trim(),
    clientPhone:   data.phone.trim(),
    clientEmail:   data.email?.trim(),
    requirement:   data.requirement?.trim() || '',
    location:      data.location.trim(),
    city:          data.city?.trim() || data.location.trim().split(',').pop()?.trim() || 'Chennai',
    productType:   data.productType || (data.requirement?.trim() ?? ''),
    budgetOptional:data.budgetOptional?.trim() || '',
    leadFrom:      data.leadFrom,
    startDate:     data.startDate || now.toLocaleDateString('en-IN'),
    status:        'new',
    currentStage:  'new_project',
    stage:         PROJECT_STAGE_LABEL['new_project'],
    progress:      PROJECT_STAGE_PROGRESS['new_project'],
    pendingTasks:  1,
    dueDate:       data.dueDate || '—',
    value:         0,
    createdAt:     now.toLocaleDateString('en-IN'),
    description:   data.notes?.trim() || data.requirement?.trim() || '',
    notes:         data.notes?.trim() ? [data.notes.trim()] : [],
    taskIds:       [],
    files:         [],
    voiceNotes:    [],
  }
}

// ─── Create the first flow task (Assign Site Engineer) ─────────────────────────
export function createSiteAssignTask(
  projectId: string,
  projectName: string,
  clientName: string,
  clientPhone: string,
  clientEmail: string | undefined,
  requirement: string,
  location: string,
  assignedBy: string,
): Omit<Task, 'id'> {
  return {
    title:             'Assign Site Engineer',
    type:              'site_visit',
    taskKind:          'followup',
    status:            'pending' as TaskStatus,
    priority:          'high',
    dueDate:           'Today',
    assignee:          assignedBy,
    roleOwner:         'lead_manager' as UserRole,
    projectId,
    projectName,
    location,
    requiredProofType: 'none',
    proofUploads:      [],
    createdAt:         new Date().toLocaleDateString('en-IN'),
    flowStage:         'site_assign' as FlowStage,
    flowStatus:        'ready',
    clientName,
    clientPhone,
    clientEmail,
    clientRequirement: requirement,
  }
}

// ─── Update project stage and recalculate progress ────────────────────────────
export function stageToProjectUpdate(stage: ProjectStage): Partial<Project> {
  return {
    currentStage: stage,
    stage:        PROJECT_STAGE_LABEL[stage],
    progress:     PROJECT_STAGE_PROGRESS[stage],
    status:       stage === 'completed' ? 'completed' : 'active',
    ...(stage === 'completed' ? {
      isCompleted:    true,
      completedAt:    new Date().toISOString(),
      workflowStatus: 'Finished',
    } : {}),
  }
}

// ─── Add a note to a project ───────────────────────────────────────────────────
export function buildProjectNoteEntry(note: string, updatedBy: string): string {
  const ts = new Date().toLocaleString('en-IN')
  return `[${ts}] ${updatedBy}: ${note}`
}

// ─── Build a status history entry ─────────────────────────────────────────────
export function buildStatusHistoryEntry(
  stage: FlowStage,
  status: string,
  updatedBy: string,
  updatedRole: string,
  note?: string,
  files?: string[],
  reason?: string,
): StatusHistoryItem {
  return {
    stage,
    status,
    note,
    reason,
    files: files?.length ? files : undefined,
    updatedBy,
    updatedRole,
    updatedAt: new Date().toLocaleString('en-IN'),
  }
}

// ─── Site visit complete → LM gets "Review & Create Quotation" task ────────────
export function onEngineerSiteVisitComplete(
  projectId: string,
  projectName: string,
  location: string,
  engineerName: string,
  sitePhoto: string,
  measurementPhoto: string,
  measurementDetails: string,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             'Review Site Visit & Create Quotation',
      type:              'other',
      taskKind:          'followup',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           'Today',
      assignee:          'Lead Manager',
      roleOwner:         'lead_manager' as UserRole,
      projectId,
      projectName,
      location,
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workerName:        engineerName,
      workerRole:        'Site Engineer',
      workflowStep:      'quotation_draft',
      flowStage:         'site_review' as FlowStage,
      flowStatus:        'ready',
      description:       'Site visit completed. Review details and prepare quotation.',
      sitePhoto,
      measurementPhoto,
      measurementDetails,
    },
  ]
}

// ─── LM sends quotation to Owner ───────────────────────────────────────────────
export function onQuotationSentToOwner(
  projectId: string,
  projectName: string,
  clientName: string,
  requirement: string,
  amount: number,
  productType: string,
  quantity: number,
  notes: string,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             'Approve Quotation',
      type:              'other',
      taskKind:          'work',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           'Today',
      assignee:          'Owner',
      roleOwner:         'owner' as UserRole,
      projectId,
      projectName,
      location:          '',
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workerName:        clientName,
      workerRole:        'Client',
      workflowStep:      'quotation_owner_approval',
      flowStage:         'owner_approval' as FlowStage,
      flowStatus:        'ready',
      description:       `Quotation for ${requirement}. Amount: ₹${amount.toLocaleString('en-IN')}`,
      quotationAmount:   amount,
      quotationProductType: productType,
      quotationQuantity: quantity,
      quotationNotes:    notes,
    },
  ]
}

// ─── Owner approves → LM gets "Send to Client" task ──────────────────────────
export function onOwnerApprovedQuotation(
  projectId: string,
  projectName: string,
  amount: number,
  productType: string,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             'Send Quotation to Client',
      type:              'other',
      taskKind:          'followup',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           'Today',
      assignee:          'Lead Manager',
      roleOwner:         'lead_manager' as UserRole,
      projectId,
      projectName,
      location:          '',
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workflowStep:      'quotation_send_client',
      flowStage:         'send_to_client' as FlowStage,
      flowStatus:        'ready',
      description:       `Owner approved. Send quotation ₹${amount.toLocaleString('en-IN')} to client.`,
      quotationAmount:   amount,
      quotationProductType: productType,
    },
  ]
}

// ─── Owner rejects → LM gets "Rework Quotation" task ─────────────────────────
export function onOwnerRejectedQuotation(
  projectId: string,
  projectName: string,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             'Rework Quotation',
      type:              'other',
      taskKind:          'followup',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           'Today',
      assignee:          'Lead Manager',
      roleOwner:         'lead_manager' as UserRole,
      projectId,
      projectName,
      location:          '',
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workflowStep:      'quotation_draft',
      flowStage:         'site_review' as FlowStage,
      flowStatus:        'rework',
      description:       'Owner rejected quotation. Rework and resubmit.',
    },
  ]
}

// ─── Client approves → LM gets "Collect Advance Payment" task ────────────────
export function onClientApproved(
  projectId: string,
  projectName: string,
  clientName: string,
  productType: string,
  quantity: number,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             'Collect Advance Payment',
      type:              'payment',
      taskKind:          'followup',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           'Today',
      assignee:          'Lead Manager',
      roleOwner:         'lead_manager' as UserRole,
      projectId,
      projectName,
      location:          '',
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workerName:        clientName,
      workerRole:        'Client',
      workflowStep:      'quotation_send_client',
      flowStage:         'advance_payment' as FlowStage,
      flowStatus:        'ready',
      description:       `Client approved. Collect advance payment before releasing to production.`,
      quotationProductType: productType,
      quotationQuantity: quantity,
    },
  ]
}

// ─── Advance paid → Production Admin gets availability check task ─────────────
export function onAdvancePaid(
  projectId: string,
  projectName: string,
  clientName: string,
  productType: string,
  quantity: number,
): Omit<Task, 'id'>[] {
  const checklist: AvailabilityCheckItem[] = DEFAULT_AVAILABILITY_CHECKLIST.map(item => ({
    ...item,
    available: false,
  }))
  return [
    {
      title:                'Check Material Availability',
      type:                 'production',
      taskKind:             'work',
      status:               'pending' as TaskStatus,
      priority:             'high',
      dueDate:              'Today',
      assignee:             'Production Admin',
      roleOwner:            'production_admin' as UserRole,
      projectId,
      projectName,
      location:             'Factory / Warehouse',
      requiredProofType:    'none',
      proofUploads:         [],
      createdAt:            new Date().toLocaleDateString('en-IN'),
      workerName:           clientName,
      workerRole:           'Client',
      workflowStep:         'production_check',
      flowStage:            'production_check' as FlowStage,
      flowStatus:           'ready',
      description:          `Check availability: Profile, Glass, Hardware for ${productType} × ${quantity}`,
      quotationProductType: productType,
      quotationQuantity:    quantity,
      availabilityChecklist:checklist,
    },
  ]
}

// ─── All materials available → Production Manager gets work task ──────────────
export function onProductionAvailable(
  projectId: string,
  projectName: string,
  productType: string,
): Omit<Task, 'id'>[] {
  const checklist: ProductionCheckItem[] = DEFAULT_PRODUCTION_CHECKLIST.map(item => ({
    ...item,
    done: false,
  }))
  return [
    {
      title:                'Production Work',
      type:                 'production',
      taskKind:             'work',
      status:               'pending' as TaskStatus,
      priority:             'high',
      dueDate:              'Today',
      assignee:             'Production Manager',
      roleOwner:            'production_manager' as UserRole,
      projectId,
      projectName,
      location:             'Factory',
      requiredProofType:    'none',
      proofUploads:         [],
      createdAt:            new Date().toLocaleDateString('en-IN'),
      workflowStep:         'installation_assign',
      flowStage:            'production_work' as FlowStage,
      flowStatus:           'ready',
      description:          `Complete production for ${productType}. Check off each step.`,
      quotationProductType: productType,
      productionChecklist:  checklist,
    },
  ]
}

// ─── Material not available → LM follow-up ────────────────────────────────────
export function onProductionNotAvailable(
  projectId: string,
  projectName: string,
  productType: string,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             'Product Not Available — Follow Up',
      type:              'other',
      taskKind:          'followup',
      status:            'pending' as TaskStatus,
      priority:          'critical',
      dueDate:           'Today',
      assignee:          'Lead Manager',
      roleOwner:         'lead_manager' as UserRole,
      projectId,
      projectName,
      location:          '',
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workflowStep:      'production_check',
      flowStage:         'production_check' as FlowStage,
      flowStatus:        'waiting',
      description:       `${productType} not available in stock. Follow up with supplier.`,
      quotationProductType: productType,
    },
  ]
}

// ─── Production ready → LM assigns Installation Incharge ─────────────────────
export function onProductionReady(
  projectId: string,
  projectName: string,
  productType: string,
  clientLocation: string,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             'Assign Installation Incharge',
      type:              'other',
      taskKind:          'followup',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           'Today',
      assignee:          'Lead Manager',
      roleOwner:         'lead_manager' as UserRole,
      projectId,
      projectName,
      location:          clientLocation,
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workflowStep:      'installation_assign',
      flowStage:         'installation_assign' as FlowStage,
      flowStatus:        'ready',
      description:       `Production complete for ${productType}. Assign Installation Incharge.`,
      quotationProductType: productType,
    },
  ]
}

// ─── Installation Incharge assigned → they get work task ──────────────────────
export function onLabourAssigned(
  projectId: string,
  projectName: string,
  labourName: string,
  installationDate: string,
  location: string,
  productType: string,
): Omit<Task, 'id'>[] {
  return [
    {
      title:             `Install ${productType}`,
      type:              'other',
      taskKind:          'work',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           installationDate || 'Today',
      assignee:          labourName,
      roleOwner:         'technician' as UserRole,
      projectId,
      projectName,
      location,
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workerName:        labourName,
      workerRole:        'Installation Incharge',
      workflowStep:      'installation_work',
      flowStage:         'installation_update' as FlowStage,
      flowStatus:        'ready',
      description:       `Install ${productType} at ${location}`,
      labourName,
      installationDate,
      quotationProductType: productType,
    },
  ]
}

// ─── Installation complete → LM collects final payment ────────────────────────
export function onInstallationComplete(
  projectId: string,
  projectName: string,
  clientName: string,
  quotationAmount: number,
  paidSoFar: number,
): Omit<Task, 'id'>[] {
  const balance = Math.max(0, quotationAmount - paidSoFar)
  return [
    {
      title:             'Collect Final Payment',
      type:              'payment',
      taskKind:          'followup',
      status:            'pending' as TaskStatus,
      priority:          'high',
      dueDate:           'Today',
      assignee:          'Lead Manager',
      roleOwner:         'lead_manager' as UserRole,
      projectId,
      projectName,
      location:          '',
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      workflowStep:      'finished',
      flowStage:         'final_payment' as FlowStage,
      flowStatus:        'ready',
      description:       `Installation complete. Collect final payment of ₹${balance.toLocaleString('en-IN')}.`,
      clientName,
      quotationAmount,
      balanceAmount:     balance,
    },
  ]
}

// ─── Calculate production progress percentage ──────────────────────────────────
export function calcProductionProgress(checklist: ProductionCheckItem[]): number {
  if (!checklist.length) return 0
  return Math.round((checklist.filter(i => i.done).length / checklist.length) * 100)
}

// ─── Move project to completed ─────────────────────────────────────────────────
export function moveProjectToCompleted(projectId: string): Partial<Project> {
  return {
    status:         'completed',
    currentStage:   'completed',
    stage:          PROJECT_STAGE_LABEL['completed'],
    progress:       100,
    isCompleted:    true,
    completedAt:    new Date().toISOString(),
    workflowStatus: 'Finished',
    paymentStatus:  'Full Paid',
  }
}

// ─── Get which roles can act on a given flow stage ────────────────────────────
export function getRoleForStage(stage: FlowStage): UserRole {
  const map: Record<FlowStage, UserRole> = {
    site_assign:         'lead_manager',
    site_visit:          'site_engineer',
    reschedule_review:   'lead_manager',
    site_review:         'lead_manager',
    owner_approval:      'owner',
    send_to_client:      'lead_manager',
    production_assign:   'lead_manager',
    production_check:    'production_admin',
    advance_payment:     'lead_manager',
    production_work:     'production_manager',
    installation_assign: 'lead_manager',
    installation_update: 'technician',
    final_payment:       'lead_manager',
    final_completion:    'lead_manager',
    completed:           'lead_manager',
  }
  return map[stage] ?? 'viewer'
}

// ─── Helpers kept for backward compat ─────────────────────────────────────────
export function linkTaskToProject(
  _taskId: string,
  _projectId: string,
): void {
  // In the context/localStorage model, tasks carry projectId — no separate linking needed.
  // This function is here as a named export so callers compile.
}

export function getProjectTasks(allTasks: Task[], projectId: string): Task[] {
  return allTasks.filter(t => t.projectId === projectId)
}

export function addTaskNote(task: Task, note: string, updatedBy: string, updatedRole: string): Partial<Task> {
  const entry = buildStatusHistoryEntry(
    task.flowStage ?? 'site_assign',
    task.status,
    updatedBy,
    updatedRole,
    note,
  )
  return {
    statusHistory: [...(task.statusHistory ?? []), entry],
  }
}

// Kept for CostBreakdown calculation
export function buildCostBreakdown(
  quotationAmount: number,
  materialCost: number,
  productionCost: number,
  installationCost: number,
  transportCost: number,
  numberOfSqft?: number,
): CostBreakdown {
  const profit = quotationAmount - materialCost - productionCost - installationCost - transportCost
  return { quotationAmount, materialCost, productionCost, installationCost, transportCost, numberOfSqft, profit }
}
