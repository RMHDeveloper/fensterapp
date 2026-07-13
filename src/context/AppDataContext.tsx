import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import type { Task, TaskStatus, ProductionItem, ProductionStage, Lead, LeadStatus, Payment, Project, Mistake } from '../types'
import {
  onEngineerSiteVisitComplete,
  onQuotationSentToOwner,
  onOwnerApprovedQuotation,
  onOwnerRejectedQuotation,
  onClientApproved,
  onProductionAvailable,
  onProductionNotAvailable,
  onLabourAssigned,
} from '../utils/workflow'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { getAllProjects, upsertProject, deleteProject } from '../services/projectService'
import { getAllTasks, upsertTask, deleteTasksByProject } from '../services/taskService'
import { getAllLeads, upsertLead, deleteLead as deleteLeadRecord } from '../services/leadService'
import { getAllPayments, upsertPayment, deletePaymentsByProject } from '../services/paymentService'
import { getAllMistakes, upsertMistake } from '../services/mistakeService'
import { getAllProduction, upsertProduction } from '../services/productionService'
import { runMigrations } from '../utils/migrate'

interface AppDataContextValue {
  tasks:              Task[]
  production:         ProductionItem[]
  leads:              Lead[]
  payments:           Payment[]
  projects:           Project[]
  mistakes:           Mistake[]
  isSyncing:          boolean
  isSupabaseReady:    boolean
  syncError:          string | null

  updateTaskStatus:      (taskId: string, status: TaskStatus, note?: string, proofFiles?: string[]) => void
  updateTask:            (taskId: string, updates: Partial<Task>) => void
  updateProductionStage: (itemId: string, stage: ProductionStage, status?: 'pending' | 'started' | 'done') => void
  updateProject:         (projectId: string, updates: Partial<Project>) => void
  addLead:               (lead: Omit<Lead, 'id'>) => void
  updateLeadStatus:      (leadId: string, status: LeadStatus, extra?: { followUpDate?: string; lostReason?: string }) => void
  updateLead:            (leadId: string, updates: Partial<Lead>) => void
  deleteLead:            (leadId: string) => Promise<void>
  updatePaymentAmount:   (paymentId: string, amount: number, method: string) => void
  addTask:               (task: Omit<Task, 'id'>) => void
  addProject:            (project: Omit<Project, 'id'>) => string
  addMistake:            (mistake: Omit<Mistake, 'id'>) => void
  updateMistake:         (mistakeId: string, updates: Partial<Mistake>) => void
  resetAllData:          () => void
  refetchAll:            () => Promise<void>
  completeWorkflowStep:  (task: Task, outcome: string, extraData: Record<string, unknown>) => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

// Last-known-good snapshot of everything Supabase feeds — read on mount so a
// refresh shows real (if briefly stale) numbers instead of empty/zero cards
// while the network fetch is still in flight, and survives a fetch that
// fails outright or a Supabase read that comes back suspiciously empty
// (e.g. an RLS policy silently filtering out every row). Deliberately named
// outside the `fenster_` prefix — runMigrations() wipes any key matching
// that prefix on an app-version bump, which would otherwise nuke this cache.
const DATA_CACHE_KEY = 'fc_data_cache'
interface DataCacheShape {
  tasks: Task[]; production: ProductionItem[]; leads: Lead[]
  payments: Payment[]; projects: Project[]; mistakes: Mistake[]
}
function loadDataCache(): Partial<DataCacheShape> {
  try {
    const raw = window.localStorage.getItem(DATA_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Partial<DataCacheShape>) : {}
  } catch { return {} }
}
function saveDataCache(data: DataCacheShape) {
  try { window.localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data)) } catch { /* storage unavailable */ }
}

