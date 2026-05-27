import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'

export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const initialized = useRef(false)

  const loadMessages = useCallback(async () => {
    const data = await apiFetch('/chat/messages')
    setMessages(data.messages || [])
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadMessages().catch(() => {})
    }
  }, [loadMessages])

  const sendMessage = useCallback(async (question, docIds) => {
    setLoading(true)
    try {
      const result = await apiFetch('/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, docIds }),
      })
      await loadMessages()
      return result
    } finally {
      setLoading(false)
    }
  }, [loadMessages])

  return { messages, loading, sendMessage, reloadMessages: loadMessages }
}
