import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

export function useChat(projectId, threadId) {
  const [threads, setThreads] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const loadThreads = useCallback(async () => {
    if (!projectId) {
      setThreads([])
      return []
    }
    const data = await apiFetch(`/chat/threads?projectId=${encodeURIComponent(projectId)}`)
    const next = data.threads || []
    setThreads(next)
    return next
  }, [projectId])

  const loadMessages = useCallback(async () => {
    if (!projectId || !threadId) {
      setMessages([])
      return []
    }
    const data = await apiFetch(`/chat/threads/${threadId}/messages?projectId=${encodeURIComponent(projectId)}`)
    const next = data.messages || []
    setMessages(next)
    return next
  }, [projectId, threadId])

  useEffect(() => {
    loadThreads().catch(() => {})
  }, [loadThreads])

  useEffect(() => {
    loadMessages().catch(() => {})
  }, [loadMessages])

  const createThread = useCallback(async (title = 'New Chat') => {
    if (!projectId) {
      throw new Error('Select a project first.')
    }
    setLoading(true)
    try {
      const thread = await apiFetch('/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title }),
      })
      await loadThreads()
      return thread
    } finally {
      setLoading(false)
    }
  }, [projectId, loadThreads])

  const sendMessage = useCallback(async (targetThreadId, question, docIds) => {
    if (!projectId || !targetThreadId) {
      throw new Error('Select or create a chat first.')
    }
    setLoading(true)
    try {
      const result = await apiFetch(`/chat/threads/${targetThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, question, docIds }),
      })
      if (targetThreadId === threadId) {
        await loadMessages()
      }
      return result
    } finally {
      setLoading(false)
    }
  }, [projectId, threadId, loadMessages])

  return { threads, messages, loading, createThread, sendMessage, reloadThreads: loadThreads, reloadMessages: loadMessages }
}
