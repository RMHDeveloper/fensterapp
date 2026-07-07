import { describe, it, expect, vi } from 'vitest'

const TEST_USERS = [
  {
    id: 'u1',
    fullName: 'Test Owner',
    mobile: '9000000001',
    email: 'owner@test.com',
    password: 'OwnerPass123',
    role: 'owner' as const,
    displayRole: 'Managing Director (MD)',
    department: 'Management',
    status: 'active' as const,
    createdBy: 'system',
    createdByRole: 'owner',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    fullName: 'Inactive User',
    mobile: '9000000002',
    email: 'inactive@test.com',
    password: 'Pass123',
    role: 'viewer' as const,
    displayRole: 'Viewer',
    department: '',
    status: 'inactive' as const,
    createdBy: 'system',
    createdByRole: 'owner',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
]

vi.mock('../../utils/userStorage', () => ({
  loadManagedUsers: () => TEST_USERS,
  initUsersFromSupabase: () => Promise.resolve(),
  DEFAULT_PRODUCTION_USERS: [],
  saveManagedUsers: vi.fn(),
}))

// Import after mock is hoisted
const { authenticateUser } = await import('../../data/mockUsers')

describe('authenticateUser', () => {
  it('returns ok with correct user data for valid credentials', () => {
    const result = authenticateUser('owner@test.com', 'OwnerPass123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.role).toBe('owner')
      expect(result.user.name).toBe('Test Owner')
      expect(result.user.email).toBe('owner@test.com')
    }
  })

  it('generates correct initials from full name', () => {
    const result = authenticateUser('owner@test.com', 'OwnerPass123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.initials).toBe('TO')
    }
  })

  it('is case-insensitive for email matching', () => {
    const result = authenticateUser('OWNER@TEST.COM', 'OwnerPass123')
    expect(result.ok).toBe(true)
  })

  it('trims whitespace from email before matching', () => {
    const result = authenticateUser('  owner@test.com  ', 'OwnerPass123')
    expect(result.ok).toBe(true)
  })

  it('returns not_found for unknown email', () => {
    const result = authenticateUser('nobody@test.com', 'AnyPass')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_found')
  })

  it('returns not_found for correct email but wrong password', () => {
    const result = authenticateUser('owner@test.com', 'WrongPassword')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_found')
  })

  it('returns inactive for a user with inactive status', () => {
    const result = authenticateUser('inactive@test.com', 'Pass123')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('inactive')
  })
})
