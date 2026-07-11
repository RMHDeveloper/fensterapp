import {
  ChevronRight, AlertTriangle, Users, Layers,
  MapPin, CheckCircle2, Clock, CalendarCheck,
  FileText, Wallet, BarChart2, FolderOpen,
  Settings, XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { QuickAccessCard } from '../../components/cards/QuickAccessCard'
import { AppHeader } from '../../components/layout/AppHeader'
import { FlowTaskCard } from '../../components/cards/FlowTaskCard'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { ProjectCard } from '../../components/cards/ProjectCard'
import { EmptyState } from '../../components/feedback/EmptyState'
import { getRoleForStage } from '../../utils/workflow'
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

const PRE_PROD_STAGES = new Set(['production_sheet_preparation','production_admin_check','waiting_material_availability'])
const PROD_STAGES     = new Set(['production_manager_work','ready_to_dispatch'])
const INSTALL_STAGES  = new Set(['installation_assigned','installation','installation_in_progress'])

// Total tasks (any status) currently in this user's queue — flow tasks owned by
// any of their roles, plus regular tasks assigned to them (or unassigned, role-wide).
function isMineTask(t: Task, roles: UserRole[], userName: string | undefined): boolean {
  if (roles.includes('owner')) return true
  if (t.flowStage) {
    const stageRole = getRoleForStage(t.flowStage)
    if (!roles.includes(stageRole)) return false
    if (stageRole === 'site_engineer') return t.assignedTo === userName || t.siteEngineerName === userName
    if (stageRole === 'technician' || stageRole === 'installation_incharge') return t.assignedTo === userName || t.assignee === userName
    return true
  }
  const assignee = t.assignedTo || t.assignee
  return !assignee || assignee === userName
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tasks, leads, payments, projects, mistakes, updateTask } = useAppData()
  const [flowTaskId, setFlowTaskId] = useState<string | null>(null)
  const flowTask = flowTaskId ? (tasks.find(t => t.id === flowTaskId) ?? null) : null

  const role  = user?.role ?? 'viewer'
  const roles = user?.roles ?? [role]

  // LO project ownership — matches OwnerDashboardScreen's loStats matching,
  // since ownerId alone is often unset; fall back to ownerName / lead assignee.
  const isMyProject = (p: { ownerId?: string; ownerName?: string; leadId?: string }) =>
    p.ownerId === user?.id ||
    p.ownerName === user?.name ||
    (!!p.leadId && leads.some(l => l.id === p.leadId && l.assignee === user?.name))

  // Today tasks — regular tasks only (flow tasks handled separately by activeFTs)
  const todayTasks = tasks.filter(t => {
    if (t.flowStage) return false
    if (!(t.dueDate === 'Today' || t.status === 'overdue' || t.status === 'in_progress')) return false
    if (!roles.includes('owner')) {
      const assignee = t.assignedTo || t.assignee
      if (assignee && assignee !== user?.name) return false
    }
    return true
  })

  const openMistakes    = mistakes.filter(m => m.status === 'open').length
  const overduePayments = payments.filter(p => p.status === 'overdue').length
  const pendingTasks    = todayTasks.filter(t => t.status === 'pending' || t.status === 'overdue').length
  const doneCount       = tasks.filter(t => {
    if (t.status !== 'completed') return false
    if (!roles.includes('owner')) {
      const assignee = t.assignedTo || t.assignee
      if (assignee && assignee !== user?.name) return false
    }
    return true
  }).length

  // Role-filtered active project counts — union across every role this user holds
  const activeProjects = projects.filter(p => p.status === 'active')
  const roleProjects = (() => {
    if (roles.includes('owner')) return activeProjects
    const matchers: Partial<Record<UserRole, (p: typeof activeProjects[number]) => boolean>> = {
      lead_manager: p => isMyProject(p),
      site_engineer: p => tasks.some(t => t.projectId === p.id && (t.assignedTo === user?.name || t.siteEngineerName === user?.name)),
      production_admin: p => PRE_PROD_STAGES.has(p.currentStage ?? '') || PROD_STAGES.has(p.currentStage ?? ''),
      production_manager: p => PROD_STAGES.has(p.currentStage ?? ''),
      technician: p => INSTALL_STAGES.has(p.currentStage ?? '') || p.currentStage === 'ready_to_dispatch',
      installation_incharge: p => INSTALL_STAGES.has(p.currentStage ?? '') || p.currentStage === 'ready_to_dispatch',
    }
    const active = roles.map(r => matchers[r]).filter((fn): fn is NonNullable<typeof fn> => !!fn)
    if (active.length === 0) return activeProjects
    return activeProjects.filter(p => active.some(fn => fn(p)))
  })()

  // LO: rejected quotations count (MD rejected the quotation)
  const rejectedQuotations = tasks.filter(t => {
    if (t.flowStage !== 'owner_approval' || t.flowStatus !== 'rejected') return false
    if (t.projectId) {
      const proj = projects.find(p => p.id === t.projectId)
      if (proj && !isMyProject(proj)) return false
    }
    return true
  }).length

  // LO: projects owned by this user
  const myProjectIds = new Set(projects.filter(isMyProject).map(p => p.id))

  // "Ready for Next Step" flow tasks — lifted to component scope (not just
  // the render-time IIFE below) so the DemoFlowSheet popup can offer
  // Previous/Next navigation through the same list it was opened from.
  const isAssignedToFTMe = (t: Task) =>
    t.assignedTo === user?.name || t.assignedTo === user?.id ||
    t.assignee   === user?.name || t.assignee   === user?.id ||
    t.siteEngineerName === user?.name
  const FT_MATCHERS: Partial<Record<UserRole, (t: Task) => boolean>> = {
    site_engineer:      t => t.flowStage === 'site_visit' && isAssignedToFTMe(t),
    owner:              t => t.flowStage === 'owner_approval' || t.flowStage === 'reschedule_review' || (t.flowStage === 'site_visit' && t.flowStatus === 'reschedule_requested'),
    production_admin:   t => t.flowStage === 'production_check' || t.flowStage === 'admin_availability_check',
    production_manager: t => t.flowStage === 'production_work',
    production_team:    t => t.flowStage === 'production_check' || t.flowStage === 'production_work',
    site_engineer_lead: t => t.flowStage === 'site_lead_approval',
    technician:            t => (t.flowStage === 'installation_assign' || t.flowStage === 'installation_update') && isAssignedToFTMe(t),
    installation_incharge: t => (t.flowStage === 'installation_assign' || t.flowStage === 'installation_update') && isAssignedToFTMe(t),
    lead_manager:        t => myProjectIds.has(t.projectId),
  }
  const activeFTsRaw = tasks.filter(t => {
    if (t.flowStage == null || t.flowStage === 'completed') return false
    return roles.some(r => FT_MATCHERS[r]?.(t) ?? false)
  })
  // Guard against duplicate flow tasks on the same project (should never
  // happen — one evolving task drives each project — but if stray extra
  // tasks exist, only show the most recently created one per project
  // instead of confusing duplicate cards).
  const activeFTs = Array.from(
    activeFTsRaw.reduce((map, t) => {
      const key = t.projectId ?? t.id
      const existing = map.get(key)
      if (!existing || (t.createdAt ?? '') >= (existing.createdAt ?? '')) map.set(key, t)
      return map
    }, new Map<string, Task>()).values()
  )

  // LO: pending flow tasks (any active flow stage in their projects)
  const loPendingFlow = role === 'lead_manager'
    ? tasks.filter(t => t.flowStage && t.flowStage !== 'completed' && myProjectIds.has(t.projectId)).length
    : 0

  // LO: total tasks (any stage) tied to their own projects
  const loTaskCount = tasks.filter(t => myProjectIds.has(t.projectId)).length

  // LO: total projects owned by this user, regardless of status
  const loAllProjects = projects.filter(isMyProject)

  // LO: quotations sent to client, awaiting the client's decision
  const quotationsWaitingClient = tasks.filter(t =>
    t.flowStage === 'send_to_client' && t.flowStatus === 'waiting_response' &&
    t.projectId && myProjectIds.has(t.projectId)
  ).length

  // Site engineer: assigned site visits
  const myVisits = tasks.filter(t =>
    t.flowStage === 'site_visit' &&
    (t.assignedTo === user?.name || t.siteEngineerName === user?.name)
  ).length

  // Production admin: tasks pending check
  const toCheckCount = tasks.filter(t => t.flowStage === 'production_check').length
  // Production manager / team: tasks in production
  const inProdCount  = tasks.filter(t => t.flowStage === 'production_work').length
  // Technician: their own installation work (not the LM's "assign installer" step)
  const installCount = tasks.filter(t =>
    t.flowStage === 'installation_update' &&
    (t.assignedTo === user?.name || t.assignee === user?.name)
  ).length
  // Site Engineer Lead: installation availability approvals awaiting their decision
  const siteLeadApprovalCount = tasks.filter(t => t.flowStage === 'site_lead_approval').length

  // Total tasks (any status) assigned to this user, across regular + flow-stage tasks
  const myTaskCount = tasks.filter(t => isMineTask(t, roles, user?.name)).length

  // Compact 4-stat rows per role
  const STATS: Record<UserRole, StatItem[]> = {
    owner: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',   iconBg: 'bg-blue-100',   value: pendingTasks,          label: 'Tasks',    link: '/tasks'      },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',   iconBg: 'bg-cyan-100',   value: roleProjects.length,   label: 'Projects', link: '/projects'   },
      { icon: Wallet,        iconColor: overduePayments > 0 ? 'text-red-600' : 'text-teal-600', iconBg: overduePayments > 0 ? 'bg-red-100' : 'bg-teal-100', value: overduePayments, label: 'Overdue', link: '/payments' },
      { icon: AlertTriangle, iconColor: 'text-orange-600', iconBg: 'bg-orange-100', value: openMistakes,          label: 'Problems', link: '/mistakes'   },
    ],
    lead_manager: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',   iconBg: 'bg-blue-100',   value: loTaskCount,             label: 'Tasks',      link: '/tasks'       },
      { icon: XCircle,       iconColor: 'text-red-600',    iconBg: 'bg-red-100',    value: rejectedQuotations,     label: 'Rejected',   link: '/projects'    },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',   iconBg: 'bg-cyan-100',   value: loAllProjects.length,   label: 'Projects',   link: '/projects'    },
      { icon: FileText,      iconColor: 'text-indigo-600', iconBg: 'bg-indigo-100', value: quotationsWaitingClient, label: 'Quotations', link: '/quotations'  },
    ],
    site_engineer: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: myTaskCount,           label: 'Tasks',   link: '/tasks'       },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  value: myVisits,              label: 'Visits',  link: '/site-visits' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks,          label: 'Pending', link: '/tasks'       },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,             label: 'Done',    link: '/tasks'       },
    ],
    site_engineer_lead: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: myTaskCount,           label: 'Tasks',     link: '/tasks' },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  value: siteLeadApprovalCount, label: 'Approvals', link: '/tasks' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks,          label: 'Pending',   link: '/tasks' },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,             label: 'Done',      link: '/tasks' },
    ],
    production_admin: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: myTaskCount,           label: 'Tasks',     link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   value: toCheckCount,          label: 'To Check',  link: '/production' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks,          label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,             label: 'Done',      link: '/tasks'      },
    ],
    production_manager: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: myTaskCount,           label: 'Tasks',     link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   value: inProdCount,           label: 'In Prod',   link: '/production' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks,          label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,             label: 'Done',      link: '/tasks'      },
    ],
    technician: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: myTaskCount,           label: 'Tasks',     link: '/tasks'      },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  value: installCount,          label: 'Installs',  link: '/projects'   },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks,          label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,             label: 'Done',      link: '/tasks'      },
    ],
    installation_incharge: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: myTaskCount,           label: 'Tasks',     link: '/tasks'      },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  value: installCount,          label: 'Installs',  link: '/projects'   },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks,          label: 'Pending',   link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,             label: 'Done',      link: '/tasks'      },
    ],
    production_team: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    value: myTaskCount,           label: 'Tasks',    link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   value: inProdCount,           label: 'In Prod',  link: '/production' },
      { icon: Clock,         iconColor: 'text-red-600',     iconBg: 'bg-red-100',     value: pendingTasks,          label: 'Pending',  link: '/tasks'      },
      { icon: CheckCircle2,  iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', value: doneCount,             label: 'Done',     link: '/tasks'      },
    ],
    viewer: [
      { icon: FolderOpen,   iconColor: 'text-cyan-600',   iconBg: 'bg-cyan-100',   value: roleProjects.length,   label: 'Projects', link: '/projects' },
      { icon: Users,        iconColor: 'text-purple-600', iconBg: 'bg-purple-100', value: leads.length,          label: 'Leads',    link: '/leads'    },
      { icon: BarChart2,    iconColor: 'text-pink-600',   iconBg: 'bg-pink-100',   value: 0,                     label: 'Reports',  link: '/reports'  },
      { icon: FolderOpen,   iconColor: 'text-slate-600',  iconBg: 'bg-slate-100',  value: 0,                     label: 'Files',    link: '/files'    },
    ],
  }

  // Quick access per role
  const QUICK: Record<UserRole, QuickItem[]> = {
    owner: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Pending',     link: '/tasks'      },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'   },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   label: 'Production',  link: '/production' },
      { icon: BarChart2,     iconColor: 'text-pink-600',    iconBg: 'bg-pink-100',    label: 'Reports',     link: '/reports'    },
    ],
    lead_manager: [
      { icon: Users,         iconColor: 'text-purple-600',  iconBg: 'bg-purple-100',  label: 'Leads',       link: '/leads'       },
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Pending',     link: '/tasks'       },
      { icon: FileText,      iconColor: 'text-indigo-600',  iconBg: 'bg-indigo-100',  label: 'Quotations',  link: '/quotations'  },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'    },
    ],
    site_engineer: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Today Work',  link: '/tasks'       },
      { icon: MapPin,        iconColor: 'text-orange-600',  iconBg: 'bg-orange-100',  label: 'Site Visits', link: '/site-visits' },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'       },
      { icon: Settings,      iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Settings',    link: '/settings'    },
    ],
    site_engineer_lead: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Approvals',   link: '/tasks'      },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'   },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'      },
      { icon: Settings,      iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Settings',    link: '/settings'   },
    ],
    production_admin: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Pending',     link: '/tasks'      },
      { icon: Layers,        iconColor: 'text-amber-600',   iconBg: 'bg-amber-100',   label: 'Production',  link: '/production' },
      { icon: FolderOpen,    iconColor: 'text-cyan-600',    iconBg: 'bg-cyan-100',    label: 'Projects',    link: '/projects'   },
      { icon: FolderOpen,    iconColor: 'text-slate-600',   iconBg: 'bg-slate-100',   label: 'Files',       link: '/files'      },
    ],
    production_manager: [
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Pending',     link: '/tasks'      },
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
      { icon: CalendarCheck, iconColor: 'text-blue-600',    iconBg: 'bg-blue-100',    label: 'Pending',     link: '/tasks'      },
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
      <AppHeader />

      <div className="px-4 lg:px-6 pt-4 lg:pt-6 space-y-5 lg:max-w-3xl lg:mx-auto">

        {/* LO Pending box ─────────────────────────────────────────────────────── */}
        {role === 'lead_manager' && (
          <button
            onClick={() => navigate('/tasks')}
            className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 flex items-center justify-between active:opacity-80"
          >
            <div className="text-left">
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Pending</p>
              <p className="text-3xl font-extrabold text-amber-700 leading-none">{loPendingFlow}</p>
              <p className="text-xs text-amber-500 mt-1">active project tasks</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Done</p>
              <p className="text-3xl font-extrabold text-emerald-600 leading-none">{doneCount}</p>
              <p className="text-xs text-slate-400 mt-1">completed</p>
            </div>
          </button>
        )}

        {/* 1. Compact stat row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={i}
                className="bg-white rounded-xl p-2.5 text-center border border-slate-100 shadow-sm"
              >
                <div className={`w-7 h-7 ${s.iconBg} rounded-lg flex items-center justify-center mx-auto mb-1.5`}>
                  <Icon size={14} className={s.iconColor} strokeWidth={2.2} aria-hidden="true" />
                </div>
                <p className="text-xl font-extrabold text-slate-800 leading-none">{s.value}</p>
                <p className="text-[9px] font-semibold text-slate-400 mt-1 leading-tight">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* 3. Flow Tasks ──────────────────────────────────────────────────────── */}
        {(() => {
          if (activeFTs.length === 0) return null
          return (
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center">
                  <CalendarCheck size={13} className="text-blue-600" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-800">Ready for Next Step</h2>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  {activeFTs.length}
                </span>
              </div>
              {activeFTs.slice(0, 3).map(t => (
                <FlowTaskCard key={t.id} task={t} role={role} onClick={() => setFlowTaskId(t.id)} />
              ))}
            </section>
          )
        })()}

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
            {roleProjects.length === 0 ? (
              <EmptyState title="No active projects" message="Projects will appear here once created." />
            ) : (
              <div className="space-y-2.5">
                {roleProjects.slice(0, 2).map((project, idx) => (
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


      </div>

      {flowTask && (
        <DemoFlowSheet
          isOpen={!!flowTask}
          onClose={() => setFlowTaskId(null)}
          task={flowTask}
          onUpdate={(updates) => {
            updateTask(flowTask!.id, updates)
            setFlowTaskId(null)
          }}
        />
      )}
    </div>
  )
}
