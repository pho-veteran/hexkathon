import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, Send, LoaderCircle } from 'lucide-react'
import { apiFetch } from '../api/client'

export default function ChatPanel({ projectId, selectedDocIds }) {
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [showThreads, setShowThreads] = useState(false)
  const scrollRef = useRef(null)
  const sendLock = useRef(false)

  const loadThreads = useCallback(async () => {
    if (!projectId) return
    const { threads: t } = await apiFetch(`/chat/threads?projectId=${projectId}`)
    setThreads(t || [])
  }, [projectId])

  const loadMessages = useCallback(async () => {
    if (!projectId || !activeThreadId) { setMessages([]); return }
    const { messages: m } = await apiFetch(`/chat/threads/${activeThreadId}/messages?projectId=${projectId}`)
    setMessages(m || [])
  }, [projectId, activeThreadId])

  useEffect(() => { loadThreads() }, [loadThreads])
  useEffect(() => { loadMessages() }, [loadMessages])
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [messages])
  useEffect(() => { setActiveThreadId(null); setMessages([]); setError(null) }, [projectId])

  // Auto-select first thread
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) setActiveThreadId(threads[0].threadId)
  }, [threads, activeThreadId])

  const createThread = async () => {
    if (!projectId) return
    const t = await apiFetch('/chat/threads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, title: `Chat ${threads.length + 1}` }) })
    await loadThreads()
    setActiveThreadId(t.threadId)
    setShowThreads(false)
  }

  const send = async () => {
    const q = input.trim()
    if (!q || !projectId || sendLock.current) return
    sendLock.current = true
    setError(null)

    let tid = activeThreadId
    if (!tid) {
      try {
        const t = await apiFetch('/chat/threads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, title: q.slice(0, 30) }) })
        await loadThreads()
        tid = t.threadId
        setActiveThreadId(tid)
      } catch (e) {
        setError(e.message)
        sendLock.current = false
        return
      }
    }

    // Optimistic: show user message immediately
    const optimisticMsg = { messageId: `opt-${Date.now()}`, role: 'user', content: q }
    setMessages(prev => [...prev, optimisticMsg])
    setInput('')
    setSending(true)

    try {
      await apiFetch(`/chat/threads/${tid}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, question: q, docIds: selectedDocIds || [] }) })
      await loadMessages()
    } catch (e) {
      setError(e.message)
      setInput(q) // Restore input on failure
      setMessages(prev => prev.filter(m => m.messageId !== optimisticMsg.messageId))
    } finally {
      setSending(false)
      sendLock.current = false
    }
  }

  const activeThread = threads.find(t => t.threadId === activeThreadId)

  return (
    <div className="flex h-full flex-col">
      {/* Thread dropdown */}
      <div className="relative border-b border-[var(--surface-border)]">
        <button onClick={() => setShowThreads(!showThreads)} className="flex w-full items-center justify-between px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition">
          <span className="truncate font-medium">{activeThread?.title || 'Select a chat'}</span>
          <ChevronDown size={12} className={`transition ${showThreads ? 'rotate-180' : ''}`} />
        </button>
        {showThreads && (
          <div className="absolute inset-x-0 top-full z-40 max-h-48 overflow-y-auto border-b border-[var(--surface-border)] bg-[var(--surface-1)] shadow-md shadow-[var(--shadow-color)]">
            {threads.map(t => (
              <button key={t.threadId} onClick={() => { setActiveThreadId(t.threadId); setShowThreads(false) }}
                className={`block w-full px-4 py-1.5 text-left text-xs transition ${t.threadId === activeThreadId ? 'text-[var(--accent-on-surface)] bg-[var(--surface-2)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}`}>
                {t.title}
              </button>
            ))}
            <button onClick={createThread} className="flex w-full items-center gap-1 px-4 py-1.5 text-xs text-[var(--accent-on-surface)] hover:bg-[var(--surface-2)]">
              <Plus size={11} /> New chat
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !sending && (
          <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">
            {threads.length > 0 && !activeThreadId ? 'Select a chat or start a new one.' : 'No messages yet. Select documents and ask a question.'}
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={msg.messageId || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[var(--color-accent)] text-white rounded-br-sm' : 'bg-[var(--surface-2)] text-[var(--text-primary)] rounded-bl-sm'}`}>
              <p className="whitespace-pre-wrap">{msg.content || msg.text}</p>
              {msg.citations?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {msg.citations.map((c, ci) => (
                    <span key={ci} className="rounded-full bg-[var(--surface-1)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">{c.filename || `Ref ${ci + 1}`}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && <div className="flex justify-start"><div className="rounded-xl bg-[var(--surface-2)] px-3 py-2"><LoaderCircle size={14} className="animate-spin text-[var(--text-tertiary)]" /></div></div>}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--surface-border)] px-4 py-3">
        {error && <p className="mb-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about your documents..."
            aria-label="Message input"
            className="flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-on-surface)] placeholder:text-[var(--text-tertiary)]" />
          <button onClick={send} disabled={sending || !input.trim()} aria-label="Send message" className="rounded-lg bg-[var(--color-accent)] p-2 text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-40">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
