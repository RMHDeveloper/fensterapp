import type { Task, FileCategory } from '../types'

export interface AggregatedFile {
  id: string
  url: string
  category: FileCategory
  label: string
  taskId: string
  projectId: string
  projectName: string
  uploadedAt?: string
}

// Real uploads generated during the project flow (site photos, measurement
// files, job/glass/cutting sheets, installation photos, quotations) live
// embedded directly in the task record that produced them — there is no
// separate central files table for these. This pulls them back out into a
// flat, browsable list for a given task.
export function getTaskFileEntries(task: Task): AggregatedFile[] {
  const entries: AggregatedFile[] = []
  const push = (url: string | undefined, category: FileCategory, label: string, idx = 0) => {
    if (!url) return
    entries.push({
      id: `${task.id}_${category}_${idx}`, url, category, label,
      taskId: task.id, projectId: task.projectId, projectName: task.projectName,
      uploadedAt: task.createdAt,
    })
  }
  ;(task.sitePhotos ?? []).forEach((u, i) => push(u, 'site_photo', 'Site Photo', i))
  ;(task.measurementFiles ?? []).forEach((u, i) => push(u, 'measurement_doc', 'Measurement File', i))
  push(task.quotationFile, 'quotation', 'Quotation')
  push(task.jobSheet, 'job_sheet', 'Job Sheet')
  push(task.glassSheet, 'glass_sheet', 'Glass Sheet')
  push(task.cuttingSheet, 'cutting_sheet', 'Cutting Sheet')
  ;(task.additionalDocs ?? []).forEach((u, i) => push(u, 'production_doc', 'Additional Doc', i))
  ;(task.installationFiles ?? []).forEach((u, i) => push(u, 'installation_doc', 'Installation Photo', i))
  return entries
}
