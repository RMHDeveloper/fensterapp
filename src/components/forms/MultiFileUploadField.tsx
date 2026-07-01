import { useRef, useState } from 'react'
import { Upload, X, FileText, Eye, Image } from 'lucide-react'
import { filePreviewStore as previewStore, resolveFileUrl } from '../../utils/sessionStore'
import { storeFile, deleteRemoteFile, removeLocalFile } from '../../utils/fileStorage'
import { FilePreviewModal } from '../feedback/FilePreviewModal'

interface Props {
  label: string
  files: string[]
  onChange: (files: string[]) => void
  accept?: string
  required?: boolean
  error?: string
  helperText?: string
}

function isImageName(name: string) { return /\.(jpg|jpeg|png|gif|webp)$/i.test(name) }
function isPdfName(name: string)   { return /\.pdf$/i.test(name) }

export function MultiFileUploadField({ label, files, onChange, accept = 'image/*', required, error, helperText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string>('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  function openPreview(src: string, name: string) {
    setPreviewSrc(src)
    setPreviewName(name)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected) return
    setUploadError(null)
    setUploading(true)
    const names: string[] = []
    try {
      for (const f of Array.from(selected)) {
        const url = await storeFile(f)
        const identifier = url.startsWith('http') ? url : f.name
        previewStore.set(identifier, url)
        names.push(identifier)
      }
      onChange([...files, ...names])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeFile(index: number) {
    const identifier = files[index]
    previewStore.delete(identifier)
    if (identifier.startsWith('http')) {
      deleteRemoteFile(identifier)
    } else {
      removeLocalFile(identifier)
    }
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      {label && (
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed
          text-sm font-semibold transition-colors active:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed
          ${error || uploadError
            ? 'border-red-300 text-red-500 bg-red-50'
            : 'border-slate-300 text-slate-500 bg-slate-50 hover:border-blue-400 hover:text-blue-500'
          }`}
      >
        <Upload size={15} />
        {uploading ? 'Uploading…' : files.length === 0 ? 'Tap to upload files' : 'Add more files'}
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {helperText && !error && !uploadError && (
        <p className="text-[11px] text-slate-400 mt-1">{helperText}</p>
      )}
      {(error || uploadError) && (
        <p className="text-[11px] text-red-500 font-semibold mt-1">{uploadError ?? error}</p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((name, i) => {
            const src = resolveFileUrl(name)
            const isImg = isImageName(name)
            return (
              <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                {isImg && src ? (
                  <img src={src} alt={name}
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-slate-100" />
                ) : isImg ? (
                  <Image size={16} className="text-blue-400 flex-shrink-0" />
                ) : (
                  <FileText size={16} className="text-blue-400 flex-shrink-0" />
                )}
                <p className="text-xs text-slate-700 flex-1 truncate">{name}</p>
                {src && (
                  <button type="button"
                    onClick={() => openPreview(src, name)}
                    className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 active:bg-blue-100">
                    <Eye size={12} className="text-blue-500" />
                  </button>
                )}
                <button type="button" onClick={() => removeFile(i)}
                  className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 active:bg-red-100">
                  <X size={11} className="text-red-500" />
                </button>
              </div>
            )
          })}
          <p className="text-[11px] text-slate-400">{files.length} file{files.length > 1 ? 's' : ''} selected</p>
        </div>
      )}

      {previewSrc && (
        <FilePreviewModal src={previewSrc} name={previewName} onClose={() => setPreviewSrc(null)} />
      )}
    </div>
  )
}
