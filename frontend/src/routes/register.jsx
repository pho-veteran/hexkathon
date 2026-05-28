import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { signUp } from '../lib/cognito'
import AuthInput from '../components/ui/auth-input'

const PW_RULES = [
  { test: v => v.length >= 8, label: '8+ characters' },
  { test: v => /[A-Z]/.test(v), label: 'Uppercase letter' },
  { test: v => /[0-9]/.test(v), label: 'Number' },
  { test: v => /[^A-Za-z0-9]/.test(v), label: 'Special character' },
]

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const pwValid = PW_RULES.every(r => r.test(password))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signUp(email, password)
      navigate('/verify', { state: { email } })
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoFocus autoComplete="email" />
      <AuthInput label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      {password && (
        <ul className="grid grid-cols-2 gap-1 text-[11px]" aria-live="polite" aria-label="Password requirements">
          {PW_RULES.map(r => (
            <li key={r.label} aria-label={`${r.label}: ${r.test(password) ? 'met' : 'not met'}`} className={r.test(password) ? 'text-[var(--color-success)]' : 'text-[var(--text-tertiary)]'}>
              {r.test(password) ? '✓' : '○'} {r.label}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <button disabled={busy || !email || !pwValid} className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? 'Creating...' : 'Create account'}
      </button>
      <p className="text-xs text-[var(--text-tertiary)] text-center">
        Already have an account? <Link to="/login" className="text-[var(--accent-on-surface)]">Sign in</Link>
      </p>
    </form>
  )
}
