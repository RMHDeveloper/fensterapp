import { useState, useRef } from 'react'
import { Mic, Square, Trash2, Play, Pause } from 'lucide-react'
import { voicePreviewStore as voiceBlobStore, resolveFileUrl } from '../../utils/sessionStore'

// Re-export for backward compat with any existing imports
export { voiceBlobStore }

function persistVoiceBlob(id: string, blob: Blob) {
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    try {
      const store = JSON.parse(localStorage.getItem('fenster_file_data') ?? '{}')
      store[id] = { name: id, type: blob.type || 'audio/webm', size: blob.size, dataUrl, uploadedAt: new Date().toISOString() }
      localStorage.setItem('fenster_file_data', JSON.stringify(store))
    } catch { /* storage full — voice only available this session */ }
  }
  reader.readAsDataURL(blob)
}

function VoiceNoteItem({ id, onRemove }: { id: string; onRemove: () => void }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const url = voiceBlobStore.get(id) ?? resolveFileUrl(id)
  if (!url) return null

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play().catch(() => setPlaying(false)); setPlaying(true) }
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <button type="button" onClick={togglePlay}
        className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-80 shadow-sm">
        {playing
          ? <Pause size={12} className="text-white" />
          : <Play  size={12} className="text-white ml-0.5" />
        }
      </button>
      <p className="flex-1 text-xs font-semibold text-purple-700">Voice note</p>
      <button type="button" onClick={onRemove} className="p-1 active:opacity-70">
        <Trash2 size={14} className="text-red-400" />
      </button>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
    </div>
  )
}

interface Props {
  label: string
  savedIds: string[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  helperText?: string
}

export function VoiceRecorder({ label, savedIds, onAdd, onRemove, helperText }: Props) {
  const [recording, setRecording] = useState(false)
  const [timer,     setTimer]     = useState(0)
  const [micErr,    setMicErr]    = useState('')

  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    setMicErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      mediaRecRef.current = rec
      chunksRef.current = []

      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        const id   = `voice_${Date.now()}`
        voiceBlobStore.set(id, url)
        persistVoiceBlob(id, blob)
        onAdd(id)
        stream.getTracks().forEach(t => t.stop())
        setRecording(false)
        if (timerRef.current) clearInterval(timerRef.current)
      }

      rec.start()
      setRecording(true)
      setTimer(0)
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } catch {
      setMicErr('Microphone access denied. Please allow mic permission.')
    }
  }

  function stopRecording() {
    if (mediaRecRef.current && recording) {
      mediaRecRef.current.stop()
    }
  }

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">{label}</label>

      {/* Saved recordings list */}
      {savedIds.map(id => (
        <VoiceNoteItem key={id} id={id} onRemove={() => onRemove(id)} />
      ))}

      {/* Recording in progress */}
      {recording && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <p className="text-sm font-extrabold text-red-600">Recording… {fmt(timer)}</p>
          </div>
          <button type="button" onClick={stopRecording}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold active:opacity-90">
            <Square size={13} fill="white" /> Stop Recording
          </button>
        </div>
      )}

      {/* Add button — always shown when not recording */}
      {!recording && (
        <>
          <button type="button" onClick={startRecording}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-red-300 text-red-600 bg-red-50 text-sm font-semibold active:opacity-70">
            <Mic size={15} /> {savedIds.length > 0 ? 'Add Another Voice Note' : 'Start Recording'}
          </button>
          {micErr && <p className="text-[11px] text-red-500">{micErr}</p>}
        </>
      )}

      {helperText && (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      )}
    </div>
  )
}
