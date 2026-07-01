import { useState, useEffect } from 'react'
import { Plus, X, Eye, EyeOff, Edit2, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import { Snackbar } from '../../components/feedback/Snackbar'
import type { ManagedUser, UserRole } from '../../types'
import {
  loadManagedUsers,
  saveManagedUsers,
  isEmailTaken,
  DISPLAY_ROLES,
  DISPLAY_ROLE_TO_INTERNAL,
} from '../../utils/userStorage'
import { getAllManagedUsers } from '../../services/userService'
import { isSupabaseConfigured } from '../../lib/supabase'

type Tab = 'all' | 'active' | 'inactive'

interface FormState {
  fullName: string
  mobile: string
  email: string
  password: string
  displayRole: string
  department: string
  status: 'active' | 'inactive'
  notes: string
}

const EMPTY_FORM: FormState = {
  fullName: '', mobile: '', email: '', password: '',
  displayRole: '', department: '', status: 'active', notes: '',
}

const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-400 transition-colors'
const lbl = 'text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block'

export default function UserManagementScreen() {
  const { user: authUser } = useAuth()

  if (!authUser?.displayRole?.includes('MD')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-8 text-center">
        <div>
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-sm font-bold text-slate-700">Access Restricted</p>
          <p className="text-xs text-slate-400 mt-1">User management is only available to MD.</p>
        </div>
      </div>
    )
  }

  const [users,      setUsers]      = useState<ManagedUser[]>([])
  const [tab,        setTab]        = useState<Tab>('all')
  const [showForm,   setShowForm]   = useState(false)
  const [editUser,   setEditUser]   = useState<ManagedUser | null>(null)
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM)
  const [errors,     setErrors]     = useState<Partial<Record<keyof FormState, string>>>({})
  const [showPass,   setShowPass]   = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [snack,      setSnack]      = useState({ open: false, msg: '', type: 'success' as 'success' | 'error' })

  useEffect(() => {
    setUsers(loadManagedUsers())
    if (isSupabaseConfigured) {
      setSyncing(true)
      getAllManagedUsers()
        .then(remote => { if (remote.length > 0) { setUsers(remote); saveManagedUsers(remote) } })
        .catch(() => {})
        .finally(() => setSyncing(false))
    }
  }, [])

  function handleRefresh() {
    if (!isSupabaseConfigured) { setUsers(loadManagedUsers()); return }
    setSyncing(true)
    getAllManagedUsers()
      .then(remote => { if (remote.length > 0) { setUsers(remote); saveManagedUsers(remote) } })
      .catch(() => {})
      .finally(() => setSyncing(false))
  }

  const filtered = users.filter(u =>
    tab === 'all' ? true : u.status === tab
  )

  function openAdd() {
    setEditUser(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setShowPass(false)
    setShowForm(true)
  }

  function openEdit(u: ManagedUser) {
    setEditUser(u)
    setForm({
      fullName:    u.fullName,
      mobile:      u.mobile,
      email:       u.email,
      password:    u.password,
      displayRole: u.displayRole,
      department:  u.department ?? '',
      status:      u.status,
      notes:       u.notes ?? '',
    })
    setErrors({})
    setShowPass(false)
    setShowForm(true)
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.fullName.trim())   errs.fullName    = 'Full Name is required'
    if (!form.mobile.trim())     errs.mobile      = 'Mobile Number is required'
    if (!form.email.trim())      errs.email       = 'Email / Username is required'
    if (!form.password.trim())   errs.password    = 'Password is required'
    if (!form.displayRole)       errs.displayRole = 'Role is required'
    if (form.email.trim() && isEmailTaken(form.email.trim(), editUser?.id)) {
      errs.email = 'This email is already taken'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const now          = new Date().toISOString()
    const internalRole: UserRole = DISPLAY_ROLE_TO_INTERNAL[form.displayRole] ?? 'viewer'
    let updated: ManagedUser[]

    if (editUser) {
      updated = users.map(u =>
        u.id === editUser.id
          ? {
              ...u,
              fullName:    form.fullName.trim(),
              mobile:      form.mobile.trim(),
              email:       form.email.trim().toLowerCase(),
              password:    form.password.trim(),
              role:        internalRole,
              displayRole: form.displayRole,
              department:  form.department.trim() || undefined,
              status:      form.status,
              notes:       form.notes.trim() || undefined,
              updatedAt:   now,
            }
          : u
      )
      setSnack({ open: true, msg: 'User updated successfully', type: 'success' })
    } else {
      const newUser: ManagedUser = {
        id:          `managed_${Date.now()}`,
        fullName:    form.fullName.trim(),
        mobile:      form.mobile.trim(),
        email:       form.email.trim().toLowerCase(),
        password:    form.password.trim(),
        role:        internalRole,
        displayRole: form.displayRole,
        department:  form.department.trim() || undefined,
        status:      form.status,
        notes:       form.notes.trim() || undefined,
        createdBy:   authUser?.name ?? 'System',
        createdByRole: authUser?.role ?? 'owner',
        createdAt:   now,
        updatedAt:   now,
      }
      updated = [...users, newUser]
      setSnack({ open: true, msg: 'User created successfully', type: 'success' })
    }

    saveManagedUsers(updated)
    setUsers(updated)
    setShowForm(false)
  }

  function toggleStatus(u: ManagedUser) {
    const now     = new Date().toISOString()
    const updated = users.map(x =>
      x.id === u.id
        ? { ...x, status: (x.status === 'active' ? 'inactive' : 'active') as ManagedUser['status'], updatedAt: now }
        : x
    )
    saveManagedUsers(updated)
    setUsers(updated)
    setSnack({
      open: true,
      msg:  u.status === 'active' ? 'User deactivated' : 'User activated',
      type: 'success',
    })
  }

  function field(key: keyof FormState) {
    return {
      value:    form[key] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value })),
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />

      {/* Header */}
      <div className="sticky top-14 z-20 bg-white px-4 pt-3.5 pb-3.5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-base font-extrabold text-slate-800">User Management</h1>
              <p className="text-xs text-slate-500">{users.length} total users</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSupabaseConfigured && (
              <button
                onClick={handleRefresh}
                className={`w-8 h-8 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center active:bg-slate-200 ${syncing ? 'opacity-50' : ''}`}
                disabled={syncing}
                title="Sync from cloud"
              >
                <RefreshCw size={13} className={`text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl active:bg-blue-700"
            >
              <Plus size={14} /> Add User
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-3.5 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="mt-14 text-center">
            <p className="text-sm font-semibold text-slate-500">No users found</p>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'all' ? 'Tap "Add User" to create the first user.' : `No ${tab} users.`}
            </p>
          </div>
        ) : (
          filtered.map(u => {
            const initials = u.fullName.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()
            return (
              <div key={u.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-extrabold text-blue-700">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-800 truncate">{u.fullName}</h3>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{u.email}</p>
                        <p className="text-[11px] text-slate-400">{u.mobile}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full truncate">
                      {u.displayRole}
                    </span>
                    {u.department && (
                      <span className="text-[10px] text-slate-400 truncate">{u.department}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEdit(u)}
                      className="w-7 h-7 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center active:bg-slate-100"
                    >
                      <Edit2 size={12} className="text-slate-600" />
                    </button>
                    <button
                      onClick={() => toggleStatus(u)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg active:opacity-80 transition-colors ${
                        u.status === 'active'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-slate-300 mt-2">
                  Added {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' '}by {u.createdBy}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit Sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-t-3xl max-h-[92vh] flex flex-col">

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-extrabold text-slate-800">
                {editUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center active:bg-slate-200"
              >
                <X size={16} className="text-slate-600" />
              </button>
            </div>

            {/* Scrollable form */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Full Name */}
              <div>
                <label className={lbl}>Full Name <span className="text-red-500">*</span></label>
                <input
                  {...field('fullName')}
                  className={`${inp} ${errors.fullName ? 'border-red-300' : ''}`}
                  placeholder="e.g. Rajan Kumar"
                />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              {/* Mobile */}
              <div>
                <label className={lbl}>Mobile Number <span className="text-red-500">*</span></label>
                <input
                  {...field('mobile')}
                  type="tel" inputMode="numeric"
                  className={`${inp} ${errors.mobile ? 'border-red-300' : ''}`}
                  placeholder="e.g. 9876543210"
                />
                {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
              </div>

              {/* Email */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={lbl + ' mb-0'}>Email / Username <span className="text-red-500">*</span></label>
                  {editUser && (
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Editable</span>
                  )}
                </div>
                <input
                  {...field('email')}
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inp} ${errors.email ? 'border-red-300' : 'border-slate-200'}`}
                  placeholder="e.g. rajan@company.com"
                />
                {errors.email
                  ? <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  : editUser && <p className="text-[11px] text-slate-400 mt-1">Changing email will update the login username.</p>
                }
              </div>

              {/* Password */}
              <div>
                <label className={lbl}>Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    type={showPass ? 'text' : 'password'}
                    className={`${inp} pr-10 ${errors.password ? 'border-red-300' : ''}`}
                    placeholder="Set a login password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 active:text-slate-600"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              {/* Role */}
              <div>
                <label className={lbl}>Role <span className="text-red-500">*</span></label>
                <select
                  {...field('displayRole')}
                  className={`${inp} ${errors.displayRole ? 'border-red-300' : ''}`}
                >
                  <option value="">— Select Role —</option>
                  {DISPLAY_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.displayRole && <p className="text-xs text-red-500 mt-1">{errors.displayRole}</p>}
              </div>

              {/* Status */}
              <div>
                <label className={lbl}>Status <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {(['active', 'inactive'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize border transition-colors ${
                        form.status === s
                          ? s === 'active'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                            : 'bg-red-50 border-red-300 text-red-600'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department (optional) */}
              <div>
                <label className={lbl}>
                  Department <span className="text-slate-300 font-normal normal-case">(optional)</span>
                </label>
                <input
                  {...field('department')}
                  className={inp}
                  placeholder="e.g. Sales, Production"
                />
              </div>

              {/* Notes (optional) */}
              <div>
                <label className={lbl}>
                  Notes <span className="text-slate-300 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  {...field('notes')}
                  rows={2}
                  className={`${inp} resize-none`}
                  placeholder="Any notes about this user…"
                />
              </div>
            </div>

            {/* Save */}
            <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={handleSave}
                className="w-full py-3.5 bg-blue-600 text-white text-sm font-extrabold rounded-2xl active:bg-blue-700"
              >
                {editUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isSupabaseConfigured && (
        <div className="mx-4 mb-4 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-amber-700 font-semibold">
            Cross-device sync requires Supabase configuration.
          </p>
          <p className="text-[10px] text-amber-600 mt-0.5">
            Users are saved locally on this device only. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync.
          </p>
        </div>
      )}

      <Snackbar
        isOpen={snack.open}
        message={snack.msg}
        type={snack.type}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
      />
    </div>
  )
}
