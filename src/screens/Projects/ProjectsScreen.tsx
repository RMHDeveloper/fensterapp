import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, FileDown } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { ProjectRow } from '../../components/cards/ProjectRow'
import { FilterChips } from '../../components/forms/FilterChips'
import { SearchBar } from '../../components/forms/SearchBar'
import { FloatingActionButton } from '../../components/navigation/FloatingActionButton'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { EmptyState } from '../../components/feedback/EmptyState'
import { AppHeader } from '../../components/layout/AppHeader'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { createProjectFromForm, createSiteAssignTask } from '../../utils/workflow'
import { loadManagedUsers } from '../../utils/userStorage'
import type { Project } from '../../types'

type Filter = 'active' | 'pre_production' | 'production' | 'ready_to_dispatch' | 'installation' | 'collection' | 'completed'

function getChipsForRole(role?: string): { value: Filter; label: string }[] {
  if (role === 'production_admin') return [
    { value: 'active',         label: 'Active'        },
    { value: 'pre_production', label: 'Pre-Production' },
    { value: 'production',     label: 'Production'    },
  ]
  if (role === 'production_manager') return [
    { value: 'production',        label: 'Production'       },
    { value: 'ready_to_dispatch', label: 'Ready to Dispatch' },
  ]
  if (role === 'technician' || role === 'installation_incharge') return [
    { value: 'ready_to_dispatch', label: 'Ready to Dispatch' },
    { value: 'installation',      label: 'Installation'      },
  ]
  return [
    { value: 'active',            label: 'Active'            },
    { value: 'pre_production',    label: 'Pre-Production'    },
    { value: 'production',        label: 'Production'        },
    { value: 'ready_to_dispatch', label: 'Ready to Dispatch' },
    { value: 'installation',      label: 'Installation'      },
    { value: 'collection',        label: 'Collection'        },
    { value: 'completed',         label: 'Complete'          },
  ]
}

const MEASUREMENT_STAGES = new Set([
  'new_project','measurement','site_visit_assigned','site_visit','site_visit_completed',
  'waiting_site_visit_review','reschedule_requested','reschedule_approved'
])
const QUOTATION_STAGES = new Set([
  'quotation_preparation','quotation_sent_owner','quotation_sent_md_ed','owner_approved',
  'md_ed_approved','sent_to_client','waiting_client_approval','quotation_rework'
])
const NEGOTIATION_STAGES = new Set([
  'negotiation','client_approved','advance_payment','client_rejected','client_not_approved',
  'advance_payment_pending','waiting_advance_payment','owner_disapproved','md_ed_rejected'
])
// Lead-originated projects stay in the Leads screen until advance payment is received (production_admin_check or later)
const LEAD_PIPELINE_STAGES = new Set([
  'new_project','measurement','site_visit_assigned','site_visit','site_visit_completed',
  'waiting_site_visit_review','reschedule_requested','reschedule_approved',
  'quotation_preparation','quotation_sent_owner','quotation_sent_md_ed','owner_approved',
  'owner_disapproved','md_ed_approved','md_ed_rejected','sent_to_client',
  'waiting_client_approval','quotation_rework','client_approved','client_rejected',
  'client_not_approved','negotiation','advance_payment','advance_payment_pending','waiting_advance_payment',
])
const PRE_PRODUCTION_STAGES = new Set([
  'production_sheet_preparation','production_admin_check','waiting_material_availability'
])
// For production_admin / production_manager: only PM work stages
const PRODUCTION_PM_STAGES = new Set([
  'production_manager_work','ready_to_dispatch'
])
// For owner/lead_manager "Production" filter: all production stages
const PRODUCTION_ALL_STAGES = new Set([
  'production_sheet_preparation','production_admin_check','waiting_material_availability',
  'production_manager_work','ready_to_dispatch'
])
const READY_TO_DISPATCH_STAGES = new Set([
  'ready_to_dispatch','installation_assigned'
])
const INSTALLATION_STAGES = new Set([
  'installation','installation_assigned','installation_in_progress',
  'installation_not_completed','installation_mistake'
])
const PAYMENT_STAGES = new Set([
  'final_payment','payment_pending','partial_paid','remaining_payment_pending'
])

function isProjectCompleted(p: Project): boolean {
  return (
    p.status === 'completed' ||
    p.isCompleted === true ||
    Boolean(p.completedAt) ||
    p.workflowStatus === 'Finished' ||
    p.currentStage === 'completed'
  )
}

