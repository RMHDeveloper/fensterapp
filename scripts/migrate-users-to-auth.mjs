import { createClient } from '@supabase/supabase-js'

// Must match src/utils/authIdentity.ts — kept in sync by hand since this plain
// Node script can't import a TS module from the Vite app.
function syntheticEmailFromMobile(mobile) {
  const digits = mobile.replace(/\D/g, '').slice(-10)
  return `u${digits}@fenster.internal`
}

const url = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function findAuthUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  return data.users.find(u => u.email === email) ?? null
}

async function run() {
  const { data: rows, error } = await admin.from('fenster_managed_users').select('id, data, auth_user_id')
  if (error) throw error

  let created = 0, linked = 0, skipped = 0, failed = 0

  for (const row of rows) {
    const user = row.data
    if (row.auth_user_id) { skipped++; continue }

    const email = syntheticEmailFromMobile(user.mobile)
    try {
      let authUser
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email, password: user.password, email_confirm: true,
      })
      if (createError) {
        // Idempotency: a prior run may have created the auth account but failed
        // before writing auth_user_id back — reuse the existing account instead
        // of erroring out.
        if (createError.status === 422 || /already registered/i.test(createError.message)) {
          authUser = await findAuthUserByEmail(email)
          if (!authUser) throw createError
        } else {
          throw createError
        }
      } else {
        authUser = createData.user
        created++
      }

      const { error: updateError } = await admin
        .from('fenster_managed_users')
        .update({ auth_user_id: authUser.id })
        .eq('id', row.id)
      if (updateError) throw updateError
      linked++
      console.log(`✓ ${user.fullName} (${user.mobile}) → ${email}`)
    } catch (err) {
      failed++
      console.error(`✗ ${user.fullName} (${user.mobile}):`, err.message ?? err)
    }
  }

  console.log(`\nDone. Created ${created} new auth accounts, linked ${linked}, skipped ${skipped} (already linked), ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

run().catch(err => { console.error('Error:', err.message ?? err); process.exit(1) })
