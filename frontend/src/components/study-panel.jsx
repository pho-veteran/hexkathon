import { useCallback, useEffect, useState } from 'react'
import { FileQuestion, Sparkles, Swords, RotateCcw, RefreshCw } from 'lucide-react'
import { apiFetch } from '../api/client'

function QuizTab({ projectId, selectedDocIds, onStartBattle }) {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeQuizId, setActiveQuizId] = useState(null)
  const [genCount, setGenCount] = useState(10)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!projectId) return
    const { quizzes: q } = await apiFetch(`/quizzes?projectId=${projectId}`)
    setQuizzes(q || [])
  }, [projectId])

  useEffect(() => { load(); setActiveQuizId(null) }, [load])

  const generate = async () => {
    if (!selectedDocIds.length || !projectId) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/quizzes/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, docIds: selectedDocIds, questionCount: genCount }) })
      await load()
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--surface-border)] p-3 space-y-2">
        <div className="flex items-center gap-2">
          <select value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] px-2 py-1 text-xs text-[var(--text-secondary)]">
            <option value={5}>5 questions</option>
            <option value={10}>10 questions</option>
            <option value={20}>20 questions</option>
          </select>
          <button onClick={generate} disabled={loading || !selectedDocIds.length} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--accent-on-surface)] disabled:opacity-50 disabled:cursor-not-allowed">
            <Sparkles size={12} /> {loading ? 'Generating...' : 'Generate Exam'}
          </button>
          <button onClick={load} aria-label="Refresh quizzes" className="rounded-md p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--accent-on-surface)] transition">
            <RefreshCw size={12} />
          </button>
        </div>
        {!selectedDocIds.length && <p className="text-[10px] text-[var(--text-tertiary)]">Select documents first</p>}
        {error && <p className="text-[10px] text-[var(--color-danger)]">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {quizzes.length === 0 && <p className="px-2 py-4 text-xs text-[var(--text-tertiary)]">No exams yet.</p>}
        {quizzes.map(q => (
          <button key={q.quizId} onClick={() => setActiveQuizId(q.quizId === activeQuizId ? null : q.quizId)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${q.quizId === activeQuizId ? 'bg-[var(--surface-2)] text-[var(--accent-on-surface)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'}`}>
            <FileQuestion size={13} className="shrink-0" />
            <span className="truncate flex-1">{q.title}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-[var(--surface-border)] p-3">
        <button onClick={() => activeQuizId && onStartBattle(activeQuizId)} disabled={!activeQuizId}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed">
          <Swords size={13} /> Start Battle
        </button>
      </div>
    </div>
  )
}

function FlashcardsTab({ projectId, selectedDocIds }) {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    const { flashcardSets: s } = await apiFetch(`/flashcards?projectId=${projectId}`)
    setSets(s || [])
  }, [projectId])

  useEffect(() => { load(); setCurrentIdx(0); setFlipped(false) }, [load])

  const cards = sets.flatMap(s => s.cards || [])

  const generate = async () => {
    if (!selectedDocIds.length || !projectId) return
    setLoading(true)
    setError(null)
    try {
      await apiFetch('/flashcards/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, docIds: selectedDocIds, cardCount: 10 }) })
      await load()
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <p className="text-xs text-[var(--text-tertiary)]">No flashcards yet.</p>
        <button onClick={generate} disabled={loading || !selectedDocIds.length} className="flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--accent-on-surface)] disabled:opacity-50">
          <Sparkles size={12} /> {loading ? 'Generating...' : 'Generate Flashcards'}
        </button>
        {!selectedDocIds.length && <p className="text-[10px] text-[var(--text-tertiary)]">Select documents first</p>}
        {error && <p className="text-[10px] text-[var(--color-danger)]">{error}</p>}
      </div>
    )
  }

  const card = cards[currentIdx]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--surface-border)] p-3 flex items-center justify-between">
        <button onClick={generate} disabled={loading || !selectedDocIds.length} className="flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-on-surface)] disabled:opacity-50">
          <Sparkles size={11} /> Generate more
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-tertiary)]">{currentIdx + 1}/{cards.length}{currentIdx === cards.length - 1 ? ' (last)' : ''}</span>
          <button onClick={load} aria-label="Refresh flashcards" className="rounded-md p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-on-surface)] transition">
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <button onClick={() => setFlipped(!flipped)} className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-6 text-center transition hover:border-[var(--accent-on-surface)] min-h-[160px] flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{flipped ? 'Answer' : 'Question'}</span>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">{flipped ? card.back : card.front}</p>
        </button>
      </div>

      <div className="border-t border-[var(--surface-border)] p-3 flex items-center justify-between">
        <button onClick={() => { setFlipped(false); setCurrentIdx((currentIdx - 1 + cards.length) % cards.length) }} className="rounded-md px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">Prev</button>
        <button onClick={() => setFlipped(!flipped)} className="rounded-md p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-on-surface)]"><RotateCcw size={13} /></button>
        <button onClick={() => { setFlipped(false); setCurrentIdx((currentIdx + 1) % cards.length) }} className="rounded-md px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">Next</button>
      </div>
    </div>
  )
}

export default function StudyPanel({ projectId, selectedDocIds, onStartBattle }) {
  const [tab, setTab] = useState('quiz')

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-[var(--surface-border)]" role="tablist">
        <button onClick={() => setTab('quiz')} role="tab" aria-selected={tab === 'quiz'} className={`flex-1 px-3 py-2.5 text-xs font-medium transition ${tab === 'quiz' ? 'text-[var(--accent-on-surface)] border-b-2 border-[var(--accent-on-surface)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
          Quiz
        </button>
        <button onClick={() => setTab('flash')} role="tab" aria-selected={tab === 'flash'} className={`flex-1 px-3 py-2.5 text-xs font-medium transition ${tab === 'flash' ? 'text-[var(--accent-on-surface)] border-b-2 border-[var(--accent-on-surface)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
          Flashcards
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 ${tab === 'quiz' ? '' : 'invisible'}`} role="tabpanel">
          <QuizTab projectId={projectId} selectedDocIds={selectedDocIds} onStartBattle={onStartBattle} />
        </div>
        <div className={`absolute inset-0 ${tab === 'flash' ? '' : 'invisible'}`} role="tabpanel">
          <FlashcardsTab projectId={projectId} selectedDocIds={selectedDocIds} />
        </div>
      </div>
    </div>
  )
}
