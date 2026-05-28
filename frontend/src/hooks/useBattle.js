import { useCallback, useState } from 'react'
import { apiFetch } from '../api/client'

export function useBattle(projectId) {
  const [battleState, setBattleState] = useState(null)
  const [loading, setLoading] = useState(false)

  const startBattle = useCallback(async (quizId) => {
    if (!projectId) {
      throw new Error('Select a project first.')
    }
    setLoading(true)
    try {
      const result = await apiFetch('/battle-sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, quizId }),
      })
      setBattleState(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const answerQuestion = useCallback(async (sessionId, questionId, selectedChoiceId) => {
    if (!projectId) {
      throw new Error('Select a project first.')
    }
    setLoading(true)
    try {
      const result = await apiFetch(`/battle-sessions/${sessionId}/answers?projectId=${encodeURIComponent(projectId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedChoiceId }),
      })
      setBattleState(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const resumeSession = useCallback(async (sessionId) => {
    if (!projectId) {
      throw new Error('Select a project first.')
    }
    setLoading(true)
    try {
      const result = await apiFetch(`/battle-sessions/${sessionId}?projectId=${encodeURIComponent(projectId)}`)
      setBattleState(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [projectId])

  return { battleState, loading, startBattle, answerQuestion, resumeSession }
}
