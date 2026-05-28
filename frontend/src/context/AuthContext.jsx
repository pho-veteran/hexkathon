import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setAccessToken } from '../api/client'
import { COGNITO } from '../config'

const AUTH_CHANGED_EVENT = 'auth-changed'

const AuthContext = createContext(null)

function parseJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function buildHostedUiUrl(path, params) {
  if (!COGNITO.userPoolDomain || !COGNITO.region) {
    return null
  }
  return `https://${COGNITO.userPoolDomain}.auth.${COGNITO.region}.amazoncognito.com/${path}?${params}`
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)

  const hydrateFromToken = useCallback((token, fallbackToken) => {
    setAccessToken(token)
    sessionStorage.setItem('accessToken', token)
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
    const payload = parseJwtPayload(fallbackToken || token)
    if (payload) {
      setUser({
        sub: payload.sub,
        email: payload.email,
        username: payload['cognito:username'] || payload.username,
      })
    }
  }, [])

  const login = useCallback(() => {
    setAuthError(null)
    const url = buildHostedUiUrl(
      'login',
      new URLSearchParams({
        client_id: COGNITO.clientId || '',
        response_type: 'code',
        scope: 'email openid profile',
        redirect_uri: COGNITO.redirectUri,
      }),
    )
    if (url) {
      window.location.href = url
    }
  }, [])

  const logout = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    sessionStorage.removeItem('accessToken')
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
    const url = buildHostedUiUrl(
      'logout',
      new URLSearchParams({
        client_id: COGNITO.clientId || '',
        logout_uri: COGNITO.signOutUri,
      }),
    )
    if (url) {
      window.location.href = url
    }
  }, [])

  useEffect(() => {
    const restore = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code && COGNITO.clientId && COGNITO.userPoolDomain) {
        try {
          const response = await fetch(
            `https://${COGNITO.userPoolDomain}.auth.${COGNITO.region}.amazoncognito.com/oauth2/token`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: COGNITO.clientId,
                code,
                redirect_uri: COGNITO.redirectUri,
              }),
            },
          )

          if (!response.ok) {
            const message = await response.text().catch(() => '')
            throw new Error(message || `Token exchange failed with status ${response.status}`)
          }

          const tokens = await response.json()
          if (!tokens.access_token) {
            throw new Error('Token exchange did not return an access token')
          }
          hydrateFromToken(tokens.access_token, tokens.id_token || tokens.access_token)
        } catch (error) {
          setAuthError(error.message)
          setAccessToken(null)
          sessionStorage.removeItem('accessToken')
          window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
        }

        window.history.replaceState({}, document.title, window.location.pathname)
        setLoading(false)
        return
      }

      const stored = sessionStorage.getItem('accessToken')
      if (stored) {
        hydrateFromToken(stored)
      }
      setLoading(false)
    }

    restore()
  }, [hydrateFromToken])

  const value = useMemo(() => ({
    user,
    loading,
    authError,
    login,
    logout,
    isAuthenticated: Boolean(user),
  }), [user, loading, authError, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
