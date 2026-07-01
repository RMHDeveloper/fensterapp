import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
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

type Filter = 'all' | 'measurement' | 'quotation' | 'negotiation' | 'production' | 'dispatch' | 'installation' | 'payment' | 'completed'

const CHIPS = [
  { value: 'all'         as Filter, label: 'All'         },
  { value: 'measurement' as Filter, label: 'Measurement' },
  { value: 'quotation'   as Filter, label: 'Quotation'   },
  { value: 'negotiation' as Filter, label: 'Negotiation' },
  { value: 'production'  as Filter, label: 'Production'  },
  { value: 'dispatch'    as Filter, label: 'Dispatch'    },
  { value: 'installation'as Filter, label: 'Installation'},
  { value: 'payment'     as Filter, label: 'Payment'     },
  { value: 'completed'   as Filter, label: 'Completed'   },
]

const MEASUREMENT_STAGES = new Set([
  'new_project','measurement','site_visit_assigned','site_visit_completed','waiting_site_visit_review'
])
const QUOTATION_STAGES = new Set([
  'quotation_preparation','quotation_sent_owner','owner_approved','sent_to_client','waiting_client_approval','quotation_rework'
])
const NEGOTIATION_STAGES = new Set([
  'negotiation','client_approved','advance_payment','client_rejected','client_not_approved',
  'advance_payment_pending','waiting_advance_payment','owner_disapproved'
])
const PRODUCTION_STAGES = new Set([
  'production_sheet_preparation','production_admin_check','waiting_material_availability',
  'production_manager_work','ready_to_dispatch'
])
const INSTALLATION_STAGES = new Set([
  'ready_to_dispatch','installation','installation_assigned',
  'installation_in_progress','installation_not_completed','installation_mistake'
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

function matchesFilter(p: Project, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'completed') return isProjectCompleted(p)
  if (isProjectCompleted(p)) return false
  const stage = p.currentStage
  if (filter === 'measurement'  && stage && MEASUREMENT_STAGES.has(stage))  return true
  if (filter === 'quotation'    && stage && QUOTATION_STAGES.has(stage))    return true
  if (filter === 'negotiation'  && stage && NEGOTIATION_STAGES.has(stage))  return true
  if (filter === 'production'   && stage && PRODUCTION_STAGES.has(stage))   return true
  if (filter === 'dispatch'     && stage === 'ready_to_dispatch')            return true
  if (filter === 'installation' && stage && INSTALLATION_STAGES.has(stage)) return true
  if (filter === 'payment'      && stage && PAYMENT_STAGES.has(stage))      return true
  // Fallback: use status string for projects without currentStage
  if (!stage) {
    if (filter === 'measurement' && (p.status === 'new' || p.stage?.toLowerCase().includes('visit'))) return true
    if (filter === 'production'  && p.status === 'active') return true
    if (filter === 'installation' && p.status === 'active' && (p.stage?.toLowerCase().includes('install') || p.stage?.toLowerCase().includes('dispatch'))) return true
  }
  return false
}

const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400'

export default function ProjectsScreen() {
  const navigate = useNavigate()
  const { projects, addProject, addTask } = useAppData()
  const { user } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [snack,   setSnack]   = useState({ open: false, msg: '' })

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

  const filtered = projects.filter(p => {
    // Lead managers see only their own projects (when ownerId is set)
    if (user?.role === 'lead_manager' && p.ownerId && p.ownerId !== user.id) return false
    const matchF = matchesFilter(p, filter)
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

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24">
      <AppHeader />

      <div className="bg-white px-4 pt-4 pb-4 border-b border-slate-200 sticky top-14 z-20">
        <SearchBar value={search} onChange={setSearch} placeholder="Search projects…" className="mb-3" />
        <FilterChips chips={CHIPS} active={filter} onChange={setFilter} />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {filter === 'all' && (
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
              filter === 'all' ? 'Tap + to create your first project.' :
              'No projects in this stage yet.'
            }
          />
        ) : (
          filtered.map(project => (
            <ProjectRow
              key={project.id}
              project={project}
              onClick={() => navigate(`/project/${project.id}`)}
            />
          ))
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

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
