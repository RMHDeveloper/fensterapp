import { useState, useEffect } from 'react'
import { Plus, UserPlus, HardHat, Phone, Pencil, FileDown } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { FilterChips } from '../../components/forms/FilterChips'
import { SearchBar } from '../../components/forms/SearchBar'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Dialog } from '../../components/feedback/Dialog'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { DemoFlowSheet } from '../TaskDetail/DemoFlowSheet'
import { loadManagedUsers } from '../../utils/userStorage'
import type { Lead, LeadStatus, LeadSource, LeadInterest, Task } from '../../types'

type Filter = 'active' | 'contact' | 'measurement' | 'quotation' | 'lost'

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'active',      label: 'Active'      },
  { value: 'contact',     label: 'Contact'     },
  { value: 'measurement', label: 'Measurement' },
  { value: 'quotation',   label: 'Quotation'   },
  { value: 'lost',        label: 'Lost'        },
]

const LEAD_MEASUREMENT_STAGES = new Set([
  'new_project','measurement','site_visit_assigned','site_visit','site_visit_completed',
  'waiting_site_visit_review','reschedule_requested','reschedule_approved',
])
const LEAD_QUOTATION_STAGES = new Set([
  'quotation_preparation','quotation_sent_owner','quotation_sent_md_ed',
  'owner_approved','md_ed_approved','quotation_rework',
  // Send-to-client phase: quotation with client, negotiating, or rejected
  'sent_to_client','waiting_client_approval','client_rejected',
  'client_not_approved','negotiation','owner_disapproved','md_ed_rejected',
])
// Once client approves → project moves to Active in Projects screen (no longer in Leads filters)
const LEAD_NEGOTIATION_STAGES = new Set([
  'client_approved','advance_payment','advance_payment_pending','waiting_advance_payment',
])

// Flow stages reached only after advance payment has actually been recorded
const STAGES_AFTER_ADVANCE_PAYMENT = new Set([
  'production_assign','production_check','production_work',
  'installation_assign','installation_update','final_payment','final_completion','completed',
])

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'existing_customer', label: 'Existing Client'    },
  { value: 'md_ed_ref',         label: 'MD / ED Reference'  },
  { value: 'google',            label: 'Google'             },
  { value: 'instagram',         label: 'Instagram'          },
  { value: 'facebook',          label: 'Facebook'           },
  { value: 'walk_in',           label: 'Walk In'            },
  { value: 'client_ref',        label: 'Client Reference'   },
  { value: 'cold_call',         label: 'Cold Call'          },
  { value: 'cni',               label: 'CNI'                },
  { value: 'bni',               label: 'BNI'                },
  { value: 'referral',          label: 'Referral'           },
  { value: 'whatsapp',          label: 'WhatsApp'           },
  { value: 'online',            label: 'Online'             },
  { value: 'other',             label: 'Other'              },
]

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(
  SOURCE_OPTIONS.map(o => [o.value, o.label])
)

