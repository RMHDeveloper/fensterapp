import type { Page } from '@playwright/test'
import type { AuthUser } from '../src/types'

// Bypass the login form by pre-seeding sessionStorage — used for role-access tests
export async function loginAs(page: Page, user: Omit<AuthUser, 'initials'> & { initials?: string }) {
  const session: AuthUser = {
    initials: user.name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase(),
    ...user,
  }
  await page.addInitScript((s) => {
    sessionStorage.setItem('fenster_session', JSON.stringify(s))
  }, session)
}

// Default test credentials seeded when Supabase is disabled
export const CREDENTIALS = {
  owner:             { email: 'deepak@fenster.in',  password: 'Fenster@MD25' },
  lead_manager:      { email: 'priya@fenster.in',   password: 'Fenster@LO25' },
  site_engineer:     { email: 'arjun@fenster.in',   password: 'Fenster@SE25' },
  production_manager:{ email: 'mohan@fenster.in',   password: 'Fenster@PM25' },
  technician:        { email: 'rajan@fenster.in',   password: 'Fenster@TK25' },
  viewer:            { email: 'guest@fenster.in',   password: 'Fenster@GU25' },
}
