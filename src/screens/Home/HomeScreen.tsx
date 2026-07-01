import {
  ChevronRight, AlertTriangle, Users, Layers,
  MapPin, CheckCircle2, Clock, CalendarCheck,
  FileText, Wallet, BarChart2, FolderOpen,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { QuickAccessCard } from '../../components/cards/QuickAccessCard'
import { AppHeader } from '../../components/layout/AppHeader'
import { TodayTaskRow } from '../../components/cards/TodayTaskRow'
import { FlowTaskCard } from '../../components/cards/FlowTaskCard'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { ProjectCard } from '../../components/cards/ProjectCard'
import { EmptyState } from '../../components/feedback/EmptyState'
import type { Task, UserRole } from '../../types'
import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

interface StatItem {
  icon: ComponentType<LucideProps>
  iconColor: string
  iconBg: string
  value: number
  label: string
  link?: string
}

interface QuickItem {
  icon: ComponentType<LucideProps>
  iconColor: string
  iconBg: string
  label: string
  link: string
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tasks, leads, payments, projects, mistakes, updateTask } = useAppData()
  const [flowTask, setFlowTask] = useState<Task | null>(null)

  const role            = user?.role ?? 'viewer'
  const todayTasks      = tasks.filter(t => t.dueDate === 'Today' || t.status === 'overdue' || t.status === 'in_progress')
  const activeProjects  = projects.filter(p => p.status === 'active')
  const openMistakes    = mistakes.filter(m => m.status === 'open').length
  const overduePayments = payments.filter(p => p.status === 'overdue').length
  const newLeads        = leads.filter(l => l.status === 'new').length
  const pendingTasks    = todayTasks.filter(t => t.status === 'pending' || t.status === 'overdue').length
  const doneCount       = tasks.filter(t => t.status === 'completed').length

  // Compact 4-stat rows per role
  const STATS: Record<UserRole, StatItem[]> = {
    owner: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',   iconBg: 'bg-blue-100',   value: pendingTasks,            label: 'Tasks',    link: '/tasks'      },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',   iconBg: 'bg-cyan-100',   value: activeProjects.length,   label: 'Projects', link: '/projects'   },
      { icon: Wallet,        iconColor: overduePayments > 0 ? 'text-red-600' : 'text-teal-600', iconBg: overduePayments > 0 ? 'bg-red-100' : 'bg-teal-100', value: overduePayments, label: 'Overdue', link: '/payments' },
      { icon: AlertTriangle, iconColor: 'text-orange-600', iconBg: 'bg-orange-100', value: openMistakes,            label: 'Problems', link: '/mistakes'   },
    ],
    lead_manager: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',   iconBg: 'bg-blue-100',   value: pendingTasks,          label: 'Tasks',      link: '/tasks'       },
      { icon: Users,         iconColor: 'text-purple-600', iconBg: 'bg-purple-100', value: newLeads,              label: 'New Leads',  link: '/leads'       },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',   iconBg: 'bg-cyan-100',   value: activeProjects.length, label: 'Projects',   link: '/projects'    },
      { icon: FileText,      iconColor: 'text-indigo-600', iconBg: 'bg-indigo-100', value: 3,                     label: 'Quotations', link: '/quotations'  },
    ],
    site_engineer: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: pendingTasks, label: 'Tasks',   link: '/tasks'       },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  value: 2,            label: 'Visits',  link: '/site-visits' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks, label: 'Pending', link: '/tasks'       },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,    label: 'Done',    link: '/tasks'       },
    ],
    production_admin: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: pendingTasks, label: 'Tasks',     link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   value: 5,            label: 'To Check',  link: '/production' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks, label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,    label: 'Done',      link: '/tasks'      },
    ],
    production_manager: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: pendingTasks, label: 'Tasks',     link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   value: 5,            label: 'In Prod',   link: '/production' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks, label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,    label: 'Done',      link: '/tasks'      },
    ],
    technician: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: pendingTasks, label: 'Tasks',     link: '/tasks'      },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  value: 2,            label: 'Installs',  link: '/projects'   },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks, label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,    label: 'Done',      link: '/tasks'      },
    ],
    installation_incharge: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: pendingTasks, label: 'Tasks',     link: '/tasks'      },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  value: 2,            label: 'Installs',  link: '/projects'   },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks, label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,    label: 'Done',      link: '/tasks'      },
    ],
    production_team: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: pendingTasks, label: 'Tasks',    link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   value: 5,            label: 'In Prod',  link: '/production' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks, label: 'Pending',  link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,    label: 'Done',     link: '/tasks'      },
    ],
    viewer: [
      { icon: FolderOpen,   iconColor: 'text-cyan-600',   iconBg: 'bg-cyan-100',   value: activeProjects.length, label: 'Projects', link: '/projects' },
      { icon: Users,        iconColor: 'text-purple-600', iconBg: 'bg-purple-100', value: leads.length,          label: 'Leads',    link: '/leads'    },
      { icon: BarChart2,    iconColor: 'text-pink-600',   iconBg: 'bg-pink-100',   value: 12,                    label: 'Reports',  link: '/reports'  },
      { icon: FolderOpen,   iconColor: 'text-slate-600',  iconBg: 'bg-slate-100',  value: 8,                     label: 'Files',    link: '/files'    },
    ],
  }

  // Quick access per role
  const QUICK: Record<UserRole, QuickItem[]> = {
    owner: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'      },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'   },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   label: 'Production',  link: '/production' },
      { icon: BarChart2,     iconColor: 'text-pink-600',    iconBg: 'bg-pink-100',    label: 'Reports',     link: '/reports'    },
    ],
    lead_manager: [
      { icon: Users,         iconColor: 'text-purple-600',  iconBg: 'bg-purple-100',  label: 'Leads',       link: '/leads'       },
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'       },
      { icon: FileText,      iconColor: 'text-indigo-600',  iconBg: 'bg-indigo-100',  label: 'Quotations',  link: '/quotations'  },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'    },
    ],
    site_engineer: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'       },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  label: 'Site Visits', link: '/site-visits' },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'       },
      { icon: Settings,      iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Settings',    link: '/settings'    },
    ],
    production_admin: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   label: 'Production',  link: '/production' },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'   },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'      },
    ],
    production_manager: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   label: 'Production',  link: '/production' },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'   },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'      },
    ],
    technician: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'      },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  label: 'Installs',    link: '/projects'   },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'      },
      { icon: Settings,      iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Settings',    link: '/settings'   },
    ],
    installation_incharge: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'      },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  label: 'Installs',    link: '/projects'   },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'      },
      { icon: Settings,      iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Settings',    link: '/settings'   },
    ],
    production_team: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   label: 'Production',  link: '/production' },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'   },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'      },
    ],
    viewer: [
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects' },
      { icon: BarChart2,     iconColor: 'text-pink-600',    iconBg: 'bg-pink-100',    label: 'Reports',     link: '/reports'  },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'    },
      { icon: Settings,      iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Settings',    link: '/settings' },
    ],
  }

  const stats = STATS[role]
  const quick = QUICK[role]

  return (
    <div className="min-h-screen bg-[#f8f9fa] lg:bg-[#f0f2f5] pb-24 lg:pb-8">
      <AppHeader notifications={openMistakes + overduePayments} />

      <div className="px-4 lg:px-6 pt-4 lg:pt-6 space-y-5 lg:max-w-3xl lg:mx-auto">

        {/* 1. Compact stat row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <button
                key={i}
                onClick={() => s.link && navigate(s.link)}
                className="bg-white rounded-xl p-2.5 text-center border border-slate-100 shadow-sm active:scale-95 active:bg-slate-50 transition-all duration-100"
              >
                <div className={`w-7 h-7 ${s.iconBg} rounded-lg flex items-center justify-center mx-auto mb-1.5`}>
                  <Icon size={14} className={s.iconColor} strokeWidth={2.2} aria-hidden="true" />
                </div>
                <p className="text-xl font-extrabold text-slate-800 leading-none">{s.value}</p>
                <p className="text-[9px] font-semibold text-slate-400 mt-1 leading-tight">{s.label}</p>
              </button>
            )
          })}
        </div>

        {/* 3. Flow Tasks (Demo) ────────────────────────────────────────────────── */}
        {(() => {
          const activeFTs = tasks.filter(t => t.flowStage != null && t.flowStage !== 'completed')
          if (activeFTs.length === 0) return null
          return (
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
                    <CalendarCheck size={13} className="text-blue-600" aria-hidden="true" />
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-800">Ready for Next Step</h2>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                    {activeFTs.length}
                  </span>
                </div>
                <button onClick={() => navigate('/tasks')} className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 min-h-[36px] active:opacity-70">
                  See all <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
              {activeFTs.slice(0, 3).map(t => (
                <FlowTaskCard key={t.id} task={t} onClick={() => setFlowTask(t)} />
              ))}
            </section>
          )
        })()}

        {/* 4. Today Work ───────────────────────────────────────────────────────── */}
        <PermissionGate permission="view_today">
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
                  <Clock size={13} className="text-blue-600" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-800">Today Work</h2>
                {pendingTasks > 0 && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    {pendingTasks} pending
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/tasks')}
                className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 min-h-[36px] active:opacity-70"
              >
                See all <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {todayTasks.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <CheckCircle2 size={28} className="text-emerald-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs font-semibold text-slate-400">No work assigned for today.</p>
                </div>
              ) : (
                todayTasks.slice(0, 4).map((task, idx) => (
                  <TodayTaskRow
                    key={task.id}
                    task={task}
                    onClick={() => navigate(`/task/${task.id}`)}
                    isLast={idx === Math.min(todayTasks.length, 4) - 1}
                  />
                ))
              )}
            </div>
          </section>
        </PermissionGate>

        {/* 4. Active Projects — compact, 1 card ───────────────────────────────── */}
        <PermissionGate permission="view_projects">
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-cyan-100 rounded-md flex items-center justify-center">
                  <FolderOpen size={13} className="text-cyan-600" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-800">Active Projects</h2>
              </div>
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 min-h-[36px] active:opacity-70"
              >
                Manage <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
            {activeProjects.length === 0 ? (
              <EmptyState title="No active projects" message="Projects will appear here once created." />
            ) : (
              <div className="space-y-2.5">
                {activeProjects.slice(0, 2).map((project, idx) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    gradientIndex={idx}
                    onClick={() => navigate(`/project/${project.id}`)}
                  />
                ))}
              </div>
            )}
          </section>
        </PermissionGate>

        {/* 5. Quick Access — all roles ─────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Quick Access</p>
          <div className="grid grid-cols-4 gap-2">
            {quick.map((q, i) => (
              <QuickAccessCard
                key={i}
                icon={q.icon}
                iconColor={q.iconColor}
                iconBg={q.iconBg}
                label={q.label}
                onClick={() => navigate(q.link)}
              />
            ))}
          </div>
        </section>

      </div>

      {flowTask && (
        <DemoFlowSheet
          isOpen={!!flowTask}
          onClose={() => setFlowTask(null)}
          task={flowTask}
          onUpdate={(updates) => {
            updateTask(flowTask.id, updates)
            setFlowTask(null)
          }}
        />
      )}
    </div>
  )
}
