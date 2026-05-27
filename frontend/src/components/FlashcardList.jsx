import { useMemo, useState } from 'react'

export default function FlashcardList({ flashcardSets }) {
  const cards = useMemo(() => flashcardSets.flatMap((set) => set.cards || []), [flashcardSets])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400 shadow-sm">
        No flashcards yet.
      </div>
    )
  }

  const currentCard = cards[currentIndex]

  const move = (delta) => {
    setIsFlipped(false)
    setCurrentIndex((index) => (index + delta + cards.length) % cards.length)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Flashcards</h3>
        <span className="text-xs text-slate-400">{currentIndex + 1} / {cards.length}</span>
      </div>
      <button
        onClick={() => setIsFlipped((value) => !value)}
        className="flex min-h-56 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center transition hover:bg-slate-100"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">{isFlipped ? 'Back' : 'Front'}</p>
          <p className="mt-3 text-lg font-semibold text-slate-800">
            {isFlipped ? currentCard.back : currentCard.front}
          </p>
          {currentCard.source ? <p className="mt-4 text-xs text-slate-400">Source: {currentCard.source}</p> : null}
        </div>
      </button>
      <div className="mt-3 flex justify-between gap-3">
        <button onClick={() => move(-1)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
          Previous
        </button>
        <button onClick={() => move(1)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
          Next
        </button>
      </div>
    </div>
  )
}
