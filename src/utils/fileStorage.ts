const UPLOAD_URL = (import.meta.env.VITE_UPLOAD_URL as string | undefined)?.trim()
const UPLOAD_KEY = (import.meta.env.VITE_UPLOAD_KEY as string | undefined)?.trim()

const MAX_FILE_BYTES = 3 * 1024 * 1024

type FileRecord = {
  name: string
  type: string
  size: number
  dataUrl: string
  uploadedAt: string
}

const _localStore = new Map<string, FileRecord>()

function load(): Record<string, FileRecord> {
  return Object.fromEntries(_localStore)
}

function save(store: Record<string, FileRecord>) {
  _localStore.clear()
  for (const [k, v] of Object.entries(store)) _localStore.set(k, v)
}

export function removeLocalFile(name: string) {
  _localStore.delete(name)
}

async function uploadToHostinger(file: File): Promise<string> {
  if (!UPLOAD_URL || !UPLOAD_KEY) {
    throw new Error('File upload is not configured. Contact your administrator.')
  }
  const form = new FormData()
  form.append('file', file)
  let res: Response
  try {
    res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { 'X-Upload-Key': UPLOAD_KEY },
      body: form,
    })
  } catch {
    throw new Error('Upload failed — check your internet connection and try again.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Upload failed (${res.status}). Please try again.`)
  }
  const json = await res.json() as { url?: string }
  if (!json.url) throw new Error('Upload failed — invalid server response.')
  return json.url
}

async function storeLocally(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) return URL.createObjectURL(file)
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const store = load()
      store[file.name] = { name: file.name, type: file.type, size: file.size, dataUrl, uploadedAt: new Date().toISOString() }
      save(store)
      resolve(dataUrl)
    }
    reader.onerror = () => resolve(URL.createObjectURL(file))
    reader.readAsDataURL(file)
  })
}

export async function storeFile(file: File): Promise<string> {
  if (UPLOAD_URL && UPLOAD_KEY) {
    // Hostinger is configured — always upload there, never fall back
    return uploadToHostinger(file)
  }
  // Dev mode only: no upload config, store locally
  return storeLocally(file)
}

export function getFileUrl(nameOrUrl: string): string | undefined {
  if (nameOrUrl.startsWith('http')) return nameOrUrl
  return load()[nameOrUrl]?.dataUrl
}

export function getFileRecord(name: string): FileRecord | undefined {
  if (name.startsWith('http')) return undefined
  return load()[name]
}

export async function fileToShareable(nameOrUrl: string): Promise<File | null> {
  if (nameOrUrl.startsWith('http')) {
    try {
      const res = await fetch(nameOrUrl)
      const blob = await res.blob()
      return new File([blob], nameOrUrl.split('/').pop() ?? 'file', { type: blob.type })
    } catch { return null }
  }
  const record = load()[nameOrUrl]
  if (!record) return null
  try {
    const res = await fetch(record.dataUrl)
    const blob = await res.blob()
    return new File([blob], record.name, { type: record.type })
  } catch { return null }
}

export async function deleteRemoteFile(url: string): Promise<void> {
  if (!UPLOAD_URL || !UPLOAD_KEY || !url.startsWith('http')) return
  try {
    await fetch(UPLOAD_URL, {
      method: 'DELETE',
      headers: { 'X-Upload-Key': UPLOAD_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {}
}
