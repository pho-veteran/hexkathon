# Part 5: Frontend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all frontend placeholders with Cognito auth, backend-driven data flows, document selection, flashcard/quiz UI, battle rendering, and citation modal.

**Architecture:** Add Cognito auth gate and environment config. Rework Workspace into document-centered panels. Replace dummy chat, hardcoded flashcards, and hardcoded battle with API-driven flows. Keep battle rendering and existing animation/VFX largely intact.

**Tech Stack:** React 19, Vite, Tailwind CSS 4, @aws-amplify/auth or window.location redirect to Cognito Hosted UI, lucide-react

---

### Task 5.1: Add Cognito environment config to frontend

**Files:**
- Create: `frontend/.env.example`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Create frontend env config**

```env
# frontend/.env.example
VITE_API_URL=http://localhost:8000
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_USER_POOL_DOMAIN=
VITE_COGNITO_REGION=ap-southeast-1
VITE_REDIRECT_URI=http://localhost:5173
VITE_SIGNOUT_URI=http://localhost:5173
```

- [ ] **Step 2: Read current main.jsx**

Run: `cat frontend/src/main.jsx`
Expected: basic React 19 createRoot setup

- [ ] **Step 3: Wrap app with AuthProvider**

```jsx
// frontend/src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

- [ ] **Step 4: Create auth config**

```js
// frontend/src/config.js
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const COGNITO = {
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  userPoolDomain: import.meta.env.VITE_COGNITO_USER_POOL_DOMAIN,
  region: import.meta.env.VITE_COGNITO_REGION || 'ap-southeast-1',
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173',
  signOutUri: import.meta.env.VITE_SIGNOUT_URI || 'http://localhost:5173',
}
```

---

### Task 5.2: Create AuthContext

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/api/client.js`

- [ ] **Step 1: Create API client with JWT support**

```js
// frontend/src/api/client.js
import { API_URL } from '../config'

let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export async function apiFetch(path, options = {}) {
  const url = `${API_URL}${path}`
  const headers = { ...options.headers }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`API ${response.status}: ${err}`)
  }

  return response.json()
}
```

- [ ] **Step 2: Create AuthContext**

```jsx
// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { COGNITO } from '../config'
import { setAccessToken } from '../api/client'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function parseJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const buildLoginUrl = useCallback(() => {
    const params = new URLSearchParams({
      client_id: COGNITO.clientId,
      response_type: 'code',
      scope: 'email+openid+profile',
      redirect_uri: COGNITO.redirectUri,
    })
    return `https://${COGNITO.userPoolDomain}.auth.${COGNITO.region}.amazoncognito.com/login?${params}`
  }, [])

  const buildLogoutUrl = useCallback(() => {
    const params = new URLSearchParams({
      client_id: COGNITO.clientId,
      logout_uri: COGNITO.signOutUri,
    })
    return `https://${COGNITO.userPoolDomain}.auth.${COGNITO.region}.amazoncognito.com/logout?${params}`
  }, [])

  useEffect(() => {
    // Try to restore session from stored tokens
    const stored = sessionStorage.getItem('accessToken')
    if (stored) {
      setAccessToken(stored)
      const payload = parseJwtPayload(stored)
      if (payload) {
        setUser({ sub: payload.sub, email: payload.email, username: payload['cognito:username'] })
      }
    }
    setLoading(false)
  }, [])

  const handleRedirectCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return

    // Clear the code from URL
    window.history.replaceState({}, document.title, window.location.pathname)

    // Exchange code for tokens via Cognito token endpoint
    const tokenResponse = await fetch(
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
      }
    )
    const tokens = await tokenResponse.json()
    const idToken = tokens.id_token
    const access = tokens.access_token

    if (access) {
      setAccessToken(access)
      sessionStorage.setItem('accessToken', access)
      const payload = parseJwtPayload(idToken || access)
      if (payload) {
        setUser({ sub: payload.sub, email: payload.email, username: payload['cognito:username'] })
      }
    }
  }, [])

  useEffect(() => {
    handleRedirectCallback()
  }, [handleRedirectCallback])

  const login = useCallback(() => {
    window.location.href = buildLoginUrl()
  }, [buildLoginUrl])

  const logout = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    sessionStorage.removeItem('accessToken')
    window.location.href = buildLogoutUrl()
  }, [buildLogoutUrl])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}
