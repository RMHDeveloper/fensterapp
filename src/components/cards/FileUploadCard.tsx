import { FileText, Image, Sheet, Upload, X, Eye } from 'lucide-react'
import type { FileItem } from '../../types'

const FILE_ICON: Record<string, React.ElementType> = {
  pdf: FileText, image: Image, doc: FileText,
  spreadsheet: Sheet, other: FileText,
}
const FILE_COLOR: Record<string, string> = {
  pdf: 'bg-red-50 text-red-500', image: 'bg-blue-50 text-blue-500',
  doc: 'bg-indigo-50 text-indigo-500', spreadsheet: 'bg-emerald-50 text-emerald-500',
  other: 'bg-slate-100 text-slate-500',
}

interface FileRowProps {
  file: FileItem
  onDelete?: () => void
  onView?: () => void
}

export function FileRow({ file, onDelete, onView }: FileRowProps) {
  const typeKey = file.fileType === 'jpg' || file.fileType === 'png' || file.fileType === 'jpeg' || file.fileType === 'webp'
    ? 'image' : file.fileType === 'pdf' ? 'pdf'
    : file.fileType === 'xlsx' || file.fileType === 'xls' ? 'spreadsheet' : 'other'
  const Icon = FILE_ICON[typeKey] ?? FileText
  const color = FILE_COLOR[typeKey] ?? FILE_COLOR.other

  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 truncate">{file.fileName}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{formatSize(file.fileSize)} · {file.uploadedAt} · {file.uploadedBy}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onView && (
          <button onClick={onView} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center active:bg-slate-200">
            <Eye size={13} className="text-slate-500" />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center active:bg-red-100">
            <X size={13} className="text-red-500" />
          </button>
        )}
      </div>
    </div>
  )
}

interface UploadAreaProps {
  onUpload?: () => void
  label?: string
  accept?: string
}

export function UploadArea({ onUpload, label = 'Tap to upload file', accept = 'image/*,.pdf,.xlsx' }: UploadAreaProps) {
  return (
    <button
      onClick={onUpload}
      className="w-full border-2 border-dashed border-indigo-200 rounded-2xl p-6 flex flex-col items-center gap-2 active:bg-indigo-50 transition-colors"
    >
      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
        <Upload size={20} className="text-indigo-500" />
      </div>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="text-[11px] text-slate-400">{accept.replace(/[.*]/g, '').replace(/,/g, ' · ')}</p>
    </button>
  )
}
