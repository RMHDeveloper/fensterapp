import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { AuthUser, ManagedUser } from '../../types'
import { AuthProvider } from '../../context/AuthContext'
import { ProtectedRoute } from '../../components/layout/ProtectedRoute'

vi.mock('../../utils/userStorage', () => ({
  loadManagedUsers: () => [],
  initUsersFromSupabase: () => Promise.resolve(),
  DEFAULT_PRODUCTION_USERS: [],
  saveManagedUsers: vi.fn(),
}))

// Mocked Supabase Auth session — set per-test via setSession()/clearSession(),
// read by AuthContext through the same supabase.auth.getSession()/onAuthStateChange
// calls it uses against the real client.
let mockSession: { user: { id: string } } | null = null
let mockManagedUser: ManagedUser | null = null

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => { mockSession = null; return Promise.resolve({ error: null }) },
    },
  },
  isSupabaseConfigured: true,
}))

vi.mock('../../services/userService', () => ({
  getManagedUserByAuthId: () => Promise.resolve(mockManagedUser),
}))

function setSession(role: AuthUser['role']) {
  mockSession = { user: { id: 'auth-1' } }
  mockManagedUser = {
    id: '1', fullName: 'Test User', mobile: '9000000000', email: 'test@test.com',
    password: 'x', role, displayRole: role, status: 'active',
    createdBy: 'system', createdByRole: 'owner', createdAt: '', updatedAt: '',
  }
}

function renderProtected(screenPath: string) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProtectedRoute screenPath={screenPath}>
          <div>Protected Content</div>
        </ProtectedRoute>
      </AuthProvider>
    </MemoryRouter>
  )
}

afterEach(() => { mockSession = null; mockManagedUser = null })

describe('ProtectedRoute — unauthenticated', () => {
  it('does not render protected content when not logged in', () => {
    renderProtected('leads')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — owner (full access)', () => {
  it('renders content for leads', async () => {
    setSession('owner')
    renderProtected('leads')
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })

  it('renders content for approvals', async () => {
    setSession('owner')
    renderProtected('approvals')
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })

  it('renders content for payments', async () => {
    setSession('owner')
    renderProtected('payments')
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })
})

describe('ProtectedRoute — lead_manager', () => {
  it('can access leads', async () => {
    setSession('lead_manager')
    renderProtected('leads')
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from approvals', async () => {
    setSession('lead_manager')
    renderProtected('approvals')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — site_engineer', () => {
  it('can access site-visits', async () => {
    setSession('site_engineer')
    renderProtected('site-visits')
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from leads', async () => {
    setSession('site_engineer')
    renderProtected('leads')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('is blocked from payments', async () => {
    setSession('site_engineer')
    renderProtected('payments')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('is blocked from projects', async () => {
    setSession('site_engineer')
    renderProtected('projects')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — technician', () => {
  it('can access installation', async () => {
    setSession('technician')
    renderProtected('installation')
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from leads', async () => {
    setSession('technician')
    renderProtected('leads')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('is blocked from quotations', async () => {
    setSession('technician')
    renderProtected('quotations')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — viewer', () => {
  it('can access home and files', async () => {
    setSession('viewer')
    renderProtected('home')
    expect(await screen.findByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from leads', async () => {
    setSession('viewer')
    renderProtected('leads')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('is blocked from approvals', async () => {
    setSession('viewer')
    renderProtected('approvals')
    expect(await screen.findByText('You cannot open this page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
