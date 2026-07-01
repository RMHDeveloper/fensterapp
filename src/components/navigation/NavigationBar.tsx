import { LayoutDashboard, CalendarCheck, FolderOpen, Layers, Settings, Users, MapPin, CheckSquare } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../types'

interface NavItem { icon: React.ElementType; label: string; path: string }

const ALL_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard'   },
  { icon: LayoutDashboard, label: 'Home',      path: '/home'        },
  { icon: CalendarCheck,   label: 'Today',     path: '/tasks'       },
  { icon: Users,           label: 'Leads',     path: '/leads'       },
  { icon: FolderOpen,      label: 'Projects',  path: '/projects'    },
  { icon: Layers,          label: 'Production',path: '/production'  },
  { icon: MapPin,          label: 'Visits',    path: '/site-visits' },
  { icon: CheckSquare,     label: 'Approvals', path: '/approvals'   },
  { icon: Settings,        label: 'Settings',  path: '/settings'    },
]

const ROLE_PATHS: Record<UserRole, string[]> = {
  // MD/ED: leads replace today; approvals in bar
  owner:                ['/dashboard', '/leads', '/approvals', '/projects', '/settings'],
  lead_manager:         ['/home', '/tasks', '/leads',       '/projects',   '/settings'],
  site_engineer:        ['/home', '/tasks', '/site-visits', '/projects',   '/settings'],
  production_admin:     ['/home', '/tasks', '/production',  '/projects',   '/settings'],
  production_manager:   ['/home', '/tasks', '/production',  '/projects',   '/settings'],
  technician:           ['/home', '/tasks', '/projects',    '/settings'],
  installation_incharge:['/home', '/tasks', '/projects',    '/settings'],  // legacy
  production_team:      ['/home', '/tasks', '/production',  '/projects',   '/settings'],
  viewer:               ['/home', '/projects', '/settings'],
}

function getNavPaths(user: { role: UserRole; displayRole?: string }): string[] {
  const base = ROLE_PATHS[user.role] ?? ['/home', '/settings']
  // Admin (owner role with Admin displayRole): remove today/tasks
  if (user.role === 'owner' && user.displayRole?.toLowerCase().includes('admin')) {
    return base.filter(p => p !== '/tasks')
  }
  return base
}

export function NavigationBar() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const { user }     = useAuth()

  const allowed = user ? getNavPaths(user) : ['/home', '/settings']
  const items   = allowed
    .map(path => ALL_ITEMS.find(i => i.path === path))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 5)

  return (
    <nav
      aria-label="Bottom navigation"
      className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-slate-200 shadow-nav z-40 safe-bottom"
    >
      <div className="flex items-center px-1">
        {items.map(({ icon: Icon, label, path }) => {
          const active = pathname === path || (path !== '/home' && pathname.startsWith(path))
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="flex-1 flex flex-col items-center gap-0.5 min-h-[56px] justify-center active:opacity-70"
            >
              <div
                className="w-11 h-8 flex items-center justify-center rounded-xl transition-colors duration-150"
                style={active ? { background: 'linear-gradient(135deg, #0B7A3B, #065F2D)' } : {}}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? 'text-white' : 'text-slate-400'}
                  aria-hidden="true"
                />
              </div>
              <span
                className={`text-[10px] font-semibold ${active ? '' : 'text-slate-400'}`}
                style={active ? { color: '#0B7A3B' } : {}}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
