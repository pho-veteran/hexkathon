import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LoaderCircle, Skull, Swords, User } from 'lucide-react'
import openingGif from '../assets/opening.gif'
import winAvif from '../assets/win.avif'
import loseJpg from '../assets/lose.jpg'
import boss1Gif from '../assets/boss 1.gif'
import { useBattle } from '../hooks/useBattle'

function resolveChoiceText(choice) {
  return choice.text || choice.label || choice.choiceId
}

export default function BattleCard({ quizId, onEndBattle }) {
  const { battleState, loading, startBattle, answerQuestion } = useBattle()
  const [opening, setOpening] = useState(true)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setOpening(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!quizId) {
      setError('Missing quiz selection.')
      return
    }

    startBattle(quizId).catch((err) => {
      setError(err.message)
    })
  }, [quizId, startBattle])

  const session = battleState?.session
  const quiz = battleState?.quiz
  const currentQuestion = useMemo(() => {
    if (!session || !quiz?.questions) {
      return null
    }
    return quiz.questions[session.currentQuestionIndex] || null
  }, [session, quiz])

  const totalQuestions = quiz?.questions?.length || 0
  const isFinished = session?.status !== 'active' || !currentQuestion
  const victory = session?.bossHp === 0 || session?.userHp > 0

  const handleAnswer = async (choiceId) => {
    if (!session || !currentQuestion || loading) {
      return
    }

    setError(null)
    try {
      const result = await answerQuestion(session.sessionId, currentQuestion.questionId, choiceId)
      const answerEntry = result.session?.answerHistory?.at(-1)
      setLastResult(answerEntry)
    } catch (err) {
      setError(err.message)
    }
  }

  if (opening) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <h2 className="mb-8 text-4xl font-black uppercase tracking-widest text-red-500">Entering Battle...</h2>
        <img src={openingGif} alt="Opening" className="w-full max-w-4xl rounded-2xl shadow-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <p className="text-lg text-red-400">{error}</p>
        <button onClick={onEndBattle} className="mt-6 flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>
    )
  }

  if (!session || !quiz) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (isFinished) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <button onClick={onEndBattle} className="mb-6 flex items-center gap-2 text-slate-300 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Return to Workspace
        </button>
        <div className="mx-auto max-w-4xl text-center">
          <img
            src={victory ? winAvif : loseJpg}
            alt={victory ? 'Victory' : 'Defeat'}
            className="mx-auto mb-8 max-h-[60vh] rounded-2xl border-4 border-slate-800 shadow-2xl"
          />
          <h2 className={`text-5xl font-black uppercase ${victory ? 'text-green-400' : 'text-red-400'}`}>
            {victory ? 'Victory' : 'Defeat'}
          </h2>
          <p className="mt-4 text-xl text-slate-300">{quiz.title}</p>
          <p className="mt-2 text-sm text-slate-400">Boss HP: {session.bossHp} · Your HP: {session.userHp}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-white">
      <button onClick={onEndBattle} className="mb-4 flex items-center gap-2 text-slate-300 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Flee Battle
      </button>

      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-2xl border border-red-500/40 bg-slate-900 p-5 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
          <div className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-red-400">Boss Battle</p>
              <h1 className="mt-2 text-3xl font-black">{quiz.bossPersona?.name || 'Boss'}</h1>
              {quiz.bossPersona?.introLine ? <p className="mt-3 text-slate-300">{quiz.bossPersona.introLine}</p> : null}
              <p className="mt-3 text-sm text-slate-400">{quiz.title}</p>
            </div>
            <div className="flex justify-center">
              <img src={boss1Gif} alt="Boss" className="max-h-64 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center gap-2 text-red-400"><Skull className="h-4 w-4" /> Boss HP</div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${session.bossHp}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-400">{session.bossHp}/100</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center gap-2 text-green-400"><User className="h-4 w-4" /> Your HP</div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${session.userHp}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-400">{session.userHp}/100</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">Question {session.currentQuestionIndex + 1} / {totalQuestions}</p>
            <p className="text-sm uppercase tracking-wide text-indigo-300">{currentQuestion.difficulty}</p>
          </div>

          {currentQuestion.bossAskLine ? <p className="mb-4 text-sm italic text-slate-400">{currentQuestion.bossAskLine}</p> : null}
          <h2 className="text-2xl font-bold leading-relaxed">{currentQuestion.prompt}</h2>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {currentQuestion.choices.map((choice) => (
              <button
                key={choice.choiceId}
                onClick={() => handleAnswer(choice.choiceId)}
                disabled={loading}
                className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 text-left transition hover:border-indigo-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="mr-3 font-bold text-slate-400">{choice.choiceId}.</span>
                {resolveChoiceText(choice)}
              </button>
            ))}
          </div>

          {lastResult ? (
            <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${lastResult.isCorrect ? 'border-green-500/40 bg-green-500/10 text-green-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}>
              <div className="flex items-center gap-2 font-semibold">
                <Swords className="h-4 w-4" />
                {lastResult.isCorrect ? 'Correct hit' : 'Boss countered'}
              </div>
              <p className="mt-2">{session.lastNarration || currentQuestion.bossWrongLine || currentQuestion.bossCorrectLine}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
