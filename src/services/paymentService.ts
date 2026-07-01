import { supabase } from '../lib/supabase'
import type { Payment } from '../types'

const TABLE = 'fenster_payments'

export async function getAllPayments(): Promise<Payment[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(r => r.data as Payment)
}

export async function upsertPayment(payment: Payment): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({
    id:         payment.id,
    project_id: payment.projectId,
    status:     payment.status,
    data:       payment,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) console.error('[Fenster] payment sync error:', error.message)
}
