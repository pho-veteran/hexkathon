import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setAccessToken } from '../api/client'
import * as cognito from '../lib/cognito'

const AuthContext = createContext(null)

function parseIdToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return { sub: payload.sub, email: payload.email, username: payload['cognito:username'] || payload.email }
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const rt = localStorage.getItem('refreshToken')
    if (!rt) { setLoading(false); return }
    cognito.refreshSession(rt)
      .then(({ accessToken, idToken }) => {
        setAccessToken(accessToken)
        setUser(parseIdToken(idToken))
      })
      .catch(() => {
        localStorage.removeItem('refreshToken')
        setAuthError('Session expired. Please sign in again.')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    setAuthError(null)
    const { accessToken, idToken, refreshToken } = await cognito.signIn(email, password)
    setAccessToken(accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    setUser(parseIdToken(idToken))
  }, [])

  const logout = useCallback(() => {
    cognito.signOut()
    setAccessToken(null)
    setUser(null)
    setAuthError(null)
  }, [])

  const value = useMemo(() => ({
    user, loading, authError, login, logout,
    isAuthenticated: Boolean(user),
  }), [user, loading, authError, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
