import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

export function useDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/documents')
      setDocuments(data.documents || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadDocument = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const result = await apiFetch('/documents/upload', { method: 'POST', body: formData })
    await loadDocuments()
    return result
  }, [loadDocuments])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  return { documents, loading, error, uploadDocument, reloadDocuments: loadDocuments }
}
