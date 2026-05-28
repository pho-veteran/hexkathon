import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

export function useFlashcards(projectId) {
  const [flashcardSets, setFlashcardSets] = useState([])
  const [loading, setLoading] = useState(false)

  const loadFlashcards = useCallback(async () => {
    if (!projectId) {
      setFlashcardSets([])
      return []
    }
    setLoading(true)
    try {
      const data = await apiFetch(`/flashcards?projectId=${encodeURIComponent(projectId)}`)
      const next = data.flashcardSets || []
      setFlashcardSets(next)
      return next
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadFlashcards().catch(() => {})
  }, [loadFlashcards])

  const generateFlashcards = useCallback(async (docIds, cardCount = 10) => {
    if (!projectId) {
      throw new Error('Select a project first.')
    }
    setLoading(true)
    try {
      const result = await apiFetch('/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, docIds, cardCount }),
      })
      await loadFlashcards()
      return result
    } finally {
      setLoading(false)
    }
  }, [projectId, loadFlashcards])

  return { flashcardSets, loading, generateFlashcards, reloadFlashcards: loadFlashcards }
}
