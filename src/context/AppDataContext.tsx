import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import type { Task, TaskStatus, ProductionItem, ProductionStage, Lead, LeadStatus, Payment, Project, Mistake } from '../types'
import {
  loadTasks, loadProduction, loadLeads, loadPayments, loadProjects, loadMistakes,
  saveToStorage, initStorageIfEmpty, resetMockData, STORAGE_KEYS,
} from '../utils/storage'
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
import { getAllProjects, upsertProject } from '../services/projectService'
import { getAllTasks, upsertTask } from '../services/taskService'
import { getAllLeads, upsertLead } from '../services/leadService'
import { getAllPayments, upsertPayment } from '../services/paymentService'
import { getAllMistakes, upsertMistake } from '../services/mistakeService'
import { getAllProduction, upsertProduction } from '../services/productionService'

interface AppDataContextValue {
  tasks:              Task[]
  production:         ProductionItem[]
  leads:              Lead[]
  payments:           Payment[]
  projects:           Project[]
  mistakes:           Mistake[]
  isSyncing:          boolean
  isSupabaseReady:    boolean

  updateTaskStatus:      (taskId: string, status: TaskStatus, note?: string, proofFiles?: string[]) => void
  updateTask:            (taskId: string, updates: Partial<Task>) => void
  updateProductionStage: (itemId: string, stage: ProductionStage, status?: 'pending' | 'started' | 'done') => void
  updateProject:         (projectId: string, updates: Partial<Project>) => void
  addLead:               (lead: Omit<Lead, 'id'>) => void
  updateLeadStatus:      (leadId: string, status: LeadStatus) => void
  updatePaymentAmount:   (paymentId: string, amount: number, method: string) => void
  addTask:               (task: Omit<Task, 'id'>) => void
  addProject:            (project: Omit<Project, 'id'>) => string
  addMistake:            (mistake: Omit<Mistake, 'id'>) => void
  resetAllData:          () => void
  refetchAll:            () => Promise<void>
  completeWorkflowStep:  (task: Task, outcome: string, extraData: Record<string, unknown>) => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  useEffect(() => { initStorageIfEmpty() }, [])

  const [tasks,      setTasks]      = useState<Task[]>(() => loadTasks())
  const [production, setProduction] = useState<ProductionItem[]>(() => loadProduction())
  const [leads,      setLeads]      = useState<Lead[]>(() => loadLeads())
  const [payments,   setPayments]   = useState<Payment[]>(() => loadPayments())
  const [projects,   setProjects]   = useState<Project[]>(() => loadProjects())
  const [mistakes,   setMistakes]   = useState<Mistake[]>(() => loadMistakes())
  const [isSyncing,  setIsSyncing]  = useState(false)
  const [isSupabaseReady, setIsSupabaseReady] = useState(false)

  // Track latest state in refs for use inside realtime callbacks
  const projectsRef = useRef(projects)
  const tasksRef    = useRef(tasks)
  const leadsRef    = useRef(leads)
  const paymentsRef = useRef(payments)
  const mistakesRef = useRef(mistakes)
  useEffect(() => { projectsRef.current = projects }, [projects])
  useEffect(() => { tasksRef.current    = tasks    }, [tasks])
  useEffect(() => { leadsRef.current    = leads    }, [leads])
  useEffect(() => { paymentsRef.current = payments }, [payments])
  useEffect(() => { mistakesRef.current = mistakes }, [mistakes])

  // Persist to localStorage whenever state changes
  useEffect(() => { saveToStorage(STORAGE_KEYS.TASKS,      tasks)      }, [tasks])
  useEffect(() => { saveToStorage(STORAGE_KEYS.PRODUCTION, production) }, [production])
  useEffect(() => { saveToStorage(STORAGE_KEYS.LEADS,      leads)      }, [leads])
  useEffect(() => { saveToStorage(STORAGE_KEYS.PAYMENTS,   payments)   }, [payments])
  useEffect(() => { saveToStorage(STORAGE_KEYS.PROJECTS,   projects)   }, [projects])
  useEffect(() => { saveToStorage(STORAGE_KEYS.MISTAKES,   mistakes)   }, [mistakes])

  // ── Supabase: initial fetch + realtime ────────────────────────────────────
  async function refetchAll(): Promise<void> {
    if (!isSupabaseConfigured) return
    setIsSyncing(true)
    try {
      const [sbProjects, sbTasks, sbLeads, sbPayments, sbMistakes, sbProduction] = await Promise.all([
        getAllProjects(),
        getAllTasks(),
        getAllLeads(),
        getAllPayments(),
        getAllMistakes(),
        getAllProduction(),
      ])
      if (sbProjects.length    > 0) setProjects(sbProjects)
      if (sbTasks.length       > 0) setTasks(sbTasks)
      if (sbLeads.length       > 0) setLeads(sbLeads)
      if (sbPayments.length    > 0) setPayments(sbPayments)
      if (sbMistakes.length    > 0) setMistakes(sbMistakes)
      if (sbProduction.length  > 0) setProduction(sbProduction)
    } catch (err) {
      console.warn('[Fenster] Supabase fetch error:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return

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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  function updateLeadStatus(leadId: string, status: LeadStatus) {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l
      const updated = { ...l, status }
      upsertLead(updated)
      return updated
    }))
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

  function resetAllData() {
    resetMockData()
    setTasks(loadTasks())
    setProduction(loadProduction())
    setLeads(loadLeads())
    setPayments(loadPayments())
    setProjects(loadProjects())
    setMistakes(loadMistakes())
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
      isSyncing, isSupabaseReady,
      updateTaskStatus, updateTask, updateProductionStage, updateProject,
      addLead, updateLeadStatus,
      updatePaymentAmount, addTask, addProject, addMistake, resetAllData,
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
