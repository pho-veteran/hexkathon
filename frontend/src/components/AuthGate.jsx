import { useAuth } from '../context/AuthContext'

export default function AuthGate() {
  const { login, authError } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-black text-white tracking-tight">
          Study Buddy <span className="text-indigo-400">Battle Quiz</span>
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          Upload documents, ask grounded questions, generate flashcards and exams, then fight boss battle from saved quizzes.
        </p>
        {authError ? <p className="mt-6 text-sm text-red-300">{authError}</p> : null}
        <button
          onClick={login}
          className="mt-8 rounded-xl bg-indigo-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-indigo-500"
        >
          Sign In with AWS Cognito
        </button>
      </div>
    </div>
  )
}
