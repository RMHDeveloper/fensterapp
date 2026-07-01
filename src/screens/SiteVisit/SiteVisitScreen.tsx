import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import type { Task } from '../../types'

type Filter = 'all' | 'scheduled' | 'completed' | 'cancelled'

function isMapUrl(s: string | undefined | null): boolean {
  return Boolean(s && /^https?:\/\//i.test(s.trim()))
}
function getVisitMapUrl(task: Task): string {
  if (task.locationPin?.mapLink?.trim()) return task.locationPin.mapLink.trim()
  if (task.location && isMapUrl(task.location)) return task.location.trim()
  const addr = task.location?.trim() ?? ''
  if (addr) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
  return ''
}
function getVisitReadableLocation(task: Task): string {
  if (task.locationPin?.label?.trim()) return task.locationPin.label.trim()
  if (task.location && !isMapUrl(task.location)) return task.location.trim()
  return ''
}

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'All'       },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function visitStatus(task: Task): Filter {
  if (task.status === 'completed' || task.flowStage === 'completed') return 'completed'
  if (task.flowStatus === 'dropped' || task.status === 'overdue') return 'cancelled'
  return 'scheduled'
}

export default function SiteVisitScreen() {
  const { user }                           = useAuth()
  const { tasks, updateTask }              = useAppData()
  const [filter, setFilter]                = useState<Filter>('all')
  const [flowTask, setFlowTask]            = useState<Task | null>(null)
  const [snack, setSnack]                  = useState({ open: false, msg: '' })

  const role = user?.role ?? 'viewer'

  // Find all site-visit-related tasks (flow tasks or regular site_visit type)
  const visitTasks = tasks.filter(t => {
    // Match by flowStage (flow tasks) OR by task.type for regular tasks
    const isSiteStage = t.flowStage
      ? ['site_visit', 'site_assign', 'reschedule_review'].includes(t.flowStage)
      : t.type === 'site_visit'
    if (!isSiteStage) return false

    if (role === 'site_engineer') {
      // If assignedTo is set — only show to the named person
      if (t.assignedTo) return t.assignedTo === user?.name
      // If siteEngineerName is set — only show to the named engineer
      if (t.siteEngineerName) return t.siteEngineerName === user?.name
      // If assigned to site_engineer role explicitly — show to all SEs
      if (t.assignedRole === 'site_engineer' || t.roleOwner === 'site_engineer') return true
      // Unassigned site visit — show to all site engineers
      return true
    }
    return true
  })

  const filtered = visitTasks.filter(t => {
    if (filter === 'all') return true
    return visitStatus(t) === filter
  })

  function handleFlowUpdate(updates: Partial<Task>) {
    if (!flowTask) return
    updateTask(flowTask.id, updates)
    setSnack({ open: true, msg: 'Site visit updated!' })
    setFlowTask(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />

      <div className="bg-white px-4 pt-3.5 pb-3.5 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center gap-2 mb-3">
          <BackButton />
          <div>
            <h1 className="text-base font-extrabold text-slate-800">Site Visits</h1>
            <p className="text-xs text-slate-500">
              {visitTasks.filter(t => visitStatus(t) === 'scheduled').length} upcoming
            </p>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CHIPS.map(c => (
            <button key={c.value} onClick={() => setFilter(c.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === c.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3.5 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="mt-10 text-center">
            <MapPin size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">No site visits found</p>
            <p className="text-xs text-slate-400 mt-1">
              {filter === 'all' ? 'Create a project to schedule a site visit.' : `No ${filter} visits.`}
            </p>
          </div>
        ) : (
          filtered.map(task => (
            <button key={task.id} onClick={() => setFlowTask(task)}
              className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-100 p-4 active:scale-[0.98] transition-transform">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-800 mb-0.5">{task.projectName}</h3>
                  <p className="text-xs text-slate-500 mb-2">{task.clientName}</p>
                  {(task.location || task.locationPin?.mapLink) && (() => {
                    const readable = getVisitReadableLocation(task)
                    const mapUrl   = getVisitMapUrl(task)
                    return (
                      <div className="mb-1.5">
                        {readable ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                            <MapPin size={11} />
                            <span>{readable}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                            <MapPin size={11} />
                            <span>Site location pinned</span>
                          </div>
                        )}
                        {mapUrl && (
                          <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 active:scale-95 transition-transform">
                            <Navigation size={9} />
                            View in Google Maps
                          </a>
                        )}
                      </div>
                    )
                  })()}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                    {(task.visitDate || task.requestedVisitDate) && (
                      <span>📅 {task.flowStatus === 'reschedule_approved' && task.requestedVisitDate ? task.requestedVisitDate : task.visitDate}</span>
                    )}
                    {task.visitTime && <span>⏰ {task.visitTime}</span>}
                    {task.siteEngineerName && <span>👷 {task.siteEngineerName}</span>}
                  </div>
                  {task.flowStatus === 'reschedule_requested' && (
                    <div className="mt-1.5 inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5">
                      <span className="text-[10px] font-bold text-amber-700">Reschedule Pending Approval</span>
                    </div>
                  )}
                  {task.flowStatus === 'reschedule_approved' && (
                    <div className="mt-1.5 inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                      <span className="text-[10px] font-bold text-emerald-700">Reschedule Approved</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={task.status} size="xs" />
                  {task.flowStage === 'site_visit' && (
                    <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">VISIT</span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {flowTask && (
        <DemoFlowSheet
          isOpen={!!flowTask}
          onClose={() => setFlowTask(null)}
          task={flowTask}
          onUpdate={handleFlowUpdate}
        />
      )}

      <Snackbar isOpen={snack.open} message={snack.msg} type="success"
        onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