const INTEREST_OPTIONS: { value: LeadInterest; label: string; color: string; badge: string }[] = [
  { value: 'hot',    label: '🔥 Hot',    color: 'bg-red-50 border-red-300 text-red-700',     badge: 'bg-red-100 text-red-700'     },
  { value: 'medium', label: '🌡️ Medium', color: 'bg-amber-50 border-amber-300 text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  { value: 'cold',   label: '❄️ Cold',   color: 'bg-blue-50 border-blue-300 text-blue-700',   badge: 'bg-blue-100 text-blue-700'   },
]

function InterestBadge({ interest }: { interest?: LeadInterest }) {
  if (!interest) return null
  const opt = INTEREST_OPTIONS.find(o => o.value === interest)
  if (!opt) return null
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${opt.badge}`}>{opt.label}</span>
  )
}

export default function LeadsScreen() {
  const { leads, projects, tasks, updateLeadStatus, updateLead, addProject, addTask, updateTask, updateProject, addLead } = useAppData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isQualifiedView = pathname === '/leads/qualified'

  const isMdEd = user?.displayRole?.includes('MD') || user?.displayRole?.includes('ED')
  const isLO   = user?.role === 'lead_manager'
  const canEditLead  = isMdEd || isLO
  const canExport    = user?.role === 'owner' || user?.role === 'lead_manager' || user?.role === 'production_admin'
  const leadManagers = loadManagedUsers()
    .filter(u => u.status === 'active' && u.role === 'lead_manager')
    .map(u => u.fullName)
  const [filter,   setFilter]   = useState<Filter>('active')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [pendingAssignProjectId, setPendingAssignProjectId] = useState<string | null>(null)
  const [assignFlowTaskId, setAssignFlowTaskId] = useState<string | null>(null)
  const [showStatusOptions, setShowStatusOptions] = useState(false)
  const [convertingProjectId, setConvertingProjectId] = useState<string | null>(null)
  const [convertDueDate, setConvertDueDate] = useState('')
  const [snack, setSnack] = useState({ open: false, msg: '' })

  // Once the project + "Assign Site Engineer" task exist, open the real flow popup for it
  useEffect(() => {
    if (!pendingAssignProjectId) return
    const t = tasks.find(t => t.projectId === pendingAssignProjectId && t.flowStage === 'site_assign')
    if (t) {
      setAssignFlowTaskId(t.id)
      setPendingAssignProjectId(null)
    }
  }, [tasks, pendingAssignProjectId])

  const assignFlowTask = assignFlowTaskId ? (tasks.find(t => t.id === assignFlowTaskId) ?? null) : null

  // Contacted → followup date dialog
  const [showFollowupDialog, setShowFollowupDialog]   = useState(false)
  const [pendingFollowupDate, setPendingFollowupDate] = useState('')
  const [pendingContactedId, setPendingContactedId]   = useState<string | null>(null)

  // Lost reason dialog
  const [showLostDialog, setShowLostDialog] = useState(false)
  const [lostReason, setLostReason]         = useState('')
  const [pendingLostId, setPendingLostId]   = useState<string | null>(null)

  // Phone validation
  const [newPhoneError,  setNewPhoneError]  = useState('')
  const [editPhoneError, setEditPhoneError] = useState('')

  function validatePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) return 'Phone must be at least 10 digits'
    if (digits.length > 13) return 'Phone must not exceed 13 digits'
    return ''
  }

  // New lead form
  const [newName,     setNewName]     = useState('')
  const [newPhone,    setNewPhone]    = useState('')
  const [newEmail,    setNewEmail]    = useState('')
  const [newCity,     setNewCity]     = useState('')
  const [newReq,      setNewReq]      = useState('')
  const [newNotes,    setNewNotes]    = useState('')
  const [newSource,   setNewSource]   = useState<LeadSource>('cold_call')
  const [newInterest, setNewInterest] = useState<LeadInterest>('medium')
  const [newAssignee, setNewAssignee] = useState('')

  // Edit lead form
  const [showEdit,      setShowEdit]      = useState(false)
  const [editName,      setEditName]      = useState('')
  const [editPhone,     setEditPhone]     = useState('')
  const [editEmail,     setEditEmail]     = useState('')
  const [editCity,      setEditCity]      = useState('')
  const [editReq,       setEditReq]       = useState('')
  const [editNotes,     setEditNotes]     = useState('')
  const [editSource,    setEditSource]    = useState<LeadSource>('cold_call')
  const [editInterest,  setEditInterest]  = useState<LeadInterest>('medium')
  const [editAssignee,  setEditAssignee]  = useState('')


  const filtered = leads.filter(l => {
    if (user?.role === 'lead_manager' && l.assignee && l.assignee !== user.name) return false
    const matchSearchOnly = !search
      || l.name.toLowerCase().includes(search.toLowerCase())
      || l.phone.includes(search)
      || l.city.toLowerCase().includes(search.toLowerCase())
    if (isQualifiedView) return l.status === 'qualified' && matchSearchOnly
    const proj = projects.find(p => p.leadId === l.id)
    const projStage = proj?.currentStage
    let matchFilter = false
    if (filter === 'lost') {
      matchFilter = l.status === 'lost'
    } else if (l.status === 'lost') {
      matchFilter = false
    } else if (filter === 'active') {
      matchFilter = true
    } else if (filter === 'contact') {
      matchFilter = l.status === 'new' || l.status === 'contacted'
    } else if (filter === 'measurement') {
      matchFilter = l.status === 'qualified'
        || !!(projStage && LEAD_MEASUREMENT_STAGES.has(projStage))
    } else if (filter === 'quotation') {
      matchFilter = !!(projStage && LEAD_QUOTATION_STAGES.has(projStage))
    }
    const matchSearch = !search
      || l.name.toLowerCase().includes(search.toLowerCase())
      || l.phone.includes(search)
      || l.city.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  function handleStatusClick(status: LeadStatus) {
    if (!selected) return

    if (status === 'contacted') {
      setPendingContactedId(selected.id)
      setPendingFollowupDate('')
      setShowFollowupDialog(true)
      return
    }

    if (status === 'lost') {
      setPendingLostId(selected.id)
      setLostReason('')
      setShowLostDialog(true)
      return
    }

    if (status === 'qualified') {
      // Update status but keep sheet open so user can manually convert
      updateLeadStatus(selected.id, 'qualified')
      setSelected(prev => prev ? { ...prev, status: 'qualified' } : prev)
      setSnack({ open: true, msg: 'Lead marked as Qualified!' })
      return
    }

    updateLeadStatus(selected.id, status)
    setSelected(prev => prev ? { ...prev, status } : prev)
    setSnack({ open: true, msg: 'Lead updated!' })
  }

  function confirmFollowup() {
    if (!pendingContactedId) return
    updateLeadStatus(pendingContactedId, 'contacted', {
      followUpDate: pendingFollowupDate || 'TBD',
    })
    if (selected?.id === pendingContactedId) {
      setSelected(prev => prev ? { ...prev, status: 'contacted', followUpDate: pendingFollowupDate || 'TBD' } : prev)
    }
    setShowFollowupDialog(false)
    setPendingContactedId(null)
    setSnack({ open: true, msg: 'Lead contacted — follow-up scheduled!' })
  }

  function confirmLost() {
    if (!pendingLostId) return
    updateLeadStatus(pendingLostId, 'lost', { lostReason: lostReason.trim() || undefined })
    setSelected(null)
    setShowLostDialog(false)
    setPendingLostId(null)
    setSnack({ open: true, msg: 'Lead moved to Lost.' })
  }

  function handleAddLead() {
    if (!newName.trim() || !newPhone.trim() || !newCity.trim()) return
    const phoneErr = validatePhone(newPhone)
    if (phoneErr) { setNewPhoneError(phoneErr); return }
    addLead({
      name:        newName.trim(),
      phone:       newPhone.trim(),
      email:       newEmail.trim() || undefined,
      city:        newCity.trim(),
      location:    newCity.trim(),
      requirement: newReq.trim()   || undefined,
      notes:       newNotes.trim() || undefined,
      source:      newSource,
      interest:    newInterest,
      status:      'new',
      followUpDate: undefined,
      priority:    'medium',
      assignee:    newAssignee.trim() || (isLO ? user!.name : 'Sales Team'),
      createdAt:   new Date().toLocaleDateString('en-IN'),
    })
    setNewName(''); setNewPhone(''); setNewEmail(''); setNewCity('')
    setNewReq(''); setNewNotes(''); setNewAssignee('')
    setNewSource('cold_call'); setNewInterest('medium')
    setShowNew(false)
    setSnack({ open: true, msg: 'Lead created successfully!' })
  }

  function openEdit() {
    if (!selected) return
    setEditName(selected.name)
    setEditPhone(selected.phone)
    setEditEmail(selected.email ?? '')
    setEditCity(selected.city)
    setEditReq(selected.requirement ?? '')
    setEditNotes(selected.notes ?? '')
    setEditSource(selected.source)
    setEditInterest(selected.interest ?? 'medium')
    setEditAssignee(selected.assignee)
    setShowEdit(true)
  }

  function handleSaveEdit() {
    if (!selected || !editName.trim() || !editPhone.trim() || !editCity.trim()) return
    const phoneErr = validatePhone(editPhone)
    if (phoneErr) { setEditPhoneError(phoneErr); return }
    const updates = {
      name:        editName.trim(),
      phone:       editPhone.trim(),
      email:       editEmail.trim() || undefined,
      city:        editCity.trim(),
      location:    editCity.trim(),
      requirement: editReq.trim() || undefined,
      notes:       editNotes.trim() || undefined,
      source:      editSource,
      interest:    editInterest,
      assignee:    editAssignee || selected.assignee,
    }
    updateLead(selected.id, updates)
    setSelected(prev => prev ? { ...prev, ...updates } : prev)
    setShowEdit(false)
    setSnack({ open: true, msg: 'Lead updated!' })
  }

  // Qualified lead → create the project behind the scenes, then jump straight into
  // the real "Assign Site Engineer" flow popup (same one used later on the project page)
  function handleAssignSiteEngineer() {
    if (!selected) return
    const lead = selected
    const name = `${lead.name} Project`

    const projectId = addProject({
      number:       `FC-${String(Date.now()).slice(-4)}`,
      name,
      client:       lead.name,
      clientPhone:  lead.phone,
      status:       'new',
      progress:     5,
      pendingTasks: 1,
      dueDate:      '—',
      value:        0,
      stage:        'Lead Converted',
      city:         lead.city,
      productType:  lead.requirement ?? '',
      createdAt:    new Date().toLocaleDateString('en-IN'),
      description:  lead.notes ?? lead.requirement ?? '',
      leadId:       lead.id,
      pendingConversion: true,
    })

    addTask({
      title:             'Assign Site Engineer',
      type:              'site_visit',
      taskKind:          'followup',
      status:            'pending',
      priority:          'high',
      dueDate:           'Today',
      assignee:          lead.assignee ?? '',
      projectId,
      projectName:       name,
      location:          lead.city,
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      flowStage:         'site_assign',
      flowStatus:        'ready',
      clientName:        lead.name,
      clientPhone:       lead.phone,
      clientEmail:       lead.email,
      clientRequirement: lead.requirement,
    })

    updateLeadStatus(lead.id, 'won')
    setSelected(null)
    setPendingAssignProjectId(projectId)
  }

  // Every stage update (site visit, quotation, approval, advance payment…) is driven
  // from this same popup while the linked project is still pendingConversion — stays
  // on the Leads screen instead of jumping to the project folder.
  function handleAssignFlowUpdate(updates: Partial<Task>) {
    if (!assignFlowTask) return
    updateTask(assignFlowTask.id, updates)
    setAssignFlowTaskId(null)
    setSnack({ open: true, msg: 'Status updated!' })
  }

  // Open the real flow popup for whichever stage this lead's linked project is
  // currently on — used by the lead sheet's "Update Status" button
  function openLeadFlowUpdate(projectId: string) {
    const t = tasks.find(t => t.projectId === projectId && t.flowStage && t.flowStage !== 'completed')
    if (t) setAssignFlowTaskId(t.id)
  }

  function openConvertToProject(projectId: string) {
    setConvertingProjectId(projectId)
    setConvertDueDate('')
  }

  function finishConvertToProject(dueDate?: string) {
    if (!convertingProjectId) return
    const projectId = convertingProjectId
    updateProject(projectId, { pendingConversion: false, ...(dueDate ? { dueDate } : {}) })
    setConvertingProjectId(null)
    setSelected(null)
    setSnack({ open: true, msg: 'Converted to project!' })
    setTimeout(() => navigate(`/project/${projectId}`), 500)
  }

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

  function downloadLeadsExcel() {
    const rows = [
      ['#', 'Name', 'Phone', 'Email', 'City', 'Status', 'Interest', 'Source', 'Assignee', 'Requirement', 'Notes', 'Follow Up Date', 'Created At'],
      ...filtered.map((l, i) => [
        i + 1,
        l.name,
        l.phone,
        l.email ?? '',
        l.city,
        l.status,
        l.interest ?? '',
        SOURCE_LABEL[l.source] ?? l.source,
        l.assignee,
        l.requirement ?? '',
        l.notes ?? '',
        l.followUpDate ?? '',
        l.createdAt ?? '',
      ]),
    ]
    exportCSV(`Fenster_Leads_${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center gap-2 mb-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search leads…" className="flex-1" />
          {canExport && (
            <button onClick={downloadLeadsExcel} aria-label="Download Excel"
              className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-fab active:bg-emerald-700 flex-shrink-0">
              <FileDown size={18} className="text-white" />
            </button>
          )}
          <PermissionGate permission="create_lead">
            <button onClick={() => setShowNew(true)} aria-label="Add new lead"
              className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-fab active:bg-indigo-700 flex-shrink-0">
              <Plus size={19} className="text-white" strokeWidth={2.5} />
            </button>
          </PermissionGate>
        </div>
        {isQualifiedView ? (
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qualified Leads</p>
        ) : (
          <FilterChips chips={CHIPS} active={filter} onChange={setFilter} />
        )}
      </div>

      <div className="px-4 pt-4 space-y-2.5">
        {filtered.map(lead => {
          const linkedProject = lead.status === 'won' ? projects.find(p => p.leadId === lead.id) : undefined
          const showFlowUpdate = !!linkedProject?.pendingConversion
          const showStatusUpdate = lead.status !== 'won' && lead.status !== 'lost'
          return (
            <div key={lead.id} onClick={() => { setSelected(lead); setShowStatusOptions(false) }}
              className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 active:scale-[0.98] transition-transform cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Name | City */}
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">{lead.name}</span>
                    <span className="text-slate-300 text-xs">|</span>
                    <span className="text-xs text-slate-500">{lead.city}</span>
                    {lead.interest && <InterestBadge interest={lead.interest} />}
                  </div>
                  {/* Requirement */}
                  <p className="text-xs text-slate-600 truncate mb-1">{lead.requirement}</p>
                  {/* Source */}
                  <p className="text-[11px] text-slate-400">{SOURCE_LABEL[lead.source] ?? lead.source}</p>
                  {/* Follow-up if set */}
                  {lead.followUpDate && lead.followUpDate !== 'TBD' && (
                    <p className="text-[11px] text-indigo-500 mt-0.5">📅 {lead.followUpDate}</p>
                  )}
                </div>
                <StatusBadge status={lead.status} size="xs" />
              </div>
              {lead.status === 'lost' && lead.lostReason && (
                <p className="mt-2 text-[11px] text-red-500 border-t border-slate-100 pt-2">
                  Lost reason: {lead.lostReason}
                </p>
              )}
              {(showFlowUpdate || showStatusUpdate) && (
                <PermissionGate permission="edit_lead">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (showFlowUpdate && linkedProject) openLeadFlowUpdate(linkedProject.id)
                      else { setSelected(lead); setShowStatusOptions(true) }
                    }}
                    className="w-full mt-2.5 py-2 rounded-lg border-2 border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold active:bg-indigo-100">
                    Update Status
                  </button>
                </PermissionGate>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">No leads found</p>
          </div>
        )}
      </div>

      {/* ── Lead Detail Sheet ── */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} height="full">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selected.status} size="md" />
                <InterestBadge interest={selected.interest} />
              </div>
              {canEditLead && (
                <button onClick={openEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 active:bg-slate-50">
                  <Pencil size={13} /> Edit
                </button>
              )}
            </div>

            {selected.status !== 'won' && selected.status !== 'lost' && (
              <PermissionGate permission="edit_lead">
                <button onClick={() => setShowStatusOptions(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold active:bg-indigo-100">
                  Update Status
                </button>
              </PermissionGate>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Phone',       value: selected.phone },
                { label: 'City',        value: selected.city },
                { label: 'Requirement', value: selected.requirement },
                { label: 'Source',      value: SOURCE_LABEL[selected.source] ?? selected.source },
                ...(selected.followUpDate && selected.followUpDate !== 'TBD'
                  ? [{ label: 'Follow-up', value: `📅 ${selected.followUpDate}` }]
                  : []),
                ...(selected.lostReason
                  ? [{ label: 'Lost Reason', value: selected.lostReason }]
                  : []),
                ...(selected.notes ? [{ label: 'Notes', value: selected.notes }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700 text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            {showStatusOptions && selected.status !== 'won' && selected.status !== 'lost' && (
              <PermissionGate permission="edit_lead">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Set Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['new', 'contacted', 'qualified', 'lost'] as const).map(s => (
                      <button key={s} onClick={() => { handleStatusClick(s); setShowStatusOptions(false) }}
                        className={`py-3 rounded-xl text-xs font-bold border-2 capitalize
                          ${selected.status === s
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : s === 'qualified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : s === 'lost'      ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-white text-slate-600 border-slate-200'}`}>
                        {s === 'qualified' ? '✓ Qualified' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </PermissionGate>
            )}

            <a href={`tel:${selected.phone}`}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-teal-700">
              <Phone size={16} /> Call {selected.name.split(' ')[0]}
            </a>

            {/* Assign to Site Engineer (when qualified) */}
            {selected.status === 'qualified' && (
              <PermissionGate permission="create_project">
                <button
                  onClick={handleAssignSiteEngineer}
                  className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-teal-700">
                  <UserPlus size={16} /> Assign to Site Engineer →
                </button>
              </PermissionGate>
            )}

            {/* Assign Site Engineer — disabled until lead is qualified */}
            {selected.status !== 'won' && selected.status !== 'qualified' && (
              <PermissionGate permission="create_project">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-400 rounded-xl py-3 text-sm font-bold opacity-40 pointer-events-none">
                  <UserPlus size={16} /> Assign Site Engineer
                </button>
              </PermissionGate>
            )}

            {selected.status === 'won' && (() => {
              const linkedProject = projects.find(p => p.leadId === selected.id)
              if (!linkedProject) return null

              if (linkedProject.pendingConversion) {
                const activeTask = tasks.find(t => t.projectId === linkedProject.id && t.flowStage && t.flowStage !== 'completed')
                const pastAdvancePayment = !!activeTask && STAGES_AFTER_ADVANCE_PAYMENT.has(activeTask.flowStage!)
                return (
                  <div className="space-y-2.5">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Current Stage</p>
                      <p className="text-sm font-bold text-slate-700">{activeTask?.title ?? 'In progress'}</p>
                    </div>
                    <button
                      onClick={() => openLeadFlowUpdate(linkedProject.id)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-blue-700">
                      Update Status →
                    </button>
                    {pastAdvancePayment && (
                      <button
                        onClick={() => openConvertToProject(linkedProject.id)}
                        className="w-full flex items-center justify-center gap-2 border-2 border-emerald-600 text-emerald-600 rounded-xl py-3 text-sm font-bold active:bg-emerald-50">
                        <HardHat size={16} /> Convert to Project →
                      </button>
                    )}
                  </div>
                )
              }

              return (
                <button onClick={() => {
                  setSelected(null)
                  navigate(`/project/${linkedProject.id}`)
                }}
                  className="w-full flex items-center justify-center gap-2 border-2 border-emerald-600 text-emerald-600 rounded-xl py-3 text-sm font-bold active:bg-emerald-50">
                  <HardHat size={16} /> View Progress →
                </button>
              )
            })()}
          </div>
        )}
      </BottomSheet>

      {/* ── Followup Date Dialog (contacted) ── */}
      <Dialog
        isOpen={showFollowupDialog}
        onClose={() => { setShowFollowupDialog(false); setPendingContactedId(null) }}
        title="Set Follow-up Date"
        variant="info"
        confirmLabel="Confirm"
        cancelLabel="Skip"
        onConfirm={confirmFollowup}>
        <div className="mt-1">
          <label className="text-xs text-slate-500 mb-1.5 block">Follow-up date</label>
          <input
            type="date"
            value={pendingFollowupDate}
            onChange={e => setPendingFollowupDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
      </Dialog>

      {/* ── Lost Reason Dialog ── */}
      <Dialog
        isOpen={showLostDialog}
        onClose={() => { setShowLostDialog(false); setPendingLostId(null) }}
        title="Why was this lead lost?"
        variant="danger"
        confirmLabel="Move to Lost"
        cancelLabel="Cancel"
        onConfirm={confirmLost}>
        <div className="mt-1">
          <label className="text-xs text-slate-500 mb-1.5 block">Reason <span className="text-slate-300">(optional)</span></label>
          <textarea
            rows={3}
            value={lostReason}
            onChange={e => setLostReason(e.target.value)}
            placeholder="e.g. Budget too low, competitor chosen…"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-300 resize-none"
          />
        </div>
      </Dialog>

      {/* ── Edit Lead Sheet ── */}
      <BottomSheet isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Lead" height="full">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Client Name *</label>
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Rajesh Kumar"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Phone Number *</label>
            <input type="tel" value={editPhone} maxLength={13}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9+\-\s]/g, '')
                setEditPhone(val)
                setEditPhoneError(validatePhone(val))
              }}
              placeholder="9876543210"
              className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:outline-none ${editPhoneError ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`} />
            {editPhoneError && <p className="text-xs text-red-500 mt-1">{editPhoneError}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Email <span className="text-slate-300 font-normal">(optional)</span></label>
            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="optional"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Location / City *</label>
            <input type="text" value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="e.g. Anna Nagar, Chennai"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Requirement</label>
            <textarea rows={2} value={editReq} onChange={e => setEditReq(e.target.value)} placeholder="Describe what the client needs…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Lead Source</label>
            <select value={editSource} onChange={e => setEditSource(e.target.value as LeadSource)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 appearance-none">
              {SOURCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-2 block">Lead Interest</label>
            <div className="flex gap-2">
              {INTEREST_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setEditInterest(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-colors
                    ${editInterest === opt.value ? opt.color : 'bg-white text-slate-500 border-slate-200'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {isMdEd && leadManagers.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Assign To</label>
              <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 appearance-none">
                <option value="">Select lead owner…</option>
                {leadManagers.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Any additional notes…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <button onClick={handleSaveEdit} disabled={!editName.trim() || !editPhone.trim() || !editCity.trim()}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
            Save Changes
          </button>
        </div>
      </BottomSheet>

      {/* ── Assign Site Engineer — real flow popup, same one used on the project page ── */}
      {assignFlowTask && (
        <DemoFlowSheet
          isOpen={!!assignFlowTask}
          onClose={() => setAssignFlowTaskId(null)}
          task={assignFlowTask}
          onUpdate={handleAssignFlowUpdate}
        />
      )}

      {/* ── Convert to Project — optional due date, Done or Skip both convert ── */}
      {convertingProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConvertingProjectId(null)} />
          <div className="relative bg-white rounded-2xl shadow-sheet w-full max-w-[320px] p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Set a Due Date</h3>
            <p className="text-sm text-slate-500">Optional — you can skip this and set it later on the project page.</p>
            <input type="date" value={convertDueDate} onChange={e => setConvertDueDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            <div className="flex gap-2">
              <button onClick={() => finishConvertToProject(undefined)}
                className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3 text-sm font-semibold active:bg-slate-200">
                Skip
              </button>
              <button onClick={() => finishConvertToProject(convertDueDate || undefined)}
                className="flex-1 bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold active:bg-indigo-700">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Lead Sheet ── */}
      <BottomSheet isOpen={showNew} onClose={() => setShowNew(false)} title="Add New Lead" height="full">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Client Name *</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Rajesh Kumar"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Phone Number *</label>
            <input type="tel" value={newPhone} maxLength={13}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9+\-\s]/g, '')
                setNewPhone(val)
                setNewPhoneError(validatePhone(val))
              }}
              placeholder="9876543210"
              className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:outline-none ${newPhoneError ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-indigo-400'}`} />
            {newPhoneError && <p className="text-xs text-red-500 mt-1">{newPhoneError}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Email <span className="text-slate-300 font-normal">(optional)</span></label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="optional"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Location / Address *</label>
            <input type="text" value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="e.g. Anna Nagar, Chennai"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Requirement <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={newReq} onChange={e => setNewReq(e.target.value)} placeholder="Describe what the client needs…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          {/* Source */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Lead Source *</label>
            <select value={newSource} onChange={e => setNewSource(e.target.value as LeadSource)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 appearance-none">
              {SOURCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Interest */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-2 block">Lead Interest *</label>
            <div className="flex gap-2">
              {INTEREST_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setNewInterest(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-colors
                    ${newInterest === opt.value ? opt.color : 'bg-white text-slate-500 border-slate-200'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign To — MD/ED only */}
          {isMdEd && leadManagers.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Assign To *</label>
              <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 appearance-none">
                <option value="">Select lead owner…</option>
                {leadManagers.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Any additional notes…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>

          <button onClick={handleAddLead} disabled={!newName.trim() || !newPhone.trim() || !newCity.trim() || (isMdEd && !newAssignee)}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
            Add Lead
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
