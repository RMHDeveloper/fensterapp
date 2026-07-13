// Deploy with: npx supabase functions deploy admin-user-sync
// Requires a Supabase CLI login + `supabase link` (needs a personal access
// token from the Supabase dashboard — not the same as the service role key).
// After deploying, set the service role key as a function secret:
//   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<value>
//
// Called by UserManagementScreen.tsx whenever an owner creates a user or
// changes an existing user's mobile number / password — creates or updates
// the matching Supabase Auth account so the app-level `fenster_managed_users`
// row and the real login credential never drift apart. The browser can't do
// this directly because it requires the service role key, which must never
// reach client code.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Must match src/utils/authIdentity.ts — kept in sync by hand since this Deno
// function can't import a TS module from the Vite app.
function syntheticEmailFromMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '').slice(-10)
  return `u${digits}@fenster.internal`
}

interface RequestBody {
  managedUserId: string
  mobile: string
  password?: string   // omitted when only non-credential fields changed
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!callerToken) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceRoleKey)

  // Verify the caller's own session, then verify they hold the owner role —
  // never trust a client-supplied role claim for a privileged operation.
  const { data: callerAuth, error: callerAuthError } = await admin.auth.getUser(callerToken)
  if (callerAuthError || !callerAuth.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 })
  }
  const { data: callerProfile } = await admin
    .from('fenster_managed_users')
    .select('data')
    .eq('auth_user_id', callerAuth.user.id)
    .maybeSingle()
  const callerRoles: string[] = callerProfile?.data?.roles ?? [callerProfile?.data?.role]
  if (!callerRoles.includes('owner')) {
    return new Response(JSON.stringify({ error: 'Forbidden — owner role required' }), { status: 403 })
  }

  const body = (await req.json()) as RequestBody
  if (!body.managedUserId || !body.mobile) {
    return new Response(JSON.stringify({ error: 'managedUserId and mobile are required' }), { status: 400 })
  }
  const email = syntheticEmailFromMobile(body.mobile)

  const { data: existingRow } = await admin
    .from('fenster_managed_users')
    .select('auth_user_id')
    .eq('id', body.managedUserId)
    .maybeSingle()

  try {
    let authUserId = existingRow?.auth_user_id as string | undefined

    if (authUserId) {
      // Existing user — update email (if mobile changed) and/or password (if provided)
      const updates: { email?: string; password?: string } = { email }
      if (body.password) updates.password = body.password
      const { error } = await admin.auth.admin.updateUserById(authUserId, updates)
      if (error) throw error
    } else {
      // New user — create the auth account and link it back
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password: body.password, email_confirm: true,
      })
      if (error) throw error
      authUserId = created.user.id
      const { error: linkError } = await admin
        .from('fenster_managed_users')
        .update({ auth_user_id: authUserId })
        .eq('id', body.managedUserId)
      if (linkError) throw linkError
    }

    return new Response(JSON.stringify({ ok: true, authUserId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 })
  }
})
