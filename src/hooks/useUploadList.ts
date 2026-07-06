import { useCallback, useEffect, useState } from 'react'
import { getProjectFiles, subscribeToProjectFiles, type FileRow } from '../services/fileService'
import type { FileCategory } from '../types'

/** Newest-first list of uploads for a project/category, synced via Supabase realtime and refetched on window focus. */
export function useUploadList(projectId: string | undefined, category?: FileCategory | string) {
  const [files, setFiles] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!projectId) { setFiles([]); setLoading(false); return }
    getProjectFiles(projectId, category).then(rows => { setFiles(rows); setLoading(false) })
  }, [projectId, category])

  useEffect(() => {
    setLoading(true)
    refresh()
    if (!projectId) return
    const unsubscribe = subscribeToProjectFiles(projectId, refresh)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => { unsubscribe(); window.removeEventListener('focus', onFocus) }
  }, [projectId, category, refresh])

  return { files, loading, refresh }
}
