import { Camera, CheckCircle2 } from 'lucide-react'
import type { ProofType } from '../../types'

interface Props {
  requiredProofType: ProofType | undefined
  proofUploads: string[] | undefined
}

const PROOF_LABEL: Partial<Record<ProofType, string>> = {
  site_photo:        'Site Photo Required',
  measurement_photo: 'Measurement Photo Required',
  production_photo:  'Production Photo Required',
  quotation_details: 'Quotation Details Required',
}

export function ProofBadge({ requiredProofType, proofUploads }: Props) {
  if (!requiredProofType || requiredProofType === 'none' || requiredProofType === 'approval_action') {
    return null
  }

  const hasProof = (proofUploads?.length ?? 0) > 0

  if (hasProof) {
    return (
      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full self-start">
        <CheckCircle2 size={10} strokeWidth={2.5} />
        <span className="text-[10px] font-bold">Photo Added</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-1 rounded-full self-start">
      <Camera size={10} strokeWidth={2} />
      <span className="text-[10px] font-bold">{PROOF_LABEL[requiredProofType] ?? 'Photo Required'}</span>
    </div>
  )
}
