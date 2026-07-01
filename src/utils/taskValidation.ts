import type { ProofType, UserRole } from '../types'

export interface ValidationErrors {
  proof?: string
  status?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationErrors
}

const COMPLETION_STATUSES = new Set(['completed', 'done', 'waiting_approval'])

const PROOF_ERRORS: Record<ProofType, string> = {
  none:               '',
  site_photo:         'Upload site photo to complete this task.',
  measurement_photo:  'Upload measurement photo to complete this task.',
  production_photo:   'Upload production photo to complete this task.',
  quotation_details:  'Add quotation details before sending to Owner.',
  approval_action:    'Select Approve or Reject before saving.',
}

export function validateTaskCompletion(
  requiredProofType: ProofType | undefined,
  selectedStatus: string,
  uploadedFiles: string[],
  role: UserRole,
): ValidationResult {
  if (role === 'viewer') {
    return { isValid: false, errors: { status: 'You cannot complete tasks.' } }
  }

  // Non-completion statuses always pass
  if (!COMPLETION_STATUSES.has(selectedStatus)) {
    return { isValid: true, errors: {} }
  }

  const pt = requiredProofType ?? 'none'
  if (pt === 'none') return { isValid: true, errors: {} }

  if (uploadedFiles.length > 0) return { isValid: true, errors: {} }

  return { isValid: false, errors: { proof: PROOF_ERRORS[pt] } }
}

export function needsProofForStatus(
  requiredProofType: ProofType | undefined,
  selectedStatus: string,
): boolean {
  if (!requiredProofType || requiredProofType === 'none') return false
  return COMPLETION_STATUSES.has(selectedStatus)
}
