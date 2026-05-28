import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { confirmNewPassword, forgotPassword } from '../lib/cognito'
import AuthInput from '../components/ui/auth-input'

const PW_RULES = [
  { test: v => v.length >= 8, label: '8+ characters' },
  { test: v => /[A-Z]/.test(v), label: 'Uppercase' },
  { test: v => /[0-9]/.test(v), label: 'Number' },
  { test: v => /[^A-Za-z0-9]/.test(v), label: 'Special char' },
]

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPw, setNewPw] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const pwValid = PW_RULES.every(r => r.test(newPw))

  const handleRequestCode = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await forgotPassword(email)
      setStep('reset')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await confirmNewPassword(email, code, newPw)
      navigate('/login')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  if (step === 'reset') {
    return (
      <form onSubmit={handleReset} className="space-y-4">
        <p className="text-xs text-[var(--text-secondary)]">Code sent to {email}</p>
        <AuthInput label="Verification code" value={code} onChange={setCode} autoFocus autoComplete="one-time-code" />
        <AuthInput label="New password" type="password" value={newPw} onChange={setNewPw} autoComplete="new-password" />
        {newPw && (
          <ul className="grid grid-cols-2 gap-1 text-[11px]">
            {PW_RULES.map(r => (
              <li key={r.label} className={r.test(newPw) ? 'text-[var(--color-success)]' : 'text-[var(--text-tertiary)]'}>
                {r.test(newPw) ? '✓' : '○'} {r.label}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        <button disabled={busy || !code || !pwValid} className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleRequestCode} className="space-y-4">
      <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoFocus autoComplete="email" />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <button disabled={busy || !email} className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? 'Sending...' : 'Send reset code'}
      </button>
      <Link to="/login" className="block text-xs text-[var(--text-tertiary)] text-center hover:text-[var(--accent-on-surface)]">Back to sign in</Link>
    </form>
  )
}
