import { useState, useEffect, useMemo } from 'react'
import { FileText, Image, Upload, FolderOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { canUserSeeProject } from '../../utils/stageHelpers'
import { getTaskFileEntries, type AggregatedFile } from '../../utils/taskFiles'
import { getProjectFiles, uploadProjectFile } from '../../services/fileService'
import { getDisplayFileName } from '../../utils/fileStorage'
import { resolveFileUrl } from '../../utils/sessionStore'
import { FilterChips } from '../../components/forms/FilterChips'
import { SearchBar } from '../../components/forms/SearchBar'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { FilePreviewModal } from '../../components/feedback/FilePreviewModal'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { FileCategory } from '../../types'

type Filter = 'all' | FileCategory

const CATEGORY_LABEL: Record<FileCategory, string> = {
  site_photo:       'Site Photos',
  quotation:        'Quotations',
  job_sheet:        'Job Sheets',
  qc_photo:         'QC Photos',
  cutting_sheet:    'Cutting Sheets',
  glass_sheet:      'Glass Sheets',
  proof:            'Proofs',
  voice_note:       'Voice Notes',
  other:            'Other',
  project_file:     'Project Files',
  project_doc:      'Project Docs',
  measurement_doc:  'Measurement Files',
  production_doc:   'Production Docs',
  installation_doc: 'Installation Photos',
}

const CATEGORY_COLOR: Record<FileCategory, string> = {
  site_photo:       'bg-cyan-50 text-cyan-700',
  quotation:        'bg-violet-50 text-violet-700',
  job_sheet:        'bg-amber-50 text-amber-700',
  qc_photo:         'bg-teal-50 text-teal-700',
  cutting_sheet:    'bg-orange-50 text-orange-700',
  glass_sheet:      'bg-blue-50 text-blue-700',
  proof:            'bg-red-50 text-red-700',
  voice_note:       'bg-purple-50 text-purple-700',
  other:            'bg-slate-100 text-slate-600',
  project_file:     'bg-slate-100 text-slate-600',
  project_doc:      'bg-indigo-50 text-indigo-700',
  measurement_doc:  'bg-cyan-50 text-cyan-700',
  production_doc:   'bg-amber-50 text-amber-700',
  installation_doc: 'bg-purple-50 text-purple-700',
}

const UPLOAD_CATEGORIES: FileCategory[] = ['project_doc', 'site_photo', 'quotation', 'job_sheet', 'other']

function isImageUrl(url: string) { return /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(url) || url.startsWith('data:image') }

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function FilesScreen() {
  const { user, can } = useAuth()
  const { tasks, projects } = useAppData()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AggregatedFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [uploadCategory, setUploadCategory] = useState<FileCategory>('project_doc')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [projectSheetFiles, setProjectSheetFiles] = useState<AggregatedFile[]>([])
  const [snack, setSnack] = useState({ open: false, msg: '' })

  // Only projects (and therefore only files) this user is actually allowed to see —
  // same rule ProjectsScreen uses, so this screen can never show more than that does.
  const visibleProjects = useMemo(
    () => projects.filter(p => canUserSeeProject(p, tasks, user)),
    [projects, tasks, user]
  )
  const visibleProjectIds = useMemo(() => new Set(visibleProjects.map(p => p.id)), [visibleProjects])

  // Files embedded directly in task records (site photos, measurement files,
  // job/glass/cutting sheets, installation photos, quotations) — the vast
  // majority of what actually gets uploaded during the project flow.
  const taskFiles = useMemo(
    () => tasks.filter(t => visibleProjectIds.has(t.projectId)).flatMap(getTaskFileEntries),
    [tasks, visibleProjectIds]
  )

  // Separately-tracked project documents (fenster_files table) — a narrower,
  // secondary upload path used from Project Detail's own file section.
  useEffect(() => {
    let cancelled = false
    Promise.all(visibleProjects.map(p => getProjectFiles(p.id))).then(results => {
      if (cancelled) return
      const flat = results.flat().map(row => ({
        id: row.id, url: row.url, category: (row.category as FileCategory) ?? 'project_doc',
        label: CATEGORY_LABEL[(row.category as FileCategory) ?? 'project_doc'] ?? 'File',
        taskId: row.taskId ?? '', projectId: row.projectId,
        projectName: visibleProjects.find(p => p.id === row.projectId)?.name ?? '',
        uploadedAt: row.uploadedAt,
      }))
      setProjectSheetFiles(flat)
    })
    return () => { cancelled = true }
  }, [visibleProjects])

  const allFiles = useMemo(
    () => [...projectSheetFiles, ...taskFiles].sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '')),
    [projectSheetFiles, taskFiles]
  )

  const availableCategories = useMemo(
    () => Array.from(new Set(allFiles.map(f => f.category))),
    [allFiles]
  )
  const chips = [
    { value: 'all' as Filter, label: 'All' },
    ...availableCategories.map(c => ({ value: c as Filter, label: CATEGORY_LABEL[c] ?? c })),
  ]

  const filtered = allFiles.filter(f => {
    const matchFilter = filter === 'all' || f.category === filter
    const matchSearch = !search
      || getDisplayFileName(f.url).toLowerCase().includes(search.toLowerCase())
      || f.projectName.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  async function handleUpload() {
    if (!uploadProjectId || !uploadFile) return
    setUploading(true)
    try {
      await uploadProjectFile({
        projectId: uploadProjectId, category: uploadCategory, file: uploadFile,
        uploadedBy: user?.name, uploadedByRole: user?.role,
      })
      const rows = await getProjectFiles(uploadProjectId)
      setProjectSheetFiles(prev => [
        ...prev.filter(f => f.projectId !== uploadProjectId),
        ...rows.map(row => ({
          id: row.id, url: row.url, category: (row.category as FileCategory) ?? 'project_doc',
          label: CATEGORY_LABEL[(row.category as FileCategory) ?? 'project_doc'] ?? 'File',
          taskId: row.taskId ?? '', projectId: row.projectId,
          projectName: visibleProjects.find(p => p.id === row.projectId)?.name ?? '',
          uploadedAt: row.uploadedAt,
        })),
      ])
      setShowUpload(false)
      setUploadFile(null)
      setUploadProjectId('')
      setSnack({ open: true, msg: 'File uploaded!' })
    } catch (err) {
      setSnack({ open: true, msg: err instanceof Error ? err.message : 'Upload failed.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AppHeader />
      {/* Sub-header */}
      <div className="bg-white px-5 pt-4 pb-4 border-b border-slate-100 sticky top-14 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Files</h1>
              <p className="text-xs text-slate-500">{allFiles.length} file{allFiles.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {can('upload_files') && visibleProjects.length > 0 && (
            <button onClick={() => setShowUpload(true)}
              className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-fab active:bg-indigo-700">
              <Upload size={17} className="text-white" strokeWidth={2.5} />
            </button>
          )}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search files…" className="mb-3" />
        <FilterChips chips={chips} active={filter} onChange={setFilter} />
      </div>

      <div className="px-4 pt-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-10 text-center">
            <FolderOpen size={36} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No files found</p>
          </div>
        ) : (
          filtered.map(file => {
            const src = resolveFileUrl(file.url)
            const isImg = isImageUrl(file.url)
            return (
              <button key={file.id} onClick={() => setSelected(file)}
                className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 flex items-center gap-3.5 active:scale-[0.98] transition-transform">
                <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {isImg && src
                    ? <img src={src} alt={file.label} className="w-full h-full object-cover" />
                    : <FileText size={22} className="text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{getDisplayFileName(file.url)}</p>
                  <p className="text-xs text-slate-500 truncate">{file.projectName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLOR[file.category] ?? CATEGORY_COLOR.other}`}>
                      {file.label}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400">{fmtDate(file.uploadedAt)}</p>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* File Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? getDisplayFileName(selected.url) : ''}>
        {selected && (() => {
          const src = resolveFileUrl(selected.url)
          const isImg = isImageUrl(selected.url)
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {isImg && src
                    ? <img src={src} alt={selected.label} className="w-full h-full object-cover" />
                    : <FileText size={28} className="text-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{getDisplayFileName(selected.url)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLOR[selected.category] ?? CATEGORY_COLOR.other}`}>
                    {selected.label}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
                {[
                  { label: 'Project', value: selected.projectName || '—' },
                  { label: 'Date',    value: fmtDate(selected.uploadedAt) || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-xs text-slate-400 font-medium">{label}</span>
                    <span className="text-xs font-semibold text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { if (src) setPreviewUrl(src) }}
                  disabled={!src}
                  className="bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
                  View
                </button>
                <a href={src} download={getDisplayFileName(selected.url)} target="_blank" rel="noopener noreferrer"
                  className="border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-semibold active:bg-slate-50 text-center">
                  Download
                </a>
              </div>
            </div>
          )
        })()}
      </BottomSheet>

      {previewUrl && (
        <FilePreviewModal src={previewUrl} name={selected ? getDisplayFileName(selected.url) : 'File'} onClose={() => setPreviewUrl(null)} />
      )}

      {/* Upload Sheet */}
      <BottomSheet isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload File">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Project *</label>
            <select value={uploadProjectId} onChange={e => setUploadProjectId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400">
              <option value="">Select project</option>
              {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Category</label>
            <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value as FileCategory)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400">
              {UPLOAD_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <label className="border-2 border-dashed border-slate-200 rounded-2xl py-10 flex flex-col items-center gap-3 active:bg-slate-50 cursor-pointer">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
              {uploadFile ? <Image size={22} className="text-indigo-500" /> : <Upload size={22} className="text-indigo-500" />}
            </div>
            <div className="text-center px-4">
              <p className="text-sm font-semibold text-slate-700 truncate max-w-[220px]">
                {uploadFile ? uploadFile.name : 'Tap to choose file'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG, XLSX — max 3MB</p>
            </div>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
          </label>
          <button onClick={handleUpload} disabled={!uploadProjectId || !uploadFile || uploading}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700 disabled:opacity-50">
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
