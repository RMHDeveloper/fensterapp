import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { storeFile, deleteRemoteFile } from '../utils/fileStorage'
import type { FileCategory } from '../types'

const TABLE = 'fenster_files'
const LOCAL_KEY = 'fenster_files_fallback'

export interface FileRow {
  id: string
  projectId: string
  taskId?: string
  leadId?: string
  category: FileCategory | string
  fileName: string
  fileType?: string
  fileSize?: number
  url: string
  versionNumber?: number
  uploadedBy?: string
  uploadedByRole?: string
  uploadedAt: string
  metadata?: Record<string, unknown>
}

// ─── localStorage fallback (only used when Supabase isn't configured) ─────────
function readLocalAll(): FileRow[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as FileRow[]) : []
  } catch {
    return []
  }
}

function writeLocalAll(rows: FileRow[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rows))
  } catch { /* storage unavailable — nothing more we can do */ }
}

function sortNewestFirst(rows: FileRow[]): FileRow[] {
  return [...rows].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}

export interface UploadFileOptions {
  projectId: string
  taskId?: string
  leadId?: string
  category: FileCategory | string
  file: File
  uploadedBy?: string
  uploadedByRole?: string
  metadata?: Record<string, unknown>
}

async function insertRow(row: FileRow): Promise<FileRow> {
  if (supabase) {
    const { error } = await supabase.from(TABLE).upsert({
      id: row.id,
      project_id: row.projectId,
      task_id: row.taskId ?? '',
      category: row.category,
      data: row,
      updated_at: row.uploadedAt,
    }, { onConflict: 'id' })
    if (error) console.error('[Fenster] file sync error:', error.message)
  } else {
    const all = readLocalAll()
    all.push(row)
    writeLocalAll(all)
  }
  return row
}

export async function uploadProjectFile(opts: UploadFileOptions): Promise<FileRow> {
  const url = await storeFile(opts.file)
  return recordUploadedFile({
    projectId: opts.projectId,
    taskId: opts.taskId,
    leadId: opts.leadId,
    category: opts.category,
    fileName: opts.file.name,
    fileType: opts.file.type,
    fileSize: opts.file.size,
    url,
    uploadedBy: opts.uploadedBy,
    uploadedByRole: opts.uploadedByRole,
    metadata: opts.metadata,
  })
}

export interface RecordUploadedFileOptions {
  projectId: string
  taskId?: string
  leadId?: string
  category: FileCategory | string
  fileName: string
  fileType?: string
  fileSize?: number
  url: string
  uploadedBy?: string
  uploadedByRole?: string
  metadata?: Record<string, unknown>
}

/** Records metadata for a file that was already uploaded elsewhere (e.g. by MultiFileUploadField), avoiding a duplicate upload. */
export async function recordUploadedFile(opts: RecordUploadedFileOptions): Promise<FileRow> {
  const now = new Date().toISOString()

  let versionNumber: number | undefined
  if (opts.category === 'quotation') {
    const existing = await getProjectFiles(opts.projectId, 'quotation', opts.taskId)
    versionNumber = Math.max(0, ...existing.map(f => f.versionNumber ?? 1)) + 1
  }

  const row: FileRow = {
    id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: opts.projectId,
    taskId: opts.taskId,
    leadId: opts.leadId,
    category: opts.category,
    fileName: opts.fileName,
    fileType: opts.fileType,
    fileSize: opts.fileSize,
    url: opts.url,
    versionNumber,
    uploadedBy: opts.uploadedBy,
    uploadedByRole: opts.uploadedByRole,
    uploadedAt: now,
    metadata: opts.metadata,
  }

  // Debug log to help trace duplicate-URL issues in production/dev
  try {
    // eslint-disable-next-line no-console
    console.debug('[Fenster] recordUploadedFile:', { projectId: opts.projectId, taskId: opts.taskId, fileName: opts.fileName, url: opts.url, uploadedBy: opts.uploadedBy })
  } catch {}

  return insertRow(row)
}

export async function getProjectFiles(projectId: string, category?: FileCategory | string, taskId?: string): Promise<FileRow[]> {
  if (supabase) {
    let query = supabase.from(TABLE).select('data').eq('project_id', projectId).order('created_at', { ascending: false })
    if (category) query = query.eq('category', category)
    if (taskId) query = query.eq('task_id', taskId)
    const { data, error } = await query
    if (error || !data) return []
    return sortNewestFirst(data.map(r => r.data as FileRow))
  }
  const all = readLocalAll().filter(f => f.projectId === projectId)
  const filtered = all
    .filter(f => !category || f.category === category)
    .filter(f => !taskId || f.taskId === taskId)
  return sortNewestFirst(filtered)
}

export async function getTaskFiles(taskId: string, category?: FileCategory | string): Promise<FileRow[]> {
  if (supabase) {
    let query = supabase.from(TABLE).select('data').eq('task_id', taskId).order('created_at', { ascending: false })
    if (category) query = query.eq('category', category)
    const { data, error } = await query
    if (error || !data) return []
    return sortNewestFirst(data.map(r => r.data as FileRow))
  }
  const filtered = readLocalAll().filter(f => f.taskId === taskId && (!category || f.category === category))
  return sortNewestFirst(filtered)
}

export async function deleteUpload(id: string): Promise<void> {
  if (supabase) {
    const { data } = await supabase.from(TABLE).select('data').eq('id', id).single()
    const row = data?.data as FileRow | undefined
    await supabase.from(TABLE).delete().eq('id', id)
    if (row?.url) await deleteRemoteFile(row.url)
    return
  }
  const all = readLocalAll()
  const row = all.find(f => f.id === id)
  writeLocalAll(all.filter(f => f.id !== id))
  if (row?.url) await deleteRemoteFile(row.url)
}

export async function getQuotationVersions(projectId: string, taskId?: string): Promise<FileRow[]> {
  const rows = await getProjectFiles(projectId, 'quotation', taskId)
  return rows.sort((a, b) => (b.versionNumber ?? 1) - (a.versionNumber ?? 1))
}

export async function getLatestQuotation(projectId: string, taskId?: string): Promise<FileRow | undefined> {
  const versions = await getQuotationVersions(projectId, taskId)
  return versions[0]
}

export function subscribeToProjectFiles(projectId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {}
  const client = supabase
  const channel = client
    .channel(`fenster_files_${projectId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `project_id=eq.${projectId}` }, onChange)
    .subscribe()
  return () => { client.removeChannel(channel) }
}
