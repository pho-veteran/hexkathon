import { useCallback, useState } from 'react'
import { apiFetch } from '../api/client'

export function useBattle() {
  const [battleState, setBattleState] = useState(null)
  const [loading, setLoading] = useState(false)

  const startBattle = useCallback(async (quizId) => {
    setLoading(true)
    try {
      const result = await apiFetch('/battle-sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      })
      setBattleState(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const answerQuestion = useCallback(async (sessionId, questionId, selectedChoiceId) => {
    setLoading(true)
    try {
      const result = await apiFetch(`/battle-sessions/${sessionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedChoiceId }),
      })
      setBattleState(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const resumeSession = useCallback(async (sessionId) => {
    setLoading(true)
    try {
      const result = await apiFetch(`/battle-sessions/${sessionId}`)
      setBattleState(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  return { battleState, loading, startBattle, answerQuestion, resumeSession }
}
