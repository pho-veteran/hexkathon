import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../context/auth-context'
import AuthInput from '../components/ui/auth-input'

export default function Login() {
  const { login, authError: sessionError } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const displayError = error || sessionError

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
      navigate('/workspace', { replace: true })
    } catch (err) {
      setError(err.message?.includes('Incorrect') ? 'Incorrect email or password.' : err.message || 'Sign in failed.')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoFocus autoComplete="email" />
      <AuthInput label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      {displayError && <p className="text-xs text-[var(--color-danger)]" aria-live="polite">{displayError}</p>}
      <button disabled={busy || !email || !password} className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
      <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
        <Link to="/register" className="hover:text-[var(--accent-on-surface)] transition">Create account</Link>
        <Link to="/forgot-password" className="hover:text-[var(--accent-on-surface)] transition">Forgot password?</Link>
      </div>
    </form>
  )
}
