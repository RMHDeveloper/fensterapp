import { useState } from 'react'
import { Phone, Plus, UserPlus, HardHat } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useNavigate } from 'react-router-dom'
import { PermissionGate } from '../../components/layout/PermissionGate'
import { StatusBadge } from '../../components/badges/StatusBadge'
import { PriorityBadge } from '../../components/badges/PriorityBadge'
import { FilterChips } from '../../components/forms/FilterChips'
import { SearchBar } from '../../components/forms/SearchBar'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import type { Lead, LeadStatus } from '../../types'

type Filter = 'all' | LeadStatus

const CHIPS = [
  { value: 'all'       as Filter, label: 'All'       },
  { value: 'new'       as Filter, label: 'New'       },
  { value: 'contacted' as Filter, label: 'Contacted' },
  { value: 'qualified' as Filter, label: 'Qualified' },
  { value: 'proposal'  as Filter, label: 'Proposal'  },
  { value: 'won'       as Filter, label: 'Won'       },
]

const SOURCE_LABEL: Record<string, string> = {
  cold_call: '📞 Cold Call', referral: '🤝 Referral',
  walk_in: '🚶 Walk-in', online: '🌐 Online',
}

export default function LeadsScreen() {
  const { leads, updateLeadStatus, addProject, addTask, addLead } = useAppData()
  const navigate = useNavigate()
  const [filter,   setFilter]   = useState<Filter>('all')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null)
  const [snack,    setSnack]    = useState({ open: false, msg: '' })

  // New lead form state
  const [newName,     setNewName]     = useState('')
  const [newPhone,    setNewPhone]    = useState('')
  const [newEmail,    setNewEmail]    = useState('')
  const [newCity,     setNewCity]     = useState('')
  const [newBudget,   setNewBudget]   = useState('')
  const [newReq,      setNewReq]      = useState('')
  const [newNotes,    setNewNotes]    = useState('')

  // Convert to project form state
  const [projName,     setProjName]     = useState('')
  const [projReq,      setProjReq]      = useState('')
  const [projCity,     setProjCity]     = useState('')
  const [projBudget,   setProjBudget]   = useState('')
  const [projAssignee, setProjAssignee] = useState('')
  const [projNote,     setProjNote]     = useState('')

  const filtered = leads.filter(l => {
    const matchFilter = filter === 'all' || l.status === filter
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search) || l.city.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const handleUpdate = (status?: LeadStatus) => {
    if (selected && status) {
      updateLeadStatus(selected.id, status)
      if (status === 'qualified') {
        const projectName = `${selected.name.split(' ')[0]} Project`
        addTask({
          title: 'Assign Site Engineer',
          type: 'site_visit',
          taskKind: 'followup',
          status: 'pending',
          priority: 'high',
          dueDate: 'Today',
          assignee: 'Sales Team',
          projectId: '',
          projectName,
          location: selected.location ?? selected.city,
          requiredProofType: 'none',
          proofUploads: [],
          createdAt: new Date().toLocaleDateString('en-IN'),
          flowStage: 'site_assign',
          flowStatus: 'ready',
          clientName: selected.name,
          clientPhone: selected.phone,
          clientEmail: selected.email,
          clientRequirement: selected.requirement,
        })
      }
    }
    setSelected(null)
    setSnack({ open: true, msg: status === 'qualified' ? 'Lead qualified! Assign Site Engineer task created.' : 'Lead updated!' })
  }

  function handleAddLead() {
    if (!newName.trim() || !newPhone.trim() || !newCity.trim()) return
    addLead({
      name:        newName.trim(),
      phone:       newPhone.trim(),
      email:       newEmail.trim() || undefined,
      city:        newCity.trim(),
      location:    newCity.trim(),
      budgetRange: newBudget.trim() || undefined,
      requirement: newReq.trim()   || 'TBD',
      notes:       newNotes.trim() || undefined,
      source:      'cold_call',
      status:      'new',
      followUpDate:'TBD',
      priority:    'medium',
      assignee:    'Sales Team',
      createdAt:   new Date().toLocaleDateString('en-IN'),
    })
    setNewName(''); setNewPhone(''); setNewEmail(''); setNewCity('')
    setNewBudget(''); setNewReq(''); setNewNotes('')
    setShowNew(false)
    setSnack({ open: true, msg: 'Lead created successfully!' })
  }

  function openConvert() {
    if (!selected) return
    setConvertingLead(selected)
    setProjName(selected.name + ' Project')
    setProjReq(selected.requirement)
    setProjCity(selected.city)
    setProjBudget(selected.budgetRange ?? '')
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

    // Create the first flow task so the workflow can begin
    addTask({
      title:             'Assign Site Engineer',
      type:              'site_visit',
      taskKind:          'followup',
      status:            'pending',
      priority:          'high',
      dueDate:           'Today',
      assignee:          projAssignee || 'Sales Team',
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
    setSnack({ open: true, msg: `Project created! Site Engineer assignment task ready.` })
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
              <Plus size={19} className="text-white" strokeWidth={2.5} aria-hidden="true" />
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
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-slate-800">{lead.name}</h3>
                  <PriorityBadge priority={lead.priority} showLabel={false} />
                </div>
                <p className="text-xs text-slate-500 truncate mb-1.5">{lead.requirement}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span>{SOURCE_LABEL[lead.source]}</span>
                  <span>·</span>
                  <span>{lead.city}</span>
                  {lead.budgetRange && <><span>·</span><span className="text-teal-600 font-medium">{lead.budgetRange}</span></>}
                </div>
              </div>
              <StatusBadge status={lead.status} size="xs" />
            </div>
            <div className="flex items-center gap-2 mt-3 border-t border-slate-100 pt-3">
              <span className="flex-1 text-[11px] text-slate-400">📅 Follow-up: <span className="text-slate-600 font-medium">{lead.followUpDate}</span></span>
              <span className="text-[11px] text-slate-400">{lead.assignee}</span>
              <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                className="w-8 h-8 bg-teal-50 rounded-xl flex items-center justify-center active:bg-teal-100 flex-shrink-0">
                <Phone size={14} className="text-teal-600" />
              </a>
            </div>
          </button>
        ))}
      </div>

      {/* Lead Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} height="full">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selected.status} size="md" />
              <PriorityBadge priority={selected.priority} size="md" />
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Phone',       value: selected.phone },
                { label: 'Requirement', value: selected.requirement },
                { label: 'Source',      value: SOURCE_LABEL[selected.source] },
                { label: 'City',        value: selected.city },
                { label: 'Budget',      value: selected.budgetRange ?? '—' },
                { label: 'Assignee',    value: selected.assignee },
                { label: 'Follow-up',   value: selected.followUpDate },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700 text-right max-w-[55%]">{value}</span>
                </div>
              ))}
            </div>
            <PermissionGate permission="edit_lead">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Update Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['new', 'contacted', 'qualified', 'lost'] as const).map(s => (
                    <button key={s} onClick={() => handleUpdate(s)}
                      className={`py-3 rounded-xl text-xs font-bold border-2 capitalize
                        ${selected.status === s ? 'bg-indigo-600 text-white border-indigo-600'
                          : s === 'qualified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : s === 'lost' ? 'bg-red-50 text-red-600 border-red-200'
                          : 'bg-white text-slate-600 border-slate-200'}`}>
                      {s === 'qualified' ? '✓ Qualified' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </PermissionGate>
            <a href={`tel:${selected.phone}`}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-teal-700">
              <Phone size={16} aria-hidden="true" /> Call {selected.name.split(' ')[0]}
            </a>
            {/* Only show Convert to Project if NOT already qualified/won/converted */}
            {selected.status !== 'qualified' && selected.status !== 'won' && (
              <PermissionGate permission="create_project">
                <button onClick={openConvert}
                  className="w-full flex items-center justify-center gap-2 border-2 border-indigo-600 text-indigo-600 rounded-xl py-3 text-sm font-bold active:bg-indigo-50">
                  <UserPlus size={16} aria-hidden="true" /> Convert to Project
                </button>
              </PermissionGate>
            )}
            {/* After qualified: show View Project shortcut */}
            {(selected.status === 'qualified' || selected.status === 'won') && (
              <button onClick={() => { setSelected(null); navigate('/projects') }}
                className="w-full flex items-center justify-center gap-2 border-2 border-emerald-600 text-emerald-600 rounded-xl py-3 text-sm font-bold active:bg-emerald-50">
                <HardHat size={16} aria-hidden="true" /> View Project &amp; Tasks
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Convert to Project Sheet */}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">City</label>
              <input value={projCity} onChange={e => setProjCity(e.target.value)} placeholder="Chennai"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Budget</label>
              <input value={projBudget} onChange={e => setProjBudget(e.target.value)} placeholder="₹1.5L"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Assignee</label>
            <input value={projAssignee} onChange={e => setProjAssignee(e.target.value)} placeholder="Team member name"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Note <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={projNote} onChange={e => setProjNote(e.target.value)} placeholder="Any important notes…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <button onClick={handleSaveConvert} disabled={!projName.trim()}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
            Convert to Project
          </button>
        </div>
      </BottomSheet>

      {/* New Lead Sheet */}
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
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Email</label>
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
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Budget Range <span className="text-slate-300 font-normal">(optional)</span></label>
            <input type="text" value={newBudget} onChange={e => setNewBudget(e.target.value)} placeholder="₹50K - 1L"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes <span className="text-slate-300 font-normal">(optional)</span></label>
            <textarea rows={2} value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Any additional notes…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <button onClick={handleAddLead} disabled={!newName.trim() || !newPhone.trim() || !newCity.trim()}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
            Add Lead
          </button>
        </div>
      </BottomSheet>


      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
