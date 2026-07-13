import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

let _client: SupabaseClient | null = null

if (url && key) {
  _client = createClient(url, key, {
    realtime: { params: { eventsPerSecond: 10 } },
    // Matches the previous custom-session behavior (logged out when the tab/browser
    // fully closes) rather than Supabase's localStorage default, which would persist
    // login across browser restarts — not something we changed on purpose.
    auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true },
  })
} else {
  console.warn(
    '[Fenster] Supabase is not configured. Cross-device sync will not work.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.'
  )
}

export const supabase: SupabaseClient | null = _client
export const isSupabaseConfigured: boolean   = _client !== null