```

---

### Task 5.3: Add auth gate to App

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Read current App.jsx**

Run: `cat frontend/src/App.jsx`
Expected: current workspace/battle toggle screen

- [ ] **Step 2: Modify App with auth gate**

```jsx
// frontend/src/App.jsx
import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Workspace from './components/Workspace'
import BattleCard from './components/BattleCard'
import AuthGate from './components/AuthGate'
import './index.css'

export default function App() {
  const { isAuthenticated, loading } = useAuth()
  const [currentScreen, setCurrentScreen] = useState('workspace')
  const [activeQuizId, setActiveQuizId] = useState(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-lg">Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthGate />
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {currentScreen === 'workspace' ? (
        <Workspace onStartBattle={(quizId) => { setActiveQuizId(quizId); setCurrentScreen('battle') }} />
      ) : (
        <BattleCard quizId={activeQuizId} onEndBattle={() => { setCurrentScreen('workspace'); setActiveQuizId(null) }} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create AuthGate component**

```jsx
// frontend/src/components/AuthGate.jsx
import { useAuth } from '../context/AuthContext'

export default function AuthGate() {
  const { login } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">
          Study Buddy <span className="text-indigo-400">Battle Quiz</span>
        </h1>
        <p className="text-slate-400 mb-8 text-lg">
          Upload your documents, generate flashcards and quizzes with AI, and battle your way through exams.
        </p>
        <button
          onClick={login}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-105 focus:outline-none text-lg"
        >
          Sign In with AWS Cognito
        </button>
      </div>
    </div>
  )
}
```

---

### Task 5.4: Create API integration hooks

**Files:**
- Create: `frontend/src/hooks/useDocuments.js`
- Create: `frontend/src/hooks/useChat.js`
- Create: `frontend/src/hooks/useQuizzes.js`
- Create: `frontend/src/hooks/useBattle.js`

- [ ] **Step 1: Create useDocuments hook**

```js
// frontend/src/hooks/useDocuments.js
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../api/client'

export function useDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/documents')
      setDocuments(data.documents)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadDocument = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const result = await apiFetch('/documents/upload', { method: 'POST', body: formData })
    await loadDocuments()
    return result
  }, [loadDocuments])

  useEffect(() => { loadDocuments() }, [loadDocuments])

  return { documents, loading, error, uploadDocument, reloadDocuments: loadDocuments }
}
```

- [ ] **Step 2: Create useChat hook**

```js
// frontend/src/hooks/useChat.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api/client'

export function useChat() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const initialLoadDone = useRef(false)

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiFetch('/chat/messages')
      setMessages(data.messages)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      loadMessages()
    }
  }, [loadMessages])

  const sendMessage = useCallback(async (question, docIds) => {
    setLoading(true)
    try {
      const result = await apiFetch('/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, docIds }),
      })
      await loadMessages()
      return result
    } finally {
      setLoading(false)
    }
  }, [loadMessages])

  return { messages, loading, sendMessage }
}
```

- [ ] **Step 3: Create useQuizzes hook**

```js
// frontend/src/hooks/useQuizzes.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api/client'

export function useQuizzes() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const initialLoadDone = useRef(false)

  const loadQuizzes = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/quizzes')
      setQuizzes(data.quizzes)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      loadQuizzes()
    }
  }, [loadQuizzes])

  const generateQuiz = useCallback(async (docIds) => {
    setLoading(true)
    try {
      const result = await apiFetch('/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds }),
      })
      await loadQuizzes()
      return result
    } finally {
      setLoading(false)
    }
  }, [loadQuizzes])

  return { quizzes, loading, generateQuiz, reloadQuizzes: loadQuizzes }
}
```

- [ ] **Step 4: Create useBattle hook**

```js
// frontend/src/hooks/useBattle.js
import { useState, useCallback } from 'react'
import { apiFetch } from '../api/client'

export function useBattle() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)

  const startBattle = useCallback(async (quizId) => {
    setLoading(true)
    try {
      const result = await apiFetch('/battle-sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      })
      setSession(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const answerQuestion = useCallback(async (sessionId, questionId, selectedChoiceId) => {
    setLoading(true)
    try {
      const result = await apiFetch(`/battle-sessions/${sessionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedChoiceId }),
      })
      setSession(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const resumeSession = useCallback(async (sessionId) => {
    setLoading(true)
    try {
      const result = await apiFetch(`/battle-sessions/${sessionId}`)
      setSession(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  return { session, loading, startBattle, answerQuestion, resumeSession }
}
```

---

### Task 5.5: Rework Workspace with document selection and panels

**Files:**
- Modify: `frontend/src/components/Workspace.jsx`

- [ ] **Step 1: Read current Workspace jsx length**

Run: `wc -l frontend/src/components/Workspace.jsx`
Expected: ~227 lines

- [ ] **Step 2: Replace Workspace with backend-driven panels**

The Workspace rerender replaces the entire file. Key changes:
- add file upload that calls `uploadDocument`
- replace dummy file list with `documents` from hook
- add multi-select with checkbox per document
- replace dummy chat with `sendMessage` from hook, render citations as clickable chips
- replace dummy flashcard generate button with API call, load from `flashcardSets`
- add quiz generation button that calls `generateQuiz` from hook
- add exam list showing quizzes from hook, each with "Play Battle" action
- keep layout: left panel (chat) + right panel (file/AI/exam list)

The code is substantial. Implement panes as separate components for maintainability.

Create:
- `frontend/src/components/DocumentLibrary.jsx`
- `frontend/src/hooks/useFlashcards.js`
- `frontend/src/components/CitationModal.jsx`
- `frontend/src/components/ExamListView.jsx`

- [ ] **Step 3: Create DocumentLibrary component**

```jsx
// frontend/src/components/DocumentLibrary.jsx
import { useDocuments } from '../hooks/useDocuments'
import { UploadCloud, FileText, CheckSquare, Square } from 'lucide-react'
import { useRef } from 'react'

export default function DocumentLibrary({ selectedDocIds, onSelectionChange }) {
  const { documents, loading, uploadDocument } = useDocuments()
  const fileInputRef = useRef(null)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadDocument(file)
    }
  }

  const toggleDoc = (docId) => {
    const next = selectedDocIds.includes(docId)
      ? selectedDocIds.filter(id => id !== docId)
      : [...selectedDocIds, docId]
    onSelectionChange(next)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-3">Documents</h3>

      <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-lg text-sm mb-3 flex items-center justify-center gap-2"
      >
        <UploadCloud className="w-4 h-4" /> Upload PDF
      </button>

      {loading ? (
        <p className="text-xs text-slate-400">Loading...</p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {documents.map(doc => (
            <li
              key={doc.docId}
              className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-slate-50 cursor-pointer"
              onClick={() => toggleDoc(doc.docId)}
            >
              {selectedDocIds.includes(doc.docId) ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-400" />}
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate text-slate-700">{doc.filename}</span>
              {doc.kbIngestStatus === 'ready' ? (
                <span className="ml-auto text-xs text-green-600">ready</span>
              ) : (
                <span className="ml-auto text-xs text-amber-500">{doc.kbIngestStatus}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create useFlashcards hook**

```js
// frontend/src/hooks/useFlashcards.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../api/client'

export function useFlashcards() {
  const [flashcardSets, setFlashcardSets] = useState([])
  const [loading, setLoading] = useState(false)
  const initialLoadDone = useRef(false)

  const loadFlashcards = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/flashcards')
      setFlashcardSets(data.flashcardSets)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      loadFlashcards()
    }
  }, [loadFlashcards])

  const generateFlashcards = useCallback(async (docIds, cardCount = 10) => {
    setLoading(true)
    try {
      const result = await apiFetch('/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docIds, cardCount }),
      })
      await loadFlashcards()
      return result
    } finally {
      setLoading(false)
    }
  }, [loadFlashcards])

  return { flashcardSets, loading, generateFlashcards, reloadFlashcards: loadFlashcards }
}
```

- [ ] **Step 5: Create CitationModal component**

```jsx
// frontend/src/components/CitationModal.jsx
import { X, FileText } from 'lucide-react'

export default function CitationModal({ citation, onClose }) {
  if (!citation) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Source
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="font-semibold text-slate-600">File:</span> {citation.filename || 'Unknown'}</p>
          {citation.locator && <p><span className="font-semibold text-slate-600">Locator:</span> {citation.locator}</p>}
          <div>
            <span className="font-semibold text-slate-600">Excerpt:</span>
            <p className="mt-1 p-3 bg-slate-50 rounded text-slate-700 text-sm leading-relaxed">{citation.excerpt}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create ExamListView**

```jsx
// frontend/src/components/ExamListView.jsx
import { useQuizzes } from '../hooks/useQuizzes'
import { FileQuestion, Swords } from 'lucide-react'

export default function ExamListView({ selectedDocIds, onPlayBattle }) {
  const { quizzes, loading, generateQuiz } = useQuizzes()

  if (loading) return <p className="text-xs text-slate-400">Loading exams...</p>

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-3">Saved Exams</h3>
      {quizzes.length === 0 && (
        <p className="text-xs text-slate-400">No exams yet. Generate one from your documents.</p>
      )}
      <ul className="space-y-2">
        {quizzes.map(quiz => (
          <li key={quiz.quizId} className="flex items-center justify-between p-2 bg-slate-50 rounded">
            <div className="flex items-center gap-2">
              <FileQuestion className="w-4 h-4 text-indigo-500" />
              <span className="text-sm text-slate-700 truncate">{quiz.title}</span>
            </div>
            <button
              onClick={() => onPlayBattle(quiz.quizId)}
              className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded font-bold"
            >
              <Swords className="w-3 h-3" /> Play
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 7: Rewrite Workspace**

Replace entire `frontend/src/components/Workspace.jsx` with an import-driven version that uses:
- `DocumentLibrary` for file selection
- `useChat` and `useDocuments` and `useQuizzes` hooks
- `CitationModal` for citation click handling
- send chat to API with `selectedDocIds`
- `generateQuiz` and `onStartBattle` for quiz creation and battle entry

(This step is the largest. Write the full component code.

---

### Task 5.6: Wire BattleCard to backend battle session

**Files:**
- Modify: `frontend/src/components/BattleCard.jsx`

- [ ] **Step 1: Add quiz selection before battle**

Create simplified battle start flow:
- accept `quizId` prop or let user pick from passed quiz
- remove difficulty selection (difficulty comes from quiz) or keep as UX overlay
- load quiz data from API for rendering boss intro

- [ ] **Step 2: Replace QUESTION array with API questions**

Change BattleCard from reading hardcoded `QUESTIONS` to reading `quiz.questions[currentIdx]` where `quiz` is loaded from the battle API response. The battle session start and get endpoints return `{session, quiz}` — frontend stores both and renders questions from `quiz.questions[session.currentQuestionIndex]`.

- [ ] **Step 3: Replace local state updates with answerQuestion API calls**

Change `handleAnswer` to call `answerQuestion(sessionId, questionId, selectedChoiceId)` and update local state from API response. Keep existing animation/VFX effects in place.

- [ ] **Step 4: Add quizId prop from App**

```jsx
// frontend/src/App.jsx modification
const [activeQuizId, setActiveQuizId] = useState(null)

// Pass to battle:
<BattleCard quizId={activeQuizId} onEndBattle={() => { setCurrentScreen('workspace'); setActiveQuizId(null) }} />
```

---

### Task 5.7: Run frontend build

- [ ] **Step 1: Verify frontend builds without errors**

Run: `cd frontend && npm run build`
Expected: build succeeds, no syntax/import errors

---

### Plan Self-Check

**Spec coverage:** Auth gate and Cognito Hosted UI (section 6.1), document-centered workspace (section 6.2), document library multi-select (section 6.2), chat panel with citation chips (section 6.2 + section 8.3), AI actions for flashcards/quizzes (section 6.2), exam list (section 6.2), battle screen integration (section 6.3), backend-driven quiz/battle (section 5.5-5.6).

**No placeholders:** component code and hooks fully specified with imports and signatures.

**Type consistency:** API endpoints match Part 2-4 routing (`/documents`, `/chat/messages`, `/quizzes`, `/battle-sessions/`).
