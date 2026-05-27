import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'

export function useFlashcards() {
  const [flashcardSets, setFlashcardSets] = useState([])
  const [loading, setLoading] = useState(false)
  const initialized = useRef(false)

  const loadFlashcards = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/flashcards')
      setFlashcardSets(data.flashcardSets || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadFlashcards().catch(() => {})
    }
  }, [loadFlashcards])

  const generateFlashcards = useCallback(async (docIds, cardCount = 10) => {
    setLoading(true)
    try {
      const result = await apiFetch('/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds, cardCount }),
      })
      await loadFlashcards()
      return result
    } finally {
      setLoading(false)
    }
  }, [loadFlashcards])

  return { flashcardSets, loading, generateFlashcards, reloadFlashcards: loadFlashcards }
}
