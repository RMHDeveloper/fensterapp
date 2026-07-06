import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../data/permissions'
import { BottomSheet } from '../feedback/BottomSheet'
import { getMainItems, NAV_SECTIONS } from './navItems'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function MobileMenuDrawer({ isOpen, onClose }: Props) {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const { user, can, logout } = useAuth()

  const isOwner  = user?.role === 'owner'
  const sections = [{ label: 'Main', items: getMainItems(isOwner) }, ...NAV_SECTIONS]

  function go(path: string) {
    navigate(path)
    onClose()
  }

  function handleLogout() {
    logout()
    onClose()
    navigate('/login', { replace: true })
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Menu" height="full">
      <div className="space-y-5 pb-2">
        {sections.map(section => {
          const visible = section.items.filter(i => can(i.permission))
          if (visible.length === 0) return null
          return (
            <div key={section.label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map(({ icon: Icon, label, path }) => {
                  const active = pathname === path || (path !== '/home' && pathname.startsWith(path))
                  return (
                    <button
                      key={path}
                      onClick={() => go(path)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-left transition-colors active:opacity-80
                        ${active ? 'text-white' : 'text-slate-600 active:bg-slate-100'}`}
                      style={active ? { background: 'linear-gradient(135deg, #0B7A3B, #065F2D)' } : {}}
                    >
                      <Icon
                        size={18}
                        strokeWidth={active ? 2.5 : 1.8}
                        className={active ? 'text-white' : 'text-slate-400'}
                      />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0B7A3B, #065F2D)' }}
            >
              <span className="text-white text-xs font-extrabold">{user?.initials ?? '?'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.name ?? 'Guest'}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {user ? (user.displayRole ?? ROLE_LABELS[user.role]) : ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-lg active:bg-red-50 text-slate-400 active:text-red-500 transition-colors"
              aria-label="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