// A Supabase read that comes back empty when we already had real cached data
// is more likely a transient/RLS/permission problem than every record having
// genuinely vanished — keep showing the last-known-good list instead of
// clobbering it with an empty one, and flag it so it's visible, not silent.
function pickOrKeep<T>(fresh: T[], current: T[], label: string): T[] {
  if (fresh.length === 0 && current.length > 0) {
    console.warn(`[Fenster] Supabase returned 0 ${label} but ${current.length} were cached — keeping cached data. Check RLS policies / anon role permissions.`)
    return current
  }
  return fresh
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  runMigrations()

  const { isLoggedIn, isAuthReady } = useAuth()
  const [tasks,      setTasks]      = useState<Task[]>(() => loadDataCache().tasks ?? [])
  const [production, setProduction] = useState<ProductionItem[]>(() => loadDataCache().production ?? [])
  const [leads,      setLeads]      = useState<Lead[]>(() => loadDataCache().leads ?? [])
  const [payments,   setPayments]   = useState<Payment[]>(() => loadDataCache().payments ?? [])
  const [projects,   setProjects]   = useState<Project[]>(() => loadDataCache().projects ?? [])
  const [mistakes,   setMistakes]   = useState<Mistake[]>(() => loadDataCache().mistakes ?? [])
  const [isSyncing,  setIsSyncing]  = useState(false)
  const [isSupabaseReady, setIsSupabaseReady] = useState(false)
  const [syncError, setSyncError]   = useState<string | null>(null)

  // Track latest state in refs for use inside realtime callbacks
  const projectsRef   = useRef(projects)
  const tasksRef      = useRef(tasks)
  const leadsRef       = useRef(leads)
  const paymentsRef    = useRef(payments)
  const mistakesRef    = useRef(mistakes)
  const productionRef  = useRef(production)
  useEffect(() => { projectsRef.current   = projects   }, [projects])
  useEffect(() => { tasksRef.current      = tasks      }, [tasks])
  useEffect(() => { leadsRef.current      = leads      }, [leads])
  useEffect(() => { paymentsRef.current   = payments   }, [payments])
  useEffect(() => { mistakesRef.current   = mistakes   }, [mistakes])
  useEffect(() => { productionRef.current = production }, [production])

  // Write-through cache — persists on every change to this data, not just
  // after a refetchAll(), so anything the user has seen/added is available
  // immediately on the next load regardless of what the next Supabase
  // request does.
  useEffect(() => {
    saveDataCache({ tasks, production, leads, payments, projects, mistakes })
  }, [tasks, production, leads, payments, projects, mistakes])

  // ── Supabase: initial fetch + realtime ────────────────────────────────────
  async function refetchAll(): Promise<void> {
    if (!isSupabaseConfigured) return
    setIsSyncing(true)
    try {
      const [rawProjects, rawTasks, rawLeads, rawPayments, rawMistakes, rawProduction] = await Promise.all([
        getAllProjects(),
        getAllTasks(),
        getAllLeads(),
        getAllPayments(),
        getAllMistakes(),
        getAllProduction(),
      ])

      // A read that comes back empty when we already had real data is more
      // likely RLS/permissions/a transient blip than everything genuinely
      // having vanished — keep the last-known-good list in that case.
      const sbProjects   = pickOrKeep(rawProjects,   projectsRef.current,   'projects')
      const sbTasks      = pickOrKeep(rawTasks,      tasksRef.current,      'tasks')
      const sbLeads      = pickOrKeep(rawLeads,      leadsRef.current,      'leads')
      const sbPayments   = pickOrKeep(rawPayments,   paymentsRef.current,   'payments')
      const sbMistakes   = pickOrKeep(rawMistakes,   mistakesRef.current,   'mistakes')
      const sbProduction = pickOrKeep(rawProduction, productionRef.current, 'production items')

      // Backfill: push costBreakdown from task → project for existing records
      const backfilledProjects = sbProjects.map(p => {
        if (p.costBreakdown) return p
        const task = sbTasks.find(t => t.projectId === p.id && t.costBreakdown)
        if (!task?.costBreakdown) return p
        const updated = { ...p, costBreakdown: task.costBreakdown }
        upsertProject(updated)
        return updated
      })

      // Auto-heal: a project can get marked 'dropped' (client rejected the quotation,
      // MD/LO chose Drop Project) without the linked lead ever moving to Lost — leaves
      // it stuck showing as Active. Correct any lead still stuck in that state.
      const healedLeads = sbLeads.map(l => {
        if (l.status === 'lost') return l
        const proj = backfilledProjects.find(p => p.leadId === l.id)
        if (!proj) return l
        const droppedTask = sbTasks.find(t => t.projectId === proj.id && t.flowStatus === 'dropped')
        if (!droppedTask) return l
        const updated: Lead = {
          ...l, status: 'lost',
          lostReason: droppedTask.clientRejectionReason || l.lostReason || 'Dropped after client rejection',
        }
        upsertLead(updated)
        return updated
      })

      setProjects(backfilledProjects)
      setTasks(sbTasks)
      setLeads(healedLeads)
      setPayments(sbPayments)
      setMistakes(sbMistakes)
      setProduction(sbProduction)
      setSyncError(null)
    } catch (err) {
      console.warn('[Fenster] Supabase fetch error:', err)
      setSyncError(err instanceof Error ? err.message : 'Could not refresh from the server')
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    // Auth state hasn't resolved yet — wait rather than briefly clearing cached data.
    if (!isAuthReady) return

    if (!isSupabaseConfigured) { setIsSupabaseReady(true); return }

    // Logged out — nothing is fetchable under session-scoped RLS. Clear any
    // previously-loaded data so a different user logging in next doesn't
    // briefly see the last user's cached rows.
    if (!isLoggedIn) {
      setTasks([]); setProduction([]); setLeads([]); setPayments([]); setProjects([]); setMistakes([])
      setIsSupabaseReady(true)
      return
    }

    // Initial fetch from Supabase
    refetchAll().then(() => setIsSupabaseReady(true))

    if (!supabase) return

    // ── Realtime subscriptions ──────────────────────────────────────────────
    const channel = supabase
      .channel('fenster-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fenster_projects' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setProjects(prev => prev.filter(p => p.id !== id))
        } else {
          const incoming = (payload.new as { data: Project }).data
          setProjects(prev => {
            const exists = prev.some(p => p.id === incoming.id)
            return exists
              ? prev.map(p => p.id === incoming.id ? incoming : p)
              : [incoming, ...prev]
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fenster_tasks' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setTasks(prev => prev.filter(t => t.id !== id))
        } else {
          const incoming = (payload.new as { data: Task }).data
          setTasks(prev => {
            const exists = prev.some(t => t.id === incoming.id)
            return exists
              ? prev.map(t => t.id === incoming.id ? incoming : t)
              : [incoming, ...prev]
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fenster_leads' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setLeads(prev => prev.filter(l => l.id !== id))
        } else {
          const incoming = (payload.new as { data: Lead }).data
          setLeads(prev => {
            const exists = prev.some(l => l.id === incoming.id)
            return exists
              ? prev.map(l => l.id === incoming.id ? incoming : l)
              : [incoming, ...prev]
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fenster_payments' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setPayments(prev => prev.filter(p => p.id !== id))
        } else {
          const incoming = (payload.new as { data: Payment }).data
          setPayments(prev => {
            const exists = prev.some(p => p.id === incoming.id)
            return exists
              ? prev.map(p => p.id === incoming.id ? incoming : p)
              : [incoming, ...prev]
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fenster_production' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setProduction(prev => prev.filter(p => p.id !== id))
        } else {
          const incoming = (payload.new as { data: ProductionItem }).data
          setProduction(prev => {
            const exists = prev.some(p => p.id === incoming.id)
            return exists
              ? prev.map(p => p.id === incoming.id ? incoming : p)
              : [incoming, ...prev]
          })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fenster_mistakes' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id: string }).id
          setMistakes(prev => prev.filter(m => m.id !== id))
        } else {
          const incoming = (payload.new as { data: Mistake }).data
          setMistakes(prev => {
            const exists = prev.some(m => m.id === incoming.id)
            return exists
              ? prev.map(m => m.id === incoming.id ? incoming : m)
              : [incoming, ...prev]
          })
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.info('[Fenster] Realtime sync active — cross-device updates enabled.')
        }
      })

    // ── Polling fallback: refetch every 15s ─────────────────────────────────
    const pollInterval = setInterval(refetchAll, 15_000)

    // ── Refetch on tab focus ─────────────────────────────────────────────────
    const handleFocus = () => refetchAll()
    window.addEventListener('focus', handleFocus)

    return () => {
      supabase?.removeChannel(channel)
      clearInterval(pollInterval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthReady, isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Write functions ───────────────────────────────────────────────────────

  function updateTaskStatus(taskId: string, status: TaskStatus, _note?: string, proofFiles?: string[]) {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const updated = { ...t, status, proofUploads: proofFiles?.length ? [...(t.proofUploads ?? []), ...proofFiles] : (t.proofUploads ?? []) }
      upsertTask(updated)
      return updated
    }))
  }

  function updateTask(taskId: string, updates: Partial<Task>) {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const updated = { ...t, ...updates }
      upsertTask(updated)
      return updated
    }))
  }

  function updateProject(projectId: string, updates: Partial<Project>) {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p
      const updated = { ...p, ...updates }
      upsertProject(updated)
      return updated
    }))
  }

  function updateProductionStage(itemId: string, stage: ProductionStage, status?: 'pending' | 'started' | 'done') {
    setProduction(prev => prev.map(p => {
      if (p.id !== itemId) return p
      const updated = { ...p, stage, ...(status ? { status } : {}) }
      upsertProduction(updated)
      return updated
    }))
  }

  function addLead(lead: Omit<Lead, 'id'>) {
    const newLead: Lead = { ...lead, id: `lead_${Date.now()}` }
    setLeads(prev => [newLead, ...prev])
    upsertLead(newLead)
  }

  function updateLeadStatus(leadId: string, status: LeadStatus, extra?: { followUpDate?: string; lostReason?: string }) {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l
      const updated = { ...l, status, ...extra }
      upsertLead(updated)
      return updated
    }))
  }

  function updateLead(leadId: string, updates: Partial<Lead>) {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l
      const updated = { ...l, ...updates }
      upsertLead(updated)
      return updated
    }))
  }

  async function deleteLead(leadId: string): Promise<void> {
    const linkedProjectIds = projectsRef.current.filter(p => p.leadId === leadId).map(p => p.id)
    await Promise.all(linkedProjectIds.flatMap(projectId => [
      deleteProject(projectId),
      deleteTasksByProject(projectId),
      deletePaymentsByProject(projectId),
    ]))
    await deleteLeadRecord(leadId)
    setLeads(prev => prev.filter(l => l.id !== leadId))
    setProjects(prev => prev.filter(p => !linkedProjectIds.includes(p.id)))
    setTasks(prev => prev.filter(t => !linkedProjectIds.includes(t.projectId)))
    setPayments(prev => prev.filter(p => !linkedProjectIds.includes(p.projectId)))
  }

  function updatePaymentAmount(paymentId: string, amount: number, method: string) {
    setPayments(prev => prev.map(p => {
      if (p.id !== paymentId) return p
      const newReceived = p.received + amount
      const newPending  = Math.max(0, p.totalAmount - newReceived)
      const updated = {
        ...p,
        received: newReceived,
        pending:  newPending,
        status:   (newPending === 0 ? 'paid' : newReceived > 0 ? 'partial' : 'pending') as Payment['status'],
        history:  [...p.history, { id: `ph_${Date.now()}`, amount, date: new Date().toLocaleDateString('en-IN'), method }],
      }
      upsertPayment(updated)
      return updated
    }))
  }

  function addTask(task: Omit<Task, 'id'>) {
    const newTask: Task = { ...task, id: `task_${Date.now()}` }
    setTasks(prev => [newTask, ...prev])
    upsertTask(newTask)
  }

  function addProject(project: Omit<Project, 'id'>): string {
    const id = `proj_${Date.now()}`
    const newProject: Project = { ...project, id }
    setProjects(prev => [newProject, ...prev])
    upsertProject(newProject)
    return id
  }

  function addMistake(mistake: Omit<Mistake, 'id'>) {
    const newMistake: Mistake = { ...mistake, id: `mistake_${Date.now()}` }
    setMistakes(prev => [newMistake, ...prev])
    upsertMistake(newMistake)
  }

  function updateMistake(mistakeId: string, updates: Partial<Mistake>) {
    setMistakes(prev => prev.map(m => {
      if (m.id !== mistakeId) return m
      const updated = { ...m, ...updates }
      upsertMistake(updated)
      return updated
    }))
  }

  function resetAllData() {
    setTasks([])
    setProduction([])
    setLeads([])
    setPayments([])
    setProjects([])
    setMistakes([])
  }

  function completeWorkflowStep(task: Task, outcome: string, extraData: Record<string, unknown>) {
    const step  = task.workflowStep
    const pid   = task.projectId
    const pname = task.projectName

    let newTasks: Omit<Task, 'id'>[] = []

    if (step === 'site_visit' && outcome === 'completed') {
      setTasks(prev => prev.map(t =>
        t.workflowStep === 'site_visit_followup' && t.projectId === pid
          ? { ...t, status: 'completed' as TaskStatus, sitePhoto: extraData.sitePhoto as string, measurementPhoto: extraData.measurementPhoto as string, measurementDetails: extraData.measurementDetails as string }
          : t
      ))
      newTasks = onEngineerSiteVisitComplete(
        pid, pname, task.location ?? '',
        task.workerName ?? task.assignee,
        extraData.sitePhoto as string,
        extraData.measurementPhoto as string,
        extraData.measurementDetails as string,
      )
    } else if (step === 'quotation_draft' && outcome === 'sent_to_owner') {
      newTasks = onQuotationSentToOwner(
        pid, pname,
        (extraData.clientName as string) ?? '',
        (extraData.requirement as string) ?? '',
        extraData.amount as number,
        extraData.productType as string,
        extraData.quantity as number,
        (extraData.notes as string) ?? '',
      )
    } else if (step === 'quotation_owner_approval' && outcome === 'approved') {
      newTasks = onOwnerApprovedQuotation(pid, pname, extraData.amount as number, extraData.productType as string)
    } else if (step === 'quotation_owner_approval' && outcome === 'rejected') {
      newTasks = onOwnerRejectedQuotation(pid, pname)
    } else if (step === 'quotation_send_client' && outcome === 'client_approved') {
      newTasks = onClientApproved(pid, pname, (extraData.clientName as string) ?? '', extraData.productType as string, extraData.quantity as number)
    } else if (step === 'production_check' && outcome === 'available') {
      newTasks = onProductionAvailable(pid, pname, extraData.productType as string)
    } else if (step === 'production_check' && outcome === 'not_available') {
      newTasks = onProductionNotAvailable(pid, pname, extraData.productType as string)
    } else if (step === 'installation_assign' && outcome === 'assigned') {
      newTasks = onLabourAssigned(
        pid, pname,
        extraData.labourName as string,
        extraData.installationDate as string,
        task.location ?? '',
        extraData.productType as string,
      )
    }

    for (const t of newTasks) {
      addTask(t)
    }
  }

  return (
    <AppDataContext.Provider value={{
      tasks, production, leads, payments, projects, mistakes,
      isSyncing, isSupabaseReady, syncError,
      updateTaskStatus, updateTask, updateProductionStage, updateProject,
      addLead, updateLeadStatus, updateLead, deleteLead,
      updatePaymentAmount, addTask, addProject, addMistake, updateMistake, resetAllData,
      refetchAll,
      completeWorkflowStep,
    }}>
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
