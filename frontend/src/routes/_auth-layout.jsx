import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../context/auth-context'

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="block h-5 w-5 animate-spin rounded-full border-2 border-[var(--text-tertiary)] border-t-transparent" />
    </div>
  )
  if (isAuthenticated) return <Navigate to="/workspace" replace />

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)] mb-1">Study Buddy</h1>
        <p className="text-xs text-[var(--text-tertiary)] mb-8">Upload. Learn. Battle.</p>
        <Outlet />
      </div>
    </main>
  )
}