function matchesFilter(p: Project, filter: Filter, role?: string): boolean {
  if (filter === 'active')    return !isProjectCompleted(p)
  if (filter === 'completed') return isProjectCompleted(p)
  if (isProjectCompleted(p)) return false
  const stage = p.currentStage
  if (filter === 'pre_production'    && stage && PRE_PRODUCTION_STAGES.has(stage))    return true
  if (filter === 'production') {
    if (!stage) return !!(p.status === 'active')
    if (role === 'production_manager') return PRODUCTION_PM_STAGES.has(stage)
    return PRODUCTION_ALL_STAGES.has(stage)
  }
  if (filter === 'ready_to_dispatch' && stage && READY_TO_DISPATCH_STAGES.has(stage)) return true
  if (filter === 'installation'      && stage && INSTALLATION_STAGES.has(stage))      return true
  if (filter === 'collection'        && stage && PAYMENT_STAGES.has(stage))           return true
  return false
}

const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400'

export default function ProjectsScreen() {
  const navigate = useNavigate()
  const { projects, addProject, addTask, tasks: allTasks } = useAppData()
  const { user } = useAuth()
  const defaultFilter: Filter =
    (user?.role === 'technician' || user?.role === 'installation_incharge') ? 'ready_to_dispatch'
    : user?.role === 'production_manager' ? 'production'
    : 'active'
  const [filter, setFilter] = useState<Filter>(defaultFilter)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [snack,   setSnack]   = useState({ open: false, msg: '' })
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo,   setExportTo]   = useState('')

  // New project form state
  const [fCustomer,   setFCustomer]   = useState('')
  const [fPhone,      setFPhone]      = useState('')
  const [fName,       setFName]       = useState('')
  const [fReq,        setFReq]        = useState('')
  const [fLocation,   setFLocation]   = useState('')
  const [fEmail,      setFEmail]      = useState('')
  const [fNotes,      setFNotes]      = useState('')
  const [fLeadFrom,   setFLeadFrom]   = useState('')
  const [fStartDate,  setFStartDate]  = useState('')
  const [fDueDate,    setFDueDate]    = useState('')
  const [fLeadOwner,  setFLeadOwner]  = useState('')

  const leadManagers = loadManagedUsers().filter(u => u.role === 'lead_manager' && u.status === 'active')
  const chips = getChipsForRole(user?.role)

  function matchesRoleVisibility(p: Project): boolean {
    const role = user?.role
    if (!role || role === 'owner') return true
    if (role === 'lead_manager') return !p.ownerId || p.ownerId === user!.id
    if (role === 'site_engineer') {
      return allTasks.some(t =>
        t.projectId === p.id &&
        (t.type === 'site_visit' || t.flowStage === 'site_assign' || t.flowStage === 'site_visit') &&
        (t.assignedTo === user!.name || t.assignee === user!.name || t.siteEngineerName === user!.name)
      )
    }
    if (role === 'production_admin') return !!(p.currentStage && (PRE_PRODUCTION_STAGES.has(p.currentStage) || PRODUCTION_PM_STAGES.has(p.currentStage)))
    if (role === 'production_manager') return !!(p.currentStage && PRODUCTION_PM_STAGES.has(p.currentStage))
    if (role === 'technician' || role === 'installation_incharge') {
      return !!(p.currentStage && (INSTALLATION_STAGES.has(p.currentStage) || p.currentStage === 'ready_to_dispatch'))
    }
    return true
  }

  const filtered = projects.filter(p => {
    // Lead-originated projects only appear here after advance payment (stage moves to production_admin_check+)
    if (p.leadId && (!p.currentStage || LEAD_PIPELINE_STAGES.has(p.currentStage))) return false
    if (!matchesRoleVisibility(p)) return false
    const matchF = matchesFilter(p, filter, user?.role)
    const matchS = !search
      || p.name.toLowerCase().includes(search.toLowerCase())
      || p.client.toLowerCase().includes(search.toLowerCase())
    return matchF && matchS
  })

  const total = projects.reduce((s, p) => s + p.value, 0)

  function resetForm() {
    setFCustomer(''); setFPhone(''); setFName(''); setFReq('')
    setFLocation(''); setFEmail(''); setFNotes(''); setFLeadFrom('')
    setFStartDate(''); setFDueDate(''); setFLeadOwner('')
  }

  function handleCreate() {
    if (!fCustomer.trim() || !fPhone.trim() || !fName.trim() || !fLocation.trim()) return

    const ownerId   = user?.role === 'lead_manager' ? user.id   : (fLeadOwner || undefined)
    const ownerName = user?.role === 'lead_manager' ? user.name : (leadManagers.find(u => u.id === fLeadOwner)?.fullName || undefined)

    const projData = {
      ...createProjectFromForm({
        customerName:  fCustomer.trim(),
        phone:         fPhone.trim(),
        projectName:   fName.trim(),
        requirement:   fReq.trim() || undefined,
        location:      fLocation.trim(),
        email:         fEmail.trim() || undefined,
        notes:         fNotes.trim() || undefined,
        leadFrom:      fLeadFrom || undefined,
        startDate:     fStartDate || undefined,
        dueDate:       fDueDate || undefined,
      }),
      ...(ownerId   ? { ownerId }   : {}),
      ...(ownerName ? { ownerName } : {}),
    }

    const projectId = addProject(projData)

    addTask(createSiteAssignTask(
      projectId,
      fName.trim(),
      fCustomer.trim(),
      fPhone.trim(),
      fEmail.trim() || undefined,
      fReq.trim(),
      fLocation.trim(),
      user?.name ?? 'Sales Team',
    ))

    setShowNew(false)
    resetForm()
    setSnack({ open: true, msg: 'Project created! Site Engineer assignment task ready.' })
    setTimeout(() => navigate(`/project/${projectId}`), 800)
  }

  const canCreate = fCustomer.trim() && fPhone.trim() && fName.trim() && fLocation.trim()
  const canExport = user?.role === 'owner' || user?.role === 'lead_manager' || user?.role === 'production_admin'

  function exportCSV(filename: string, rows: (string | number)[][]) {
    const csv = rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    ).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function downloadProjectsExcel() {
    const canSeeCosts = canExport
    const canSeeProfit = user?.role === 'owner'
    let exportList = filtered
    if (exportFrom) exportList = exportList.filter(p => p.createdAt >= exportFrom)
    if (exportTo)   exportList = exportList.filter(p => p.createdAt <= exportTo + 'T23:59:59')
    const headers = [
      '#', 'Project No.', 'Project Name', 'Client', 'Phone', 'Email', 'City / Location',
      'Stage', 'Progress %', 'Lead Owner',
      ...(canSeeCosts ? ['Quotation (Rs)', 'Transport Fee (Rs)', 'Material Cost (Rs)', 'Total Sq.ft'] : []),
      ...(canSeeProfit ? ['Profit (Rs)'] : []),
      'Start Date', 'Due Date', 'Created At',
    ]
    const rows = [
      headers,
      ...exportList.map((p, i) => {
        const task = allTasks.find(t => t.projectId === p.id && t.costBreakdown != null)
        const cb = task?.costBreakdown ?? p.costBreakdown
        const quotation = cb?.quotationAmount ?? p.quotationAmount ?? p.value ?? ''
        return [
          i + 1,
          p.number,
          p.name,
          p.client,
          p.clientPhone,
          p.clientEmail ?? '',
          p.location ?? p.city,
          p.stage,
          p.progress,
          p.ownerName ?? '',
          ...(canSeeCosts ? [quotation, cb?.transportCost ?? '', cb?.materialCost ?? '', cb?.numberOfSqft ?? ''] : []),
          ...(canSeeProfit ? [cb?.profit ?? ''] : []),
          p.startDate ?? '',
          p.dueDate,
          p.createdAt,
        ]
      }),
    ]
    const suffix = exportFrom || exportTo
      ? `_${exportFrom || 'start'}_to_${exportTo || 'end'}`
      : `_${new Date().toISOString().slice(0, 10)}`
    exportCSV(`Fenster_Projects${suffix}.csv`, rows)
    setShowExport(false)
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <AppHeader />

      <div className="bg-white px-4 pt-4 pb-4 border-b border-slate-200 sticky top-14 z-20">
        <div className="flex items-center gap-2 mb-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search projects…" className="flex-1" />
          {canExport && (
            <button onClick={() => setShowExport(true)} aria-label="Download Excel"
              className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-fab active:bg-emerald-700 flex-shrink-0">
              <FileDown size={18} className="text-white" />
            </button>
          )}
        </div>
        <FilterChips chips={chips} active={filter} onChange={setFilter} />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {filter === 'active' && (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex justify-between text-xs text-slate-500">
            <span>{projects.filter(p => !isProjectCompleted(p)).length} active</span>
            <span>{projects.filter(isProjectCompleted).length} completed</span>
            <span>Total ₹{(total / 100000).toFixed(1)}L</span>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={filter === 'completed' ? 'No completed projects yet' : 'No projects found'}
            message={
              filter === 'completed' ? 'Complete a project flow to see it here.' :
              filter === 'active' ? 'Tap + to create your first project.' :
              'No projects in this stage yet.'
            }
          />
        ) : (
          filtered.map(project => {
            const projTask = allTasks.find(t => t.projectId === project.id && t.paidAmount != null)
            const paid = projTask?.paidAmount ?? 0
            const total = project.quotationAmount ?? project.value ?? 0
            const balance = projTask?.balanceAmount ?? (total > 0 ? Math.max(0, total - paid) : 0)
            return (
              <ProjectRow
                key={project.id}
                project={project}
                role={user?.role}
                balanceAmount={balance > 0 ? balance : undefined}
                onClick={() => navigate(`/project/${project.id}`)}
              />
            )
          })
        )}
      </div>

      <PermissionGate permission="create_project">
        <FloatingActionButton onClick={() => setShowNew(true)} />
      </PermissionGate>

      {/* Add New Project Sheet */}
      <BottomSheet isOpen={showNew} onClose={() => { setShowNew(false); resetForm() }} title="New Project" height="full">
        <div className="space-y-4">
          {/* Required fields */}
          <div className="bg-indigo-50 rounded-xl px-4 py-2.5">
            <p className="text-xs font-semibold text-indigo-700">* Required fields</p>
          </div>

          {user?.role === 'owner' && leadManagers.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Assign Lead Owner <span className="text-slate-300 font-normal">(optional)</span></label>
              <select value={fLeadOwner} onChange={e => setFLeadOwner(e.target.value)} className={inp}>
                <option value="">— Unassigned —</option>
                {leadManagers.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.displayRole})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Customer Name *</label>
            <input value={fCustomer} onChange={e => setFCustomer(e.target.value)}
              placeholder="e.g. Rajesh Kumar" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Phone Number *</label>
            <input type="tel" inputMode="numeric" value={fPhone} onChange={e => setFPhone(e.target.value)}
              placeholder="e.g. 9876543210" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Project Name *</label>
            <input value={fName} onChange={e => setFName(e.target.value)}
              placeholder="e.g. Rajesh Villa Windows" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Requirement <span className="text-slate-300 font-normal">(optional)</span></label>
            <input value={fReq} onChange={e => setFReq(e.target.value)}
              placeholder="e.g. UPVC Windows and Door Work" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Location *</label>
            <input value={fLocation} onChange={e => setFLocation(e.target.value)}
              placeholder="e.g. Anna Nagar, Chennai" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Lead From <span className="text-slate-300 font-normal">(optional)</span></label>
            <select value={fLeadFrom} onChange={e => setFLeadFrom(e.target.value)} className={inp}>
              <option value="">— Select source —</option>
              <option value="walk_in">Walk-in</option>
              <option value="referral">Referral</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="online">Website</option>
              <option value="existing_customer">Existing Customer</option>
              <option value="cold_call">Cold Call</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Start Date *</label>
              <input type="date" value={fStartDate} onChange={e => setFStartDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Due Date *</label>
              <input type="date" value={fDueDate} onChange={e => setFDueDate(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Optional fields */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 mb-3">Optional fields</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Email <span className="text-slate-300 font-normal">(optional)</span></label>
            <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)}
              placeholder="client@email.com" className={inp} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={fNotes} onChange={e => setFNotes(e.target.value)}
              placeholder="Any important notes…"
              className={`${inp} resize-none`} />
          </div>

          <button onClick={handleCreate} disabled={!canCreate}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-40">
            Create Project
          </button>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={showExport} onClose={() => setShowExport(false)} title="Download Projects CSV">
        <div className="space-y-4 pb-4">
          <p className="text-sm text-slate-500">Optional: filter by created date range</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From Date</label>
              <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                className={inp} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To Date</label>
              <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                className={inp} />
            </div>
          </div>
          <button onClick={downloadProjectsExcel}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-700 flex items-center justify-center gap-2">
            <FileDown size={16} /> Download CSV
          </button>
          {(exportFrom || exportTo) && (
            <button onClick={() => { setExportFrom(''); setExportTo('') }}
              className="w-full py-2 text-xs text-slate-400 underline">
              Clear date filter
            </button>
          )}
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
