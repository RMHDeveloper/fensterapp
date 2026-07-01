import { supabase } from '../lib/supabase'
import type { Payment } from '../types'
import { loadFromStorage, saveToStorage, STORAGE_KEYS } from '../utils/storage'

const TABLE = 'fenster_payments'

export async function getAllPayments(): Promise<Payment[]> {
  if (!supabase) return loadFromStorage<Payment[]>(STORAGE_KEYS.PAYMENTS, [])
  const { data, error } = await supabase.from(TABLE).select('data').order('created_at', { ascending: false })
  if (error || !data || data.length === 0) return loadFromStorage<Payment[]>(STORAGE_KEYS.PAYMENTS, [])
  const rows = data.map(r => r.data as Payment)
  saveToStorage(STORAGE_KEYS.PAYMENTS, rows)
  return rows
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
