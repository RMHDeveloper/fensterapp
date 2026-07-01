import { useState } from 'react'
import { FileText, Image, Table, Upload, FolderOpen } from 'lucide-react'
import { FILES } from '../../data/mockData'
import { useAuth } from '../../context/AuthContext'
import { FilterChips } from '../../components/forms/FilterChips'
import { SearchBar } from '../../components/forms/SearchBar'
import { BottomSheet } from '../../components/feedback/BottomSheet'
import { Snackbar } from '../../components/feedback/Snackbar'
import { AppHeader } from '../../components/layout/AppHeader'
import { BackButton } from '../../components/layout/BackButton'
import type { FileItem, FileCategory } from '../../types'

type Filter = 'all' | FileCategory

const CHIPS: { value: Filter; label: string }[] = [
  { value: 'all',           label: 'All'         },
  { value: 'site_photo',    label: 'Site Photos' },
  { value: 'quotation',     label: 'Quotations'  },
  { value: 'job_sheet',     label: 'Job Sheets'  },
  { value: 'qc_photo',      label: 'QC Photos'   },
  { value: 'other',         label: 'Other'       },
]

const FILE_ICON: Record<string, JSX.Element> = {
  pdf:  <FileText size={22} className="text-red-500"   />,
  jpg:  <Image    size={22} className="text-blue-500"  />,
  png:  <Image    size={22} className="text-blue-500"  />,
  xlsx: <Table    size={22} className="text-emerald-500" />,
  xls:  <Table    size={22} className="text-emerald-500" />,
}

const CATEGORY_COLOR: Record<FileCategory | 'all', string> = {
  all:          'bg-slate-100 text-slate-600',
  site_photo:   'bg-cyan-50 text-cyan-700',
  quotation:    'bg-violet-50 text-violet-700',
  job_sheet:    'bg-amber-50 text-amber-700',
  qc_photo:     'bg-teal-50 text-teal-700',
  cutting_sheet:'bg-orange-50 text-orange-700',
  glass_sheet:  'bg-blue-50 text-blue-700',
  proof:        'bg-red-50 text-red-700',
  voice_note:   'bg-purple-50 text-purple-700',
  other:        'bg-slate-100 text-slate-600',
}

export default function FilesScreen() {
  const { can } = useAuth()
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FileItem | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [snack, setSnack] = useState({ open: false, msg: '' })

  const filtered = FILES.filter(f => {
    const matchFilter = filter === 'all' || f.category === filter
    const matchSearch = !search || f.fileName.toLowerCase().includes(search.toLowerCase()) || (f.projectName ?? '').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const totalSize = FILES.reduce((s, f) => s + f.fileSize, 0)

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
              <p className="text-xs text-slate-500">{FILES.length} files · {formatSize(totalSize)} total</p>
            </div>
          </div>
          {can('upload_files') && (
            <button onClick={() => setShowUpload(true)}
              className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-fab active:bg-indigo-700">
              <Upload size={17} className="text-white" strokeWidth={2.5} />
            </button>
          )}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search files…" className="mb-3" />
        <FilterChips chips={CHIPS} active={filter} onChange={setFilter} />
      </div>

      <div className="px-4 pt-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-10 text-center">
            <FolderOpen size={36} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No files found</p>
          </div>
        ) : (
          filtered.map(file => (
            <button key={file.id} onClick={() => setSelected(file)}
              className="w-full text-left bg-white rounded-2xl shadow-card border border-slate-100 p-4 flex items-center gap-3.5 active:scale-[0.98] transition-transform">
              <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                {FILE_ICON[file.fileType] ?? <FileText size={22} className="text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{file.fileName}</p>
                <p className="text-xs text-slate-500 truncate">{file.projectName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLOR[file.category] ?? CATEGORY_COLOR.other}`}>
                    {file.category.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400">{formatSize(file.fileSize)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-slate-400">{file.uploadedAt}</p>
                <p className="text-[10px] text-slate-300 mt-0.5">{file.uploadedBy}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* File Detail Sheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.fileName ?? ''}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                {FILE_ICON[selected.fileType] ?? <FileText size={28} className="text-slate-400" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{selected.fileName}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLOR[selected.category] ?? CATEGORY_COLOR.other}`}>
                  {selected.category.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5">
              {[
                { label: 'Project',     value: selected.projectName },
                { label: 'Uploaded by', value: selected.uploadedBy },
                { label: 'Date',        value: selected.uploadedAt },
                { label: 'Size',        value: formatSize(selected.fileSize) },
                { label: 'Type',        value: selected.fileType.toUpperCase() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'File downloaded!' }) }}
                className="bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold active:bg-indigo-700">
                Download
              </button>
              <button onClick={() => { setSelected(null); setSnack({ open: true, msg: 'File shared!' }) }}
                className="border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-semibold active:bg-slate-50">
                Share
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Upload Sheet */}
      <BottomSheet isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload File">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Project *</label>
            <input placeholder="Select project"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Category</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400">
              {CHIPS.filter(c => c.value !== 'all').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-2xl py-10 flex flex-col items-center gap-3 active:bg-slate-50 cursor-pointer">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Upload size={22} className="text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Tap to choose file</p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG, XLSX — max 20MB</p>
            </div>
          </div>
          <button onClick={() => { setShowUpload(false); setSnack({ open: true, msg: 'File uploaded!' }) }}
            className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold active:bg-indigo-700">
            Upload
          </button>
        </div>
      </BottomSheet>

      <Snackbar isOpen={snack.open} message={snack.msg} type="success" onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}
