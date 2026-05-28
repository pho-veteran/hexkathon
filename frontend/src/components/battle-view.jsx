import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LoaderCircle, Skull, Swords, Heart } from 'lucide-react'
import openingGif from '../assets/opening.gif'
import winAvif from '../assets/win.avif'
import loseJpg from '../assets/lose.jpg'
import bossGif from '../assets/boss 1.gif'
import { useBattle } from '../hooks/useBattle'

export default function BattleView({ projectId, quizId, onEnd }) {
  const { battleState, loading, startBattle, answerQuestion, resumeSession } = useBattle(projectId)
  const [phase, setPhase] = useState('opening')
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const storageKey = `battle:${projectId}:${quizId}`

  // Opening phase
  useEffect(() => {
    const t = setTimeout(() => setPhase('play'), 2800)
    return () => clearTimeout(t)
  }, [])

  // Start or resume
  useEffect(() => {
    if (!quizId || !projectId) { setError('Missing quiz or project.'); return }
    const init = async () => {
      try {
        const sid = sessionStorage.getItem(storageKey)
        if (sid) {
          const r = await resumeSession(sid)
          if (r?.session?.quizId === quizId) return
        }
        const s = await startBattle(quizId)
        if (s?.session?.sessionId) sessionStorage.setItem(storageKey, s.session.sessionId)
      } catch (e) { sessionStorage.removeItem(storageKey); setError(e.message) }
    }
    init()
  }, [projectId, quizId, resumeSession, startBattle, storageKey])

  const session = battleState?.session
  const quiz = battleState?.quiz
  const question = useMemo(() => {
    if (!session || !quiz?.questions) return null
    return quiz.questions[session.currentQuestionIndex] || null
  }, [session, quiz])

  // Clear feedback when question advances
  useEffect(() => { setLastResult(null) }, [session?.currentQuestionIndex])

  const total = quiz?.questions?.length || 0
  const finished = session?.status !== 'active' || !question
  const won = session?.status === 'won' || session?.bossHp === 0

  const answer = async (choiceId) => {
    if (!session || !question || loading) return
    setError(null)
    try {
      const r = await answerQuestion(session.sessionId, question.questionId, choiceId)
      if (r.session?.status !== 'active') sessionStorage.removeItem(storageKey)
      setLastResult(r.session?.answerHistory?.at(-1))
    } catch (e) { setError(e.message) }
  }

  // Opening
  if (phase === 'opening') {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[oklch(8%_0.01_260)] p-6">
        <p className="mb-6 text-xs font-bold uppercase tracking-[0.4em] text-[oklch(65%_0.2_25)]">Entering Battle</p>
        <img src={openingGif} alt="Battle opening animation" className="w-full max-w-3xl rounded-2xl" />
        <button onClick={() => setPhase('play')} className="mt-4 text-[11px] text-[oklch(50%_0.01_260)] hover:text-white transition">Skip</button>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[oklch(8%_0.01_260)] p-6 text-white">
        <p className="text-sm text-[oklch(65%_0.2_25)]">{error}</p>
        <button onClick={onEnd} className="mt-4 flex items-center gap-2 text-xs text-[oklch(70%_0.01_260)] hover:text-white transition"><ArrowLeft size={13} /> Back</button>
      </div>
    )
  }

  // Loading
  if (!session || !quiz) {
    return <div className="flex h-full items-center justify-center bg-[oklch(8%_0.01_260)]"><LoaderCircle size={20} className="animate-spin text-[oklch(50%_0.01_260)]" /></div>
  }

  // Finished
  if (finished) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-[oklch(8%_0.01_260)] p-8 text-white">
        <button onClick={onEnd} className="absolute left-6 top-6 flex items-center gap-1.5 text-xs text-[oklch(60%_0.01_260)] hover:text-white transition"><ArrowLeft size={13} /> Workspace</button>
        <img src={won ? winAvif : loseJpg} alt={won ? 'Victory' : 'Defeat'} className="max-h-[50vh] rounded-2xl mb-6" />
        <h2 className={`text-3xl font-black uppercase tracking-wider ${won ? 'text-[oklch(72%_0.15_155)]' : 'text-[oklch(65%_0.2_25)]'}`}>{won ? 'Victory' : 'Defeat'}</h2>
        <p className="mt-2 text-sm text-[oklch(60%_0.01_260)]">{quiz.title}</p>
        <p className="mt-1 text-xs text-[oklch(45%_0.01_260)]">Boss HP: {session.bossHp} · Your HP: {session.userHp}</p>
        <button onClick={onEnd} className="mt-6 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] transition">Return to Workspace</button>
      </div>
    )
  }

  // Gameplay
  return (
    <div className="flex h-full flex-col bg-[oklch(8%_0.01_260)] text-white overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[oklch(20%_0.01_260)]">
        <button onClick={() => { if (window.confirm('Flee battle? Progress will be lost.')) onEnd() }} className="flex items-center gap-1.5 text-xs text-[oklch(60%_0.01_260)] hover:text-white transition"><ArrowLeft size={13} /> Flee</button>
        <span className="text-[11px] text-[oklch(50%_0.01_260)]">Q{session.currentQuestionIndex + 1}/{total}</span>
      </div>

      <div className="flex-1 p-5 space-y-4 max-w-4xl mx-auto w-full">
        {/* Boss + HP */}
        <div className="flex items-center gap-4 rounded-xl bg-[oklch(12%_0.01_260)] p-4">
          <img src={bossGif} alt={quiz.bossPersona?.name || 'Boss character'} className="h-20 w-20 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[oklch(65%_0.2_25)]">{quiz.bossPersona?.name || 'Boss'}</p>
            {quiz.bossPersona?.introLine && <p className="text-[11px] text-[oklch(55%_0.01_260)] mt-0.5 truncate">{quiz.bossPersona.introLine}</p>}
            <div className="mt-2 flex gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1"><Skull size={10} className="text-[oklch(65%_0.2_25)]" /><span className="text-[10px] text-[oklch(50%_0.01_260)]">Boss</span></div>
                <div className="h-2 rounded-full bg-[oklch(18%_0.01_260)] overflow-hidden" role="progressbar" aria-label={`Boss HP: ${session.bossHp}%`} aria-valuenow={session.bossHp} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[oklch(65%_0.2_25)] transition-all duration-500" style={{ width: `${session.bossHp}%` }} /></div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1"><Heart size={10} className="text-[oklch(72%_0.15_155)]" /><span className="text-[10px] text-[oklch(50%_0.01_260)]">You</span></div>
                <div className="h-2 rounded-full bg-[oklch(18%_0.01_260)] overflow-hidden" role="progressbar" aria-label={`Your HP: ${session.userHp}%`} aria-valuenow={session.userHp} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-[oklch(72%_0.15_155)] transition-all duration-500" style={{ width: `${session.userHp}%` }} /></div>
              </div>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="rounded-xl bg-[oklch(12%_0.01_260)] p-5">
          {question.bossAskLine && <p className="text-[11px] italic text-[oklch(50%_0.01_260)] mb-3">{question.bossAskLine}</p>}
          <h2 className="text-base font-semibold leading-relaxed">{question.prompt}</h2>
        </div>

        {/* Choices */}
        <div className="grid gap-2 sm:grid-cols-2">
          {question.choices.map(c => (
            <button key={c.choiceId} onClick={() => answer(c.choiceId)} disabled={loading}
              className="rounded-lg border border-[oklch(22%_0.01_260)] bg-[oklch(14%_0.01_260)] p-3 text-left text-sm transition hover:border-[var(--color-accent)] hover:bg-[oklch(16%_0.01_260)] disabled:opacity-50">
              <span className="mr-2 text-xs font-bold text-[oklch(50%_0.01_260)]">{c.choiceId}.</span>
              {c.text || c.label || c.choiceId}
            </button>
          ))}
        </div>

        {/* Result feedback */}
        {lastResult && (
          <div className={`rounded-lg p-3 text-sm ${lastResult.isCorrect ? 'bg-[oklch(72%_0.15_155_/_0.1)] text-[oklch(80%_0.12_155)]' : 'bg-[oklch(65%_0.2_25_/_0.1)] text-[oklch(75%_0.15_25)]'}`}>
            <div className="flex items-center gap-1.5 font-semibold text-xs mb-1"><Swords size={12} />{lastResult.isCorrect ? 'Hit!' : 'Countered'}</div>
            <p className="text-xs leading-relaxed">{session.lastNarration || (lastResult.isCorrect ? question.bossCorrectLine : question.bossWrongLine)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
