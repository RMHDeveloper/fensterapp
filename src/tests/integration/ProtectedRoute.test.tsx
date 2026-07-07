import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { AuthUser } from '../../types'
import { AuthProvider } from '../../context/AuthContext'
import { ProtectedRoute } from '../../components/layout/ProtectedRoute'

vi.mock('../../utils/userStorage', () => ({
  loadManagedUsers: () => [],
  initUsersFromSupabase: () => Promise.resolve(),
  DEFAULT_PRODUCTION_USERS: [],
  saveManagedUsers: vi.fn(),
}))

const SESSION_KEY = 'fenster_session'

function setSession(user: AuthUser) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
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

function makeUser(role: AuthUser['role']): AuthUser {
  return { id: '1', name: 'Test User', initials: 'TU', email: 'test@test.com', role }
}

afterEach(() => sessionStorage.clear())

describe('ProtectedRoute — unauthenticated', () => {
  it('does not render protected content when not logged in', () => {
    renderProtected('leads')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — owner (full access)', () => {
  it('renders content for leads', () => {
    setSession(makeUser('owner'))
    renderProtected('leads')
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('renders content for approvals', () => {
    setSession(makeUser('owner'))
    renderProtected('approvals')
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('renders content for payments', () => {
    setSession(makeUser('owner'))
    renderProtected('payments')
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})

describe('ProtectedRoute — lead_manager', () => {
  it('can access leads', () => {
    setSession(makeUser('lead_manager'))
    renderProtected('leads')
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from approvals', () => {
    setSession(makeUser('lead_manager'))
    renderProtected('approvals')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.getByText('You cannot open this page')).toBeInTheDocument()
  })
})

describe('ProtectedRoute — site_engineer', () => {
  it('can access site-visits', () => {
    setSession(makeUser('site_engineer'))
    renderProtected('site-visits')
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from leads', () => {
    setSession(makeUser('site_engineer'))
    renderProtected('leads')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.getByText('You cannot open this page')).toBeInTheDocument()
  })

  it('is blocked from payments', () => {
    setSession(makeUser('site_engineer'))
    renderProtected('payments')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — technician', () => {
  it('can access installation', () => {
    setSession(makeUser('technician'))
    renderProtected('installation')
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from leads', () => {
    setSession(makeUser('technician'))
    renderProtected('leads')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('is blocked from quotations', () => {
    setSession(makeUser('technician'))
    renderProtected('quotations')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute — viewer', () => {
  it('can access home and files', () => {
    setSession(makeUser('viewer'))
    renderProtected('home')
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('is blocked from leads', () => {
    setSession(makeUser('viewer'))
    renderProtected('leads')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('is blocked from approvals', () => {
    setSession(makeUser('viewer'))
    renderProtected('approvals')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
