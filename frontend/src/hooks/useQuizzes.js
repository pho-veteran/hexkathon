import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

export function useQuizzes(projectId) {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)

  const loadQuizzes = useCallback(async () => {
    if (!projectId) {
      setQuizzes([])
      return []
    }
    setLoading(true)
    try {
      const data = await apiFetch(`/quizzes?projectId=${encodeURIComponent(projectId)}`)
      const next = data.quizzes || []
      setQuizzes(next)
      return next
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadQuizzes().catch(() => {})
  }, [loadQuizzes])

  const generateQuiz = useCallback(async (docIds) => {
    if (!projectId) {
      throw new Error('Select a project first.')
    }
    setLoading(true)
    try {
      const result = await apiFetch('/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, docIds }),
      })
      await loadQuizzes()
      return result
    } finally {
      setLoading(false)
    }
  }, [projectId, loadQuizzes])

  return { quizzes, loading, generateQuiz, reloadQuizzes: loadQuizzes }
}
