import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'

export function useQuizzes() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const initialized = useRef(false)

  const loadQuizzes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/quizzes')
      setQuizzes(data.quizzes || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadQuizzes().catch(() => {})
    }
  }, [loadQuizzes])

  const generateQuiz = useCallback(async (docIds) => {
    setLoading(true)
    try {
      const result = await apiFetch('/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds }),
      })
      await loadQuizzes()
      return result
    } finally {
      setLoading(false)
    }
  }, [loadQuizzes])

  return { quizzes, loading, generateQuiz, reloadQuizzes: loadQuizzes }
}
