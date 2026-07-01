import {
  Home, CalendarCheck, FolderOpen, Layers, Wallet,
  BarChart2, Settings, Users, MapPin, FileText,
  Wrench, AlertTriangle, CheckSquare, LogOut, File,
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../data/permissions'
import type { Permission } from '../../types'

interface NavItem {
  icon: React.ElementType
  label: string
  path: string
  permission: Permission
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Main',
    items: [
      { icon: Home,          label: 'Task',        path: '/home',         permission: 'view_home'     },
      { icon: CalendarCheck, label: 'Today Work',  path: '/tasks',        permission: 'view_today'    },
      { icon: FolderOpen,    label: 'Projects',    path: '/projects',     permission: 'view_projects' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { icon: Users,         label: 'Leads',        path: '/leads',        permission: 'view_leads'       },
      { icon: MapPin,        label: 'Site Visits',  path: '/site-visits',  permission: 'view_site_visit'  },
      { icon: FileText,      label: 'Quotations',   path: '/quotations',   permission: 'view_quotation'   },
      { icon: File,          label: 'Orders',       path: '/orders',       permission: 'view_orders'      },
      { icon: Layers,        label: 'Production',   path: '/production',   permission: 'view_production'  },
      { icon: CheckSquare,   label: 'Delivery QC',  path: '/delivery-qc',  permission: 'view_delivery_qc' },
      { icon: AlertTriangle, label: 'Problems',     path: '/mistakes',     permission: 'view_mistakes'    },
      { icon: Wallet,        label: 'Payments',     path: '/payments',     permission: 'view_payments'    },
      { icon: Wrench,        label: 'Installation', path: '/installation', permission: 'view_installation'},
      { icon: File,          label: 'Files',        path: '/files',        permission: 'view_files'       },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { icon: BarChart2, label: 'Reports',  path: '/reports',  permission: 'view_reports'  },
      { icon: Settings,  label: 'Settings', path: '/settings', permission: 'view_settings' },
    ],
  },
]

export function SidebarNavigation() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const { user, can, logout } = useAuth()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="hidden lg:flex fixed left-0 top-0 h-screen w-[260px] bg-white border-r border-slate-200 flex-col z-40">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-slate-100 flex-shrink-0">
        <img
          src="/brand/fenster-logo.png"
          alt="Fenster"
          className="object-contain"
          style={{ height: 30, maxWidth: 180 }}
        />
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {NAV_SECTIONS.map(section => {
          const visible = section.items.filter(i => can(i.permission))
          if (visible.length === 0) return null
          return (
            <div key={section.label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map(({ icon: Icon, label, path }) => {
                  const active = pathname === path || (path !== '/home' && pathname.startsWith(path))
                  return (
                    <button
                      key={path}
                      onClick={() => navigate(path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors active:opacity-80
                        ${active ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                      style={active ? { background: 'linear-gradient(135deg, #0B7A3B, #065F2D)' } : {}}
                    >
                      <Icon
                        size={17}
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
      </nav>

      {/* User profile */}
      <div className="px-4 py-4 border-t border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
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
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
