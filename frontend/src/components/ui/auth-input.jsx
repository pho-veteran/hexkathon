import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthInput({ label, type = 'text', value, onChange, autoFocus, autoComplete }) {
  const [show, setShow] = useState(false)
  const id = useId()
  const isPassword = type === 'password'
  const inputType = isPassword ? (show ? 'text' : 'password') : type

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-on-surface)] placeholder:text-[var(--text-tertiary)]"
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  )
}
