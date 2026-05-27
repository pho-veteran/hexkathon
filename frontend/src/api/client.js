import { API_URL } from '../config'

let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`API ${response.status}: ${message}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}
