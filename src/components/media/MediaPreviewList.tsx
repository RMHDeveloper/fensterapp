import { useState } from 'react'
import { FileText, Image, Mic, Eye } from 'lucide-react'
import { resolveFileUrl, voicePreviewStore } from '../../utils/sessionStore'
import { FilePreviewModal } from '../feedback/FilePreviewModal'

function isImageName(name: string) { return /\.(jpg|jpeg|png|gif|webp)$/i.test(name) }
function isAudioId(name: string)   { return name.startsWith('voice_') || /\.(mp3|wav|webm|ogg|aac|m4a)$/i.test(name) }
function isPdfName(name: string)   { return /\.pdf$/i.test(name) }

interface Props {
  files: (string | undefined)[]
  title?: string
  emptyText?: string
  voiceStore?: Map<string, string>
}

export function MediaPreviewList({ files, title, emptyText, voiceStore }: Props) {
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null)
  const validFiles = files.filter(Boolean) as string[]
  if (validFiles.length === 0) return null

  return (
    <>
      <div className="space-y-1.5">
        {title && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{title}</p>}
        {validFiles.length === 0 && emptyText && (
          <p className="text-xs text-slate-400">{emptyText}</p>
        )}
        {validFiles.map((name, i) => {
          const isAudio = isAudioId(name)
          const audioUrl = isAudio
            ? (voiceStore?.get(name) ?? voicePreviewStore.get(name) ?? resolveFileUrl(name))
            : undefined
          const fileUrl = !isAudio ? resolveFileUrl(name) : undefined
          const isImg   = isImageName(name)

          if (isAudio) {
            return (
              <div key={i} className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mic size={12} className="text-purple-500 flex-shrink-0" />
                  <p className="text-[10px] text-purple-600 font-semibold truncate flex-1">{name}</p>
                </div>
                {audioUrl
                  ? <audio controls src={audioUrl} className="w-full" style={{ height: 36 }} />
                  : <p className="text-[10px] text-purple-400 italic">Voice preview unavailable — please re-record for playback</p>
                }
              </div>
            )
          }

          const isPdf = isPdfName(name)
          return (
            <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              {isImg
                ? <Image size={14} className="text-blue-400 flex-shrink-0" />
                : isPdf
                  ? <span className="text-sm flex-shrink-0">📄</span>
                  : <FileText size={14} className="text-slate-400 flex-shrink-0" />
              }
              <p className="text-xs text-slate-700 flex-1 truncate">{name}</p>
              {fileUrl ? (
                <button type="button"
                  onClick={() => setPreview({ src: fileUrl, name })}
                  className="flex items-center gap-1 text-[10px] text-blue-600 font-bold px-2 py-1 bg-white rounded border border-blue-200 flex-shrink-0 active:opacity-70">
                  <Eye size={10} /> {isImg ? 'View' : isPdf ? 'View' : 'Open'}
                </button>
              ) : (
                <p className="text-[10px] text-slate-400 flex-shrink-0 italic">Preview unavailable</p>
              )}
            </div>
          )
        })}
      </div>

      {preview && (
        <FilePreviewModal src={preview.src} name={preview.name} onClose={() => setPreview(null)} />
      )}
    </>
  )
}
