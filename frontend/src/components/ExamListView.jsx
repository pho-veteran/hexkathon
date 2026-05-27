import { FileQuestion, Swords } from 'lucide-react'

export default function ExamListView({ quizzes, loading, onPlayBattle }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-800">Saved Exams</h3>
      {loading ? <p className="text-xs text-slate-400">Loading exams...</p> : null}
      {!loading && quizzes.length === 0 ? (
        <p className="text-xs text-slate-400">No exams yet.</p>
      ) : null}
      <ul className="space-y-2">
        {quizzes.map((quiz) => (
          <li key={quiz.quizId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <div className="min-w-0 flex items-center gap-2">
              <FileQuestion className="h-4 w-4 shrink-0 text-indigo-500" />
              <span className="truncate text-sm text-slate-700">{quiz.title}</span>
            </div>
            <button
              onClick={() => onPlayBattle(quiz.quizId)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600"
            >
              <Swords className="h-3 w-3" /> Play
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
