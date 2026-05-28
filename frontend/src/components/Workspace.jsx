import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, Send, Sparkles } from 'lucide-react'
import CitationModal from './CitationModal'
import ChatThreadSidebar from './ChatThreadSidebar'
import DocumentLibrary from './DocumentLibrary'
import ExamListView from './ExamListView'
import FlashcardList from './FlashcardList'
import ProjectSwitcher from './ProjectSwitcher'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../context/ProjectContext'
import { useChat } from '../hooks/useChat'
import { useFlashcards } from '../hooks/useFlashcards'
import { useQuizzes } from '../hooks/useQuizzes'

function CitationChips({ citations, onOpen }) {
  if (!citations?.length) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {citations.map((citation, index) => (
        <button
          key={`${citation.filename || 'citation'}-${index}`}
          onClick={() => onOpen(citation)}
          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
        >
          {citation.filename || `Citation ${index + 1}`}
        </button>
      ))}
    </div>
  )
}

export default function Workspace({ onStartBattle }) {
  const { user, logout } = useAuth()
  const { activeProjectId } = useProjects()
  const { threads, messages, loading: chatLoading, createThread, sendMessage } = useChat(activeProjectId, null)
  const [activeThreadId, setActiveThreadId] = useState(null)
  const threadChat = useChat(activeProjectId, activeThreadId)
  const { flashcardSets, loading: flashcardsLoading, generateFlashcards } = useFlashcards(activeProjectId)
  const { quizzes, loading: quizzesLoading, generateQuiz } = useQuizzes(activeProjectId)

  const [selectedDocIds, setSelectedDocIds] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [citation, setCitation] = useState(null)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    setSelectedDocIds([])
    setInputValue('')
    setCitation(null)
    setActionError(null)
    setActiveThreadId(null)
  }, [activeProjectId])

  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].threadId)
    }
    if (activeThreadId && !threads.some((thread) => thread.threadId === activeThreadId)) {
      setActiveThreadId(threads[0]?.threadId || null)
    }
  }, [threads, activeThreadId])

  const flattenedMessages = useMemo(() => threadChat.messages || [], [threadChat.messages])

  const handleCreateThread = async () => {
    try {
      setActionError(null)
      const thread = await createThread(`Chat ${threads.length + 1}`)
      setActiveThreadId(thread.threadId)
      return thread
    } catch (error) {
      setActionError(error.message)
      return null
    }
  }

  const handleSend = async () => {
    const question = inputValue.trim()
    if (!question) {
      return
    }

    let targetThreadId = activeThreadId
    if (!targetThreadId) {
      const thread = await handleCreateThread()
      targetThreadId = thread?.threadId || null
    }
    if (!targetThreadId) {
      return
    }

    setActionError(null)
    setInputValue('')
    try {
      await sendMessage(targetThreadId, question, selectedDocIds)
    } catch (error) {
      setActionError(error.message)
      setInputValue(question)
    }
  }

  const handleGenerateFlashcards = async () => {
    if (selectedDocIds.length === 0) {
      setActionError('Select at least one document first.')
      return
    }

    setActionError(null)
    try {
      await generateFlashcards(selectedDocIds, 10)
    } catch (error) {
      setActionError(error.message)
    }
  }

  const handleGenerateQuiz = async () => {
    if (selectedDocIds.length === 0) {
      setActionError('Select at least one document first.')
      return
    }

    setActionError(null)
    try {
      await generateQuiz(selectedDocIds)
    } catch (error) {
      setActionError(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-black text-slate-900">Study Buddy Battle Quiz</h1>
            <p className="text-sm text-slate-500">Signed in as {user?.email || user?.username || user?.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-80">
              <ProjectSwitcher />
            </div>
            <button onClick={logout} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)_minmax(320px,380px)]">
        <ChatThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onCreateThread={handleCreateThread}
          loading={chatLoading}
        />

        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Grounded Chat</h2>
            <p className="text-sm text-slate-500">Ask questions against selected documents.</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {flattenedMessages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
                No messages yet.
              </div>
            ) : null}

            {flattenedMessages.map((message, index) => (
              <div key={`${message.messageId || message.createdAt || index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.role === 'user' ? 'rounded-tr-none bg-indigo-600 text-white' : 'rounded-tl-none border border-slate-200 bg-slate-50 text-slate-800'}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content || message.text}</p>
                  <CitationChips citations={message.citations} onOpen={setCitation} />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            {actionError ? <p className="mb-3 text-sm text-red-500">{actionError}</p> : null}
            <div className="flex gap-3">
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask AI about selected documents..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none ring-0 transition focus:border-indigo-400"
              />
              <button
                onClick={handleSend}
                disabled={threadChat.loading}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {threadChat.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <DocumentLibrary projectId={activeProjectId} selectedDocIds={selectedDocIds} onSelectionChange={setSelectedDocIds} />

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Study Actions</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button
                onClick={handleGenerateFlashcards}
                disabled={flashcardsLoading}
                className="flex items-center justify-center gap-2 rounded-lg bg-indigo-100 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-200 disabled:opacity-70"
              >
                <Sparkles className="h-4 w-4" /> Generate Flashcards
              </button>
              <button
                onClick={handleGenerateQuiz}
                disabled={quizzesLoading}
                className="flex items-center justify-center gap-2 rounded-lg bg-red-100 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-70"
              >
                <Sparkles className="h-4 w-4" /> Generate 10-question Exam
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">Selected documents: {selectedDocIds.length}</p>
          </div>

          <FlashcardList flashcardSets={flashcardSets} />
          <ExamListView quizzes={quizzes} loading={quizzesLoading} onPlayBattle={onStartBattle} />
        </aside>
      </div>

      <CitationModal citation={citation} onClose={() => setCitation(null)} />
    </div>
  )
}
