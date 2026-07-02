import { useState } from 'react'
import { Plus, UserPlus, HardHat, Phone, Pencil } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { FilterChips } from '../../components/forms/FilterChips'
import { SearchBar } from '../../components/forms/SearchBar'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Dialog } from '../../components/feedback/Dialog'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { loadManagedUsers } from '../../utils/userStorage'
import type { Lead, LeadStatus, LeadSource, LeadInterest } from '../../types'

type Filter = 'all' | LeadStatus

const CHIPS = [
  { value: 'all'       as Filter, label: 'Active'    },
  { value: 'new'       as Filter, label: 'New'       },
  { value: 'contacted' as Filter, label: 'Contacted' },
  { value: 'qualified' as Filter, label: 'Qualified' },
  { value: 'lost'      as Filter, label: 'Lost'      },
]

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'cold_call',         label: '📞 Cold Call'        },
  { value: 'referral',          label: '🤝 Referral'         },
  { value: 'walk_in',           label: '🚶 Walk-in'          },
  { value: 'online',            label: '🌐 Online'           },
  { value: 'whatsapp',          label: '💬 WhatsApp'         },
  { value: 'existing_customer', label: '⭐ Existing Customer' },
  { value: 'other',             label: '📌 Other'            },
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
  const { leads, updateLeadStatus, updateLead, addProject, addTask, addLead } = useAppData()
  const { user } = useAuth()
  const navigate = useNavigate()

  const isMdEd = user?.displayRole?.includes('MD') || user?.displayRole?.includes('ED')
  const isLO   = user?.role === 'lead_manager'
  const canEditLead = isMdEd || isLO
  const leadManagers = loadManagedUsers()
    .filter(u => u.status === 'active' && u.role === 'lead_manager')
    .map(u => u.fullName)
  const [filter,   setFilter]   = useState<Filter>('all')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  // Contacted → followup date dialog
  const [showFollowupDialog, setShowFollowupDialog]   = useState(false)
  const [pendingFollowupDate, setPendingFollowupDate] = useState('')
  const [pendingContactedId, setPendingContactedId]   = useState<string | null>(null)

  // Lost reason dialog
  const [showLostDialog, setShowLostDialog] = useState(false)
  const [lostReason, setLostReason]         = useState('')
  const [pendingLostId, setPendingLostId]   = useState<string | null>(null)

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

  // Convert to project form
  const [projName,     setProjName]     = useState('')
  const [projReq,      setProjReq]      = useState('')
  const [projCity,     setProjCity]     = useState('')
  const [projAssignee, setProjAssignee] = useState('')
  const [projNote,     setProjNote]     = useState('')

  const filtered = leads.filter(l => {
    if (user?.role === 'lead_manager' && l.assignee && l.assignee !== user.name) return false
    const matchFilter = filter === 'all' ? l.status !== 'lost' : l.status === filter
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
    addLead({
      name:        newName.trim(),
      phone:       newPhone.trim(),
      email:       newEmail.trim() || undefined,
      city:        newCity.trim(),
      location:    newCity.trim(),
      requirement: newReq.trim()   || 'TBD',
      notes:       newNotes.trim() || undefined,
      source:      newSource,
      interest:    newInterest,
      status:      'new',
      followUpDate:'TBD',
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
    setEditReq(selected.requirement)
    setEditNotes(selected.notes ?? '')
    setEditSource(selected.source)
    setEditInterest(selected.interest ?? 'medium')
    setEditAssignee(selected.assignee)
    setShowEdit(true)
  }

  function handleSaveEdit() {
    if (!selected || !editName.trim() || !editPhone.trim() || !editCity.trim()) return
    const updates = {
      name:        editName.trim(),
      phone:       editPhone.trim(),
      email:       editEmail.trim() || undefined,
      city:        editCity.trim(),
      location:    editCity.trim(),
      requirement: editReq.trim() || 'TBD',
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

  function openConvert() {
    if (!selected) return
    setConvertingLead(selected)
    setProjName(selected.name + ' Project')
    setProjReq(selected.requirement)
    setProjCity(selected.city)
    setProjAssignee(selected.assignee)
    setProjNote('')
    setSelected(null)
    setShowConvert(true)
  }

  function handleSaveConvert() {
    if (!projName.trim()) return
    const lead = convertingLead
    const name = projName.trim()

    const projectId = addProject({
      number:       `FC-${String(Date.now()).slice(-4)}`,
      name,
      client:       lead?.name ?? name,
      clientPhone:  lead?.phone ?? '',
      status:       'new',
      progress:     5,
      pendingTasks: 1,
      dueDate:      '—',
      value:        0,
      stage:        'Lead Converted',
      city:         projCity,
      productType:  projReq || 'TBD',
      createdAt:    new Date().toLocaleDateString('en-IN'),
      description:  projNote || projReq,
    })

    addTask({
      title:             'Assign Site Engineer',
      type:              'site_visit',
      taskKind:          'followup',
      status:            'pending',
      priority:          'high',
      dueDate:           'Today',
      assignee:          projAssignee || lead?.assignee || '',
      projectId,
      projectName:       name,
      location:          projCity,
      requiredProofType: 'none',
      proofUploads:      [],
      createdAt:         new Date().toLocaleDateString('en-IN'),
      flowStage:         'site_assign',
      flowStatus:        'ready',
      clientName:        lead?.name ?? name,
      clientPhone:       lead?.phone ?? '',
      clientEmail:       lead?.email,
      clientRequirement: projReq,
    })

    if (lead) updateLeadStatus(lead.id, 'won')
    setShowConvert(false)
    setConvertingLead(null)
    setSnack({ open: true, msg: 'Project created! Site Engineer assignment task ready.' })
    setTimeout(() => navigate(`/project/${projectId}`), 800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center gap-2 mb-3">
          <SearchBar value={search} onChange={setSearch} placeholder="Search leads…" className="flex-1" />
          <PermissionGate permission="create_lead">
            <button onClick={() => setShowNew(true)} aria-label="Add new lead"
              className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-fab active:bg-indigo-700 flex-shrink-0">
              <Plus size={19} className="text-white" strokeWidth={2.5} />
            </button>
          </PermissionGate>
        </div>
        <FilterChips chips={CHIPS} active={filter} onChange={setFilter} />
      </div>

      <div className="px-4 pt-4 space-y-2.5">
        {filtered.map(lead => (
          <button key={lead.id} onClick={() => setSelected(lead)}
            className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 active:scale-[0.98] transition-transform">
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
          </button>
        ))}

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

            {selected.status !== 'won' && selected.status !== 'lost' && (
              <PermissionGate permission="edit_lead">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Update Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['new', 'contacted', 'qualified', 'lost'] as const).map(s => (
                      <button key={s} onClick={() => handleStatusClick(s)}
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

            {/* Convert to Project — always shown but enabled only when qualified */}
            {selected.status !== 'won' && (
              <PermissionGate permission="create_project">
                <button
                  onClick={openConvert}
                  disabled={selected.status !== 'qualified'}
                  className="w-full flex items-center justify-center gap-2 border-2 border-indigo-600 text-indigo-600 rounded-xl py-3 text-sm font-bold active:bg-indigo-50 disabled:opacity-40 disabled:pointer-events-none">
                  <UserPlus size={16} /> Convert to Project
                </button>
              </PermissionGate>
            )}

            {selected.status === 'won' && (
              <button onClick={() => { setSelected(null); navigate('/projects') }}
                className="w-full flex items-center justify-center gap-2 border-2 border-emerald-600 text-emerald-600 rounded-xl py-3 text-sm font-bold active:bg-emerald-50">
                <HardHat size={16} /> View Project &amp; Tasks
              </button>
            )}
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
            <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="9876543210"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
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
            <label className="text-xs font-semibold text-slate-500 mb-2 block">Lead Source</label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setEditSource(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                    ${editSource === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 active:bg-slate-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
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

      {/* ── Convert to Project Sheet ── */}
      <BottomSheet isOpen={showConvert} onClose={() => setShowConvert(false)} title="Convert to Project" height="full">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Project Name *</label>
            <input value={projName} onChange={e => setProjName(e.target.value)} placeholder="e.g. Rajesh Villa Windows"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Requirement</label>
            <input value={projReq} onChange={e => setProjReq(e.target.value)} placeholder="What product/work is needed"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">City</label>
            <input value={projCity} onChange={e => setProjCity(e.target.value)} placeholder="Chennai"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Lead Owner</label>
            <select value={projAssignee} onChange={e => setProjAssignee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 appearance-none">
              <option value="">Select lead owner…</option>
              {leadManagers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Note <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={projNote} onChange={e => setProjNote(e.target.value)} placeholder="Any important notes…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <button onClick={handleSaveConvert} disabled={!projName.trim() || !projAssignee.trim()}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
            Convert to Project
          </button>
        </div>
      </BottomSheet>

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
            <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="9876543210"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
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
            <label className="text-xs font-semibold text-slate-500 mb-2 block">Lead Source *</label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setNewSource(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                    ${newSource === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 active:bg-slate-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
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
