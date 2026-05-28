import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

const POLLABLE_STATUSES = new Set(['processing'])

export function useDocuments(projectId) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadDocuments = useCallback(async () => {
    if (!projectId) {
      setDocuments([])
      setLoading(false)
      return []
    }
    try {
      setLoading(true)
      const data = await apiFetch(`/documents?projectId=${encodeURIComponent(projectId)}`)
      const next = data.documents || []
      setDocuments(next)
      setError(null)
      return next
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const uploadDocument = useCallback(async (file) => {
    if (!projectId) {
      throw new Error('Select a project first.')
    }
    const formData = new FormData()
    formData.append('file', file)
    const result = await apiFetch(`/documents/upload?projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: formData })
    await loadDocuments()
    return result
  }, [projectId, loadDocuments])

  useEffect(() => {
    loadDocuments().catch(() => {})
  }, [loadDocuments])

  useEffect(() => {
    if (!documents.some((doc) => POLLABLE_STATUSES.has(doc.kbIngestStatus))) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      loadDocuments().catch(() => {})
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [documents, loadDocuments])

  return { documents, loading, error, uploadDocument, reloadDocuments: loadDocuments }
}
