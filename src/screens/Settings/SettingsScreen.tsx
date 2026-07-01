import { useState } from 'react'
import { Bell, LogOut, RefreshCw, ChevronRight, UserCog, Users, UserPlus, Pencil, Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { clearAllData } from '../../utils/storage'
import { loadManagedUsers, saveManagedUsers } from '../../utils/userStorage'
import { storeFile } from '../../utils/fileStorage'
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../data/permissions'
import { Dialog } from '../../components/feedback/Dialog'
import { Snackbar } from '../../components/feedback/Snackbar'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { UserRole } from '../../types'

const ROLES: UserRole[] = [
  'owner', 'lead_manager', 'site_engineer',
  'production_admin', 'production_manager', 'technician',
  'viewer',
]

const ROLE_ICONS: Record<UserRole, string> = {
  owner:                '👑',
  lead_manager:         '📋',
  site_engineer:        '🏗️',
  production_admin:     '📦',
  production_manager:   '🔧',
  technician:           '🔩',
  installation_incharge:'🔩',
  production_team:      '🔧',
  viewer:               '👁️',
}

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { user, login, logout, can, updateProfile } = useAuth()
  const { resetAllData }             = useAppData()

  const [showLogout,    setShowLogout]    = useState(false)
  const [showReset,     setShowReset]     = useState(false)
  const [showSwitcher,  setShowSwitcher]  = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  // Profile edit state
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName,        setEditName]        = useState('')
  const [editPass,        setEditPass]        = useState('')
  const [editPass2,       setEditPass2]       = useState('')
  const [editPhotoFile,   setEditPhotoFile]   = useState<File | null>(null)
  const [editPhotoUrl,    setEditPhotoUrl]    = useState('')
  const [editUploading,   setEditUploading]   = useState(false)
  const [editError,       setEditError]       = useState('')

  function openEditProfile() {
    setEditName(user?.name ?? '')
    setEditPass(''); setEditPass2('')
    setEditPhotoFile(null); setEditPhotoUrl('')
    setEditError('')
    setShowEditProfile(true)
  }

  async function handleSaveProfile() {
    setEditError('')
    if (!editName.trim()) { setEditError('Name cannot be empty.'); return }
    if (editPass && editPass !== editPass2) { setEditError('Passwords do not match.'); return }
    if (editPass && editPass.length < 6)    { setEditError('Password must be at least 6 characters.'); return }
    setEditUploading(true)
    try {
      let photoUrl: string | undefined
      if (editPhotoFile) {
        photoUrl = await storeFile(editPhotoFile)
      }
      const updates: { name?: string; photo?: string } = {}
      if (editName.trim() !== user?.name) updates.name = editName.trim()
      if (photoUrl) updates.photo = photoUrl

      updateProfile(updates)

      // Update password in managed user storage if user is managed
      if (editPass && user?.email) {
        const managed = loadManagedUsers()
        const idx = managed.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase())
        if (idx !== -1) {
          managed[idx] = { ...managed[idx], password: editPass }
          saveManagedUsers(managed)
        }
      }

      setShowEditProfile(false)
      setSnack({ open: true, msg: 'Profile updated!' })
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Upload failed. Try again.')
    } finally {
      setEditUploading(false)
    }
  }

  function handleLogout() {
    setShowLogout(false)
    logout()
    navigate('/login', { replace: true })
  }

  function handleReset() {
    setShowReset(false)
    clearAllData()
    resetAllData()
    setSnack({ open: true, msg: 'All data cleared.' })
    navigate('/projects', { replace: true })
  }

  function handleSwitchRole(role: UserRole) {
    login(role)
    setShowSwitcher(false)
    setSnack({ open: true, msg: `Switched to ${ROLE_LABELS[role]}` })
  }

  const profilePhoto = user?.photo

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />

      <div className="sticky top-14 z-20 bg-white px-5 pt-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-lg font-extrabold text-slate-800">Settings</h1>
        </div>
      </div>

      {/* Profile Card */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex items-center gap-4">
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0B7A3B, #065F2D)' }}>
              <span className="text-lg font-extrabold text-white">{user?.initials ?? '?'}</span>
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-base font-extrabold text-slate-800">{user?.name ?? 'Guest'}</h2>
            <p className="text-xs text-slate-500">{user?.email ?? ''}</p>
            <span className="inline-block mt-1 bg-green-50 text-green-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {user ? (user.displayRole ?? ROLE_LABELS[user.role]) : ''}
            </span>
          </div>
          <button
            onClick={openEditProfile}
            className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center active:bg-slate-200 flex-shrink-0"
            aria-label="Edit Profile"
          >
            <Pencil size={15} className="text-slate-500" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* User Management — visible only to MD */}
        {user && can('manage_users') && user.displayRole?.includes('MD') && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">User Management</p>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => navigate('/settings/users')}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 text-left border-b border-slate-100"
              >
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <UserPlus size={16} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">Add User</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Create a new user account</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />
              </button>
              <button
                onClick={() => navigate('/settings/users')}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 text-left"
              >
                <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">View Users</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Manage and deactivate users</p>
                </div>
                <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Preferences */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Preferences</p>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bell size={16} className="text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">Push Notifications</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Task reminders, payment alerts</p>
              </div>
              <button
                onClick={() => setNotifications(v => !v)}
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${notifications ? 'bg-green-700' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${notifications ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Prototype Role Switcher — MD-only debug section */}
        {user?.role === 'owner' && user?.displayRole?.includes('MD') && <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Prototype</p>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <button
              onClick={() => setShowSwitcher(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 text-left"
            >
              <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <UserCog size={16} className="text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">Switch Role</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Currently: {user ? (user.displayRole ?? ROLE_LABELS[user.role]) : '—'}
                </p>
              </div>
              <ChevronRight size={15} className={`text-slate-300 flex-shrink-0 transition-transform ${showSwitcher ? 'rotate-90' : ''}`} />
            </button>

            {showSwitcher && (
              <div className="border-t border-slate-100 px-3 py-2 space-y-1">
                {ROLES.map(role => (
                  <button
                    key={role}
                    onClick={() => handleSwitchRole(role)}
                    className={[
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors',
                      user?.role === role
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-slate-50 active:bg-slate-100 text-slate-700',
                    ].join(' ')}
                  >
                    <span className="text-lg">{ROLE_ICONS[role]}</span>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{ROLE_LABELS[role]}</p>
                      <p className="text-[10px] text-slate-400">{ROLE_DESCRIPTIONS[role]}</p>
                    </div>
                    {user?.role === role && (
                      <span className="ml-auto text-[10px] font-bold text-green-700">Current</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="h-px bg-slate-100 mx-4" />
            <button
              onClick={() => setShowReset(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 text-left"
            >
              <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw size={16} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">Clear All Data</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Delete all projects, tasks, leads and payments</p>
              </div>
            </button>
          </div>
        </div>}

        {/* Account */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Account</p>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <button
              onClick={() => setShowLogout(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 text-left"
            >
              <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <LogOut size={16} className="text-red-500" />
              </div>
              <p className="text-sm font-semibold text-red-500">Log Out</p>
            </button>
          </div>
        </div>
      </div>

      <div className="text-center py-8 space-y-1">
        <p className="text-xs text-slate-400 font-medium">Fenster Operations</p>
        <p className="text-[10px] text-slate-300">v1.0.0</p>
      </div>

      {/* Profile Edit Sheet */}
      <BottomSheet isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile" height="auto">
        <div className="space-y-4 pb-4">
          {/* Photo upload */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              {editPhotoUrl ? (
                <img src={editPhotoUrl} alt="Preview" className="w-20 h-20 rounded-2xl object-cover" />
              ) : profilePhoto ? (
                <img src={profilePhoto} alt="Current photo" className="w-20 h-20 rounded-2xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0B7A3B, #065F2D)' }}>
                  <span className="text-2xl font-extrabold text-white">{user?.initials ?? '?'}</span>
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/30 opacity-0 group-active:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
              <input
                type="file" accept="image/*" className="sr-only"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setEditPhotoFile(f)
                    const reader = new FileReader()
                    reader.onload = ev => setEditPhotoUrl(ev.target?.result as string)
                    reader.readAsDataURL(f)
                  }
                }}
              />
            </label>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Display Name</label>
            <input
              value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">New Password <span className="text-slate-300 font-normal">(optional)</span></label>
            <input
              type="password" value={editPass} onChange={e => setEditPass(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {editPass && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Confirm Password</label>
              <input
                type="password" value={editPass2} onChange={e => setEditPass2(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          )}

          {editError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-600">{editError}</p>
            </div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={editUploading}
            className="w-full py-3.5 rounded-xl text-[#065F2D] font-bold text-sm disabled:opacity-60"
            style={{ background: '#9DCD3A' }}
          >
            {editUploading ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </BottomSheet>

      <Dialog
        isOpen={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={handleLogout}
        title="Log Out"
        message="Are you sure you want to log out of Fenster?"
        confirmLabel="Log Out"
        variant="danger"
      />
      <Dialog
        isOpen={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={handleReset}
        title="Clear All Data"
        message="This will permanently delete all projects, tasks, leads, payments, and production data. The app will start fresh. Continue?"
        confirmLabel="Clear All"
        variant="danger"
      />

      <Snackbar isOpen={snack.open} message={snack.msg} type="info" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
