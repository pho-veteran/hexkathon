import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { confirmSignUp, signUp } from '../lib/cognito'
import AuthInput from '../components/ui/auth-input'

export default function VerifyCode() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [email, setEmail] = useState(state?.email || '')
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await confirmSignUp(email, code)
      navigate('/login')
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const handleResend = async () => {
    if (!email) return
    setError(null)
    try {
      // Re-trigger sign up to resend code (Cognito resends on duplicate signup attempt)
      await fetch(`https://cognito-idp.ap-southeast-1.amazonaws.com/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.ResendConfirmationCode' },
        body: JSON.stringify({ ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID, Username: email }),
      })
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } catch (err) { setError('Failed to resend code.') }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-[var(--text-secondary)]">Enter the verification code sent to your email.</p>
      {!state?.email && <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />}
      <AuthInput label="Verification code" value={code} onChange={setCode} autoFocus autoComplete="one-time-code" />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {resent && <p className="text-xs text-[var(--color-success)]">Code resent.</p>}
      <button type="submit" disabled={busy || !email || !code} className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed">
        {busy ? 'Verifying...' : 'Verify'}
      </button>
      <div className="flex justify-between text-xs">
        <button type="button" onClick={handleResend} disabled={!email} className="text-[var(--accent-on-surface)] hover:underline disabled:opacity-50">Resend code</button>
        <Link to="/login" className="text-[var(--text-tertiary)] hover:text-[var(--accent-on-surface)]">Back to sign in</Link>
      </div>
    </form>
  )
}
