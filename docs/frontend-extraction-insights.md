# Frontend Extraction Insights

## Scope

This document extracts and documents the current frontend codebase of the **Study Buddy Battle Quiz** application. It identifies existing features, routes, state management, authentication, and UI behavior. It then maps these against mandatory future frontend requirements and identifies gaps.

**This is extraction and requirements documentation only. No redesign, refactoring, or implementation is proposed.**

---

## Executive Summary

The current frontend is a React 19 single-page application built with Vite and Tailwind CSS 4. It uses **state-based screen switching** (no URL router library). Authentication delegates entirely to the **AWS Cognito Hosted UI** via OAuth2 authorization code flow — there are no custom sign-in, sign-up, forgot-password, or verification forms.

The app conditionally renders one of four screens based on auth state and user selection:
1. `AuthGate` — unauthenticated users
2. `CreateProjectGate` — authenticated users with zero projects
3. `Workspace` — main workspace with chat, documents, exams, flashcards
4. `BattleCard` — full-screen battle gameplay

Key technology stack:
- React 19.2.6 + React DOM 19.2.6
- Vite 8.0.12
- Tailwind CSS 4.3.0 (via @tailwindcss/vite plugin)
- lucide-react 1.16.0 (icons)
- No routing library (no react-router)
- No state management library (React Context + useState)

---

## Mandatory Future Frontend Requirements

All items below are **mandatory** for the future redesigned frontend. None are optional, suggested, or "nice to have."

### Authentication
- Custom Sign In form (app-branded, not Cognito Hosted UI)
- Custom Sign Up form
- Custom Forgot Password form
- Custom Reset Password form
- Custom Email/code verification form (when Cognito requires it)
- Logout state handling
- Auth error states with user-friendly messages
- Form validation (client-side)
- Loading states during auth operations
- Disabled submit states
- Password visibility toggle
- Password requirements UI
- Redirect after successful login
- Protected route handling
- Cognito remains the authentication backend

### Project Management
- Project-aware workspace
- Project selector (dropdown or equivalent)
- Create project flow
- Project switching resets workspace state

### Chat
- Sidebar with chat history per project
- Create new chat flow
- Active chat selection with visual highlight
- Chat header showing selected chat name and time
- Main chat message area with user/bot distinction
- Prompt input with Enter-to-send
- Auto-scroll to latest message

### Documents
- Upload/document panel
- File upload restricted to `.pdf` and `.txt`
- File metadata display (name, status)
- Multi-select active file behavior
- File deletion

### Exams
- Exam creation from selected documents
- Exam question-count selector with **5 / 10 / 20** options
- Exam list display
- Exam selection for Battle
- Battle entry button enabled only when an exam is selected

### Flashcards
- Flashcard deck creation from selected documents
- Flashcard list/deck display
- Card flip interaction (front/back)
- Navigation between cards

### Battle
- Battle entry from exam selection
- Opening animation
- Boss persona display
- HP bars (boss and player)
- Question/answer flow with multiple choice
- Correct/incorrect feedback with narration
- Victory screen
- Defeat screen
- Return to workspace

### Layout and Responsiveness
- Responsive app layout
- Consistent navigation structure
- Sidebar + main content + right panel pattern

---


## Route Inventory

### Current Behavior

The application has **no URL-based routing**. There is no `react-router`, `@tanstack/router`, or any routing library installed. Navigation is handled entirely through React state:

| Logical Screen | Trigger Condition | Component | File |
|---|---|---|---|
| Auth Gate | `!isAuthenticated` | `AuthGate` | `src/components/AuthGate.jsx` |
| Create Project Gate | `isAuthenticated && projects.length === 0` | `CreateProjectGate` | `src/components/CreateProjectGate.jsx` |
| Workspace | `isAuthenticated && projects.length > 0 && currentScreen === 'workspace'` | `Workspace` | `src/components/Workspace.jsx` |
| Battle | `isAuthenticated && projects.length > 0 && currentScreen === 'battle'` | `BattleCard` | `src/components/BattleCard.jsx` |

**Route guards:** Implemented via conditional rendering in `App.jsx`. Auth state checked first, then project existence, then screen state.

**Loading state:** A centered "Loading..." text on `bg-slate-50` while `authLoading` or `projectsLoading` is true.

**Empty states:** CreateProjectGate serves as the empty-project state. Chat area shows "No messages yet." Documents show "No documents yet." Exams show "No exams yet." Flashcards show "No flashcards yet."

**Error states:** Auth errors displayed in AuthGate. Action errors displayed inline in Workspace. Battle errors displayed with a "Back" button.

### Mandatory Future Requirement

The future frontend must include a complete URL-based route flow:

```
/login
/register
/forgot-password
/reset-password
/verify-email (or /verify-code)
/workspace (protected)
/workspace/chat/:threadId (protected)
/battle/:sessionId (protected)
```

### Gap / Mismatch

- **No URL routing exists.** The entire app uses `useState('workspace')` to switch between workspace and battle. Browser back/forward buttons have no effect. Deep linking is impossible.
- **No dedicated auth routes.** Login is a single button redirect to Cognito Hosted UI.
- **No register, forgot-password, reset-password, or verify-email screens exist.**

---

## Route Interaction Map

### Current Flow

```
[Page Load]
  │
  ├─ authLoading? → Loading screen
  │
  ├─ !isAuthenticated → AuthGate
  │     └─ Click "Sign In" → redirect to Cognito Hosted UI
  │           └─ Cognito redirects back with ?code=xxx
  │                 └─ Token exchange → hydrate user → isAuthenticated = true
  │
  ├─ projects.length === 0 → CreateProjectGate
  │     └─ Submit project name → API POST /projects → reload projects → Workspace
  │
  └─ projects.length > 0 → Workspace (currentScreen === 'workspace')
        │
        ├─ Chat sidebar: select/create threads
        ├─ Document panel: upload, select documents
        ├─ Study Actions: generate flashcards, generate exam
        ├─ Exam list: click "Play" on any exam
        │     └─ setActiveQuizId(quizId) + setCurrentScreen('battle')
        │           └─ BattleCard renders
        │                 ├─ Opening animation (2.5s)
        │                 ├─ Start/resume battle session
        │                 ├─ Question/answer loop
        │                 ├─ Victory or Defeat screen
        │                 └─ "Return to Workspace" → setCurrentScreen('workspace')
        │
        └─ Sign out → Cognito logout endpoint redirect
```

### Mandatory Future Flow

```
Auth → Login → Register → Forgot Password → Reset Password → Email Verification
  → Protected app entry
    → Project selection → Create project
      → Project workspace
        → Chat (with thread history)
        → Upload documents
        → Create exam (with 5/10/20 question count selector)
        → Create flashcards
        → Battle entry (exam must be selected)
          → Battle gameplay
            → Results / completion states
```

### Gap / Mismatch

- No URL-based navigation between any screens
- No Register flow
- No Forgot Password flow
- No Reset Password flow
- No Email Verification flow
- Battle entry does not require explicit exam "selection" state — clicking "Play" on any exam immediately starts battle

---


## Feature Inventory

### F1 — Authentication

| Aspect | Current Behavior |
|---|---|
| **What exists** | Single "Sign In with AWS Cognito" button that redirects to Cognito Hosted UI |
| **Where** | `AuthGate` component, rendered when `!isAuthenticated` |
| **Files** | `src/components/AuthGate.jsx`, `src/context/AuthContext.jsx`, `src/config.js` |
| **User interactions** | Click sign-in button → redirect to Cognito → return with auth code → token exchange |
| **State changes** | `user` set from JWT payload (sub, email, username), `loading` toggled, `authError` set on failure |
| **API calls** | POST to Cognito `/oauth2/token` endpoint for code-to-token exchange |
| **UI behavior** | Dark gradient background, centered card with title, description, error message (if any), single button |
| **Satisfies future requirement?** | **No** |
| **Missing** | Custom sign-in form, sign-up form, forgot password, reset password, email verification, password toggle, validation, password requirements UI |

### F2 — Project Management

| Aspect | Current Behavior |
|---|---|
| **What exists** | Project CRUD (create, rename, delete), project switching via dropdown |
| **Where** | `ProjectSwitcher` component in Workspace topbar; `CreateProjectGate` for first project |
| **Files** | `src/components/ProjectSwitcher.jsx`, `src/components/CreateProjectGate.jsx`, `src/context/ProjectContext.jsx` |
| **User interactions** | Select project from dropdown, type name + click Create/Rename/Delete |
| **State changes** | `projects[]` array, `activeProjectId`, `loading` |
| **API calls** | GET `/projects`, POST `/projects`, PATCH `/projects/:id`, DELETE `/projects/:id` |
| **UI behavior** | Dropdown select + text input + 3 action buttons (Create/Rename/Delete). Delete has confirm dialog. |
| **Satisfies future requirement?** | **Partially** — CRUD exists but UX is combined into one input field for both create and rename |
| **Missing** | Clearer separation of create vs rename flows |

### F3 — Chat

| Aspect | Current Behavior |
|---|---|
| **What exists** | Thread list sidebar, create new chat, send messages, receive AI responses with citations |
| **Where** | Left sidebar (`ChatThreadSidebar`) + main center panel in `Workspace` |
| **Files** | `src/components/ChatThreadSidebar.jsx`, `src/components/Workspace.jsx`, `src/hooks/useChat.js`, `src/components/CitationModal.jsx` |
| **User interactions** | Click thread to select, click "New chat" to create, type message + Enter/Send, click citation chips |
| **State changes** | `threads[]`, `messages[]`, `activeThreadId`, `inputValue`, `loading` |
| **API calls** | GET `/chat/threads`, POST `/chat/threads`, GET `/chat/threads/:id/messages`, POST `/chat/threads/:id/messages` |
| **UI behavior** | Sidebar with thread list + highlight active. Main area with message bubbles (user right-aligned indigo, bot left-aligned slate). Input bar at bottom. Citation chips open modal. |
| **Satisfies future requirement?** | **Partially** |
| **Missing** | Chat header showing time, chat name editing, no chat deletion |

### F4 — Document Management

| Aspect | Current Behavior |
|---|---|
| **What exists** | File upload, document list with status, multi-select for active documents |
| **Where** | Right sidebar panel in `Workspace` |
| **Files** | `src/components/DocumentLibrary.jsx`, `src/hooks/useDocuments.js` |
| **User interactions** | Click "Upload" → native file picker → upload. Click document to toggle selection. |
| **State changes** | `documents[]`, `selectedDocIds[]`, `loading`, `error` |
| **API calls** | GET `/documents?projectId=`, POST `/documents/upload?projectId=` (multipart/form-data) |
| **UI behavior** | Upload button with dashed border. Document list with checkbox icons. Status badge (processing/ready). Polling every 5s for processing docs. |
| **Satisfies future requirement?** | **Partially** |
| **Missing** | File type restriction in UI (accepts any file, no `.pdf`/`.txt` filter on `<input>`), file deletion, file size display |

### F5 — Exam Creation

| Aspect | Current Behavior |
|---|---|
| **What exists** | "Generate 10-question Exam" button, exam list, "Play" button per exam |
| **Where** | Right sidebar in `Workspace` (Study Actions + ExamListView) |
| **Files** | `src/components/ExamListView.jsx`, `src/hooks/useQuizzes.js`, `src/components/Workspace.jsx` |
| **User interactions** | Select documents → click "Generate 10-question Exam" → exam appears in list → click "Play" to start battle |
| **State changes** | `quizzes[]`, `loading` |
| **API calls** | GET `/quizzes?projectId=`, POST `/quizzes/generate` (body: `{projectId, docIds}`) |
| **UI behavior** | Red-themed button. Exam list with title + Play button. No question count selector. |
| **Satisfies future requirement?** | **No** |
| **Missing** | Question-count selector (5/10/20 options). Currently hardcoded to generate 10 questions (no count param sent to API). No explicit exam selection state before battle — clicking Play immediately starts. |

### F6 — Flashcard Creation

| Aspect | Current Behavior |
|---|---|
| **What exists** | "Generate Flashcards" button, flashcard viewer with flip + navigation |
| **Where** | Right sidebar in `Workspace` (Study Actions + FlashcardList) |
| **Files** | `src/components/FlashcardList.jsx`, `src/hooks/useFlashcards.js`, `src/components/Workspace.jsx` |
| **User interactions** | Select documents → click "Generate Flashcards" → cards appear → click to flip → Previous/Next to navigate |
| **State changes** | `flashcardSets[]`, `currentIndex`, `isFlipped`, `loading` |
| **API calls** | GET `/flashcards?projectId=`, POST `/flashcards/generate` (body: `{projectId, docIds, cardCount: 10}`) |
| **UI behavior** | Card with front/back text, source attribution, Previous/Next buttons, counter "X / Y" |
| **Satisfies future requirement?** | **Partially** — generation and viewing work, but no deck naming or deck-level management |
| **Missing** | Deck naming UI, deck list management, card count selector |

### F7 — Battle

| Aspect | Current Behavior |
|---|---|
| **What exists** | Full battle implementation: opening animation, boss display, HP bars, Q&A flow, victory/defeat |
| **Where** | Full-screen `BattleCard` component |
| **Files** | `src/components/BattleCard.jsx`, `src/hooks/useBattle.js` |
| **User interactions** | Watch opening (2.5s), answer multiple-choice questions, see result feedback, view victory/defeat, click "Return to Workspace" or "Flee Battle" |
| **State changes** | `battleState` (session + quiz), `opening`, `error`, `lastResult`, session persistence in sessionStorage |
| **API calls** | POST `/battle-sessions/start`, GET `/battle-sessions/:id`, POST `/battle-sessions/:id/answers` |
| **UI behavior** | Dark theme (slate-950). Opening GIF. Boss image + persona. Red/green HP bars. Question cards with 4 choices. Correct/incorrect narration. Victory (green) / Defeat (red) with corresponding images. |
| **Satisfies future requirement?** | **Yes** — Battle is fully implemented and must be preserved visually |
| **Missing** | No difficulty selection exists in current code (noted: removal of difficulty selection is the mandate, so this is aligned) |

### F8 — Shared Layout

| Aspect | Current Behavior |
|---|---|
| **What exists** | Top bar with app title, user email, project switcher, sign-out button. Three-column grid layout. |
| **Where** | `Workspace` component |
| **Files** | `src/components/Workspace.jsx` |
| **UI behavior** | White top bar with border-b. Below: 3-column grid `lg:grid-cols-[280px_minmax(0,1fr)_minmax(320px,380px)]`. Left = chat sidebar, Center = chat messages, Right = documents + actions + flashcards + exams. |
| **Satisfies future requirement?** | **Partially** |
| **Missing** | No responsive breakpoints below `lg`. No mobile layout. No collapsible sidebar. |

---


## Authentication Extraction

### Current Auth Architecture

| Aspect | Detail |
|---|---|
| **Auth provider** | AWS Cognito (User Pool) |
| **Integration method** | Cognito Hosted UI via OAuth2 Authorization Code flow |
| **Library** | None (raw fetch to Cognito endpoints) |
| **No Amplify** | Confirmed — no `@aws-amplify` in dependencies |
| **No AWS SDK** | Confirmed — no `@aws-sdk/client-cognito` in dependencies |

### Auth Flow Detail

**Sign-In:**
1. User clicks "Sign In with AWS Cognito" button
2. `login()` builds URL: `https://{domain}.auth.{region}.amazoncognito.com/login?client_id=...&response_type=code&scope=email+openid+profile&redirect_uri=...`
3. Browser redirects to Cognito Hosted UI
4. User authenticates on Cognito's UI (email/password, social, etc.)
5. Cognito redirects back to app with `?code=xxx`
6. `AuthContext` useEffect detects `code` param, POSTs to `/oauth2/token` endpoint
7. Receives `access_token` + `id_token`
8. Stores access token in sessionStorage and in-memory variable
9. Parses JWT payload for user info (sub, email, cognito:username)
10. Cleans URL with `history.replaceState`

**Sign-Out:**
1. Clears in-memory token and sessionStorage
2. Dispatches `auth-changed` event (triggers ProjectContext to clear)
3. Redirects to Cognito logout endpoint: `https://{domain}.auth.{region}.amazoncognito.com/logout?client_id=...&logout_uri=...`

**Token Storage:**
- `sessionStorage.setItem('accessToken', token)` — persists across page refreshes within tab
- In-memory `accessToken` variable in `api/client.js` — used for API calls
- No refresh token handling
- No token expiry detection

**Auth State:**
- `user`: `{ sub, email, username }` or `null`
- `loading`: boolean (true during initial restore)
- `authError`: string or null
- `isAuthenticated`: derived from `Boolean(user)`

**Protected Route Behavior:**
- `App.jsx` checks `isAuthenticated` — if false, renders `AuthGate`
- No redirect-to-login-with-return-url pattern
- No token refresh on 401

**Error Handling:**
- Token exchange failure sets `authError` message
- AuthGate displays error in red text above sign-in button
- No retry mechanism

### Files Involved

| File | Role |
|---|---|
| `src/context/AuthContext.jsx` | Auth state, login/logout functions, token exchange, JWT parsing |
| `src/components/AuthGate.jsx` | Sign-in UI (single button) |
| `src/api/client.js` | Token storage, `apiFetch` with Bearer header |
| `src/config.js` | Cognito configuration (clientId, domain, region, redirectUri, signOutUri) |

### Current Auth Routes

**None.** There are no URL-based auth routes. The entire auth flow is:
- A single component (`AuthGate`) with a redirect button
- Cognito Hosted UI handles all form rendering externally
- Return from Cognito is handled by detecting `?code=` on the same page URL

---

## Mandatory Auth Requirements

The future redesigned frontend **must** implement:

| Requirement | Currently Exists? | Status |
|---|---|---|
| Custom Sign In form | **No** — uses Cognito Hosted UI redirect | **Gap** |
| Custom Sign Up form | **No** — handled by Cognito Hosted UI | **Gap** |
| Custom Forgot Password form | **No** — not implemented at all | **Gap** |
| Custom Reset Password form | **No** — not implemented at all | **Gap** |
| Custom Email/code verification form | **No** — not implemented at all | **Gap** |
| Logout state handling | **Yes** — clears token + redirects to Cognito logout | Exists |
| Auth error states | **Partial** — only token exchange errors shown | **Gap** |
| Form validation | **No** — no forms exist | **Gap** |
| Loading states | **Partial** — global loading spinner only | **Gap** |
| Disabled submit states | **No** — no submit forms exist | **Gap** |
| Password visibility toggle | **No** | **Gap** |
| Password requirements UI | **No** | **Gap** |
| Redirect after successful login | **Partial** — returns to same URL after Cognito redirect | Exists |
| Protected route handling | **Yes** — conditional rendering in App.jsx | Exists |
| Cognito as backend | **Yes** | Exists |
| Do NOT use Cognito Hosted UI as final UX | **Violated** — currently uses Hosted UI | **Gap** |

---


## Chat and Workspace Extraction

### Project Selector Behavior
- **Current:** `<select>` dropdown in `ProjectSwitcher` component. Shows all projects by name. Changing selection calls `switchProject(projectId)`.
- **State effect:** Changing project resets `selectedDocIds`, `inputValue`, `citation`, `actionError`, `activeThreadId` to defaults.
- **Location:** Top-right area of workspace header, inside a bordered card.

### Chat Sidebar Behavior
- **Current:** `ChatThreadSidebar` component. Renders `threads[]` as clickable buttons. Active thread highlighted with `bg-indigo-50 text-indigo-700`.
- **"New chat" button:** Creates thread with title `"Chat N"` (N = threads.length + 1). Auto-selects new thread.
- **Loading state:** Shows "Loading chats..." text.
- **Empty state:** Shows "No chats yet." text.
- **Max height:** `max-h-[70vh]` with `overflow-y-auto`.

### Chat Header Behavior
- **Current:** Static header "Grounded Chat" with subtitle "Ask questions against selected documents."
- **Gap:** Does not show active thread name or timestamp.

### Chat Message Rendering
- **Current:** Messages rendered in a scrollable flex column. User messages right-aligned (indigo bg, white text, rounded-tr-none). Bot messages left-aligned (slate bg, slate border, rounded-tl-none).
- **Content:** `message.content || message.text` displayed with `whitespace-pre-wrap`.
- **Citations:** Rendered as indigo chips below bot messages. Clicking opens `CitationModal` with filename, locator, excerpt.
- **Empty state:** Dashed border box "No messages yet."

### Prompt Input Behavior
- **Current:** Single-line `<input>` with placeholder "Ask AI about selected documents...". Enter key sends (unless Shift held). Send button with loading spinner.
- **Error display:** `actionError` shown above input in red.
- **Auto-thread creation:** If no active thread exists when sending, creates one automatically.

### Upload/Document Panel Behavior
- **Current:** `DocumentLibrary` component in right sidebar. Upload button triggers hidden `<input type="file">`. No `accept` attribute (accepts any file type).
- **Document list:** Shows filename + `kbIngestStatus` badge. Clickable only when status is `"ready"`.
- **Selection:** Multi-select via toggle. Selected = `CheckSquare` icon (indigo). Unselected = `Square` icon (slate).
- **Polling:** If any document has `kbIngestStatus === 'processing'`, polls every 5 seconds.
- **No file deletion UI.**

### Exam Creation Behavior
- **Current:** "Generate 10-question Exam" button. Requires `selectedDocIds.length > 0`. Calls `POST /quizzes/generate` with `{projectId, docIds}`. No question count parameter sent.
- **Exam list:** `ExamListView` shows quiz title + "Play" button per exam.
- **Battle entry:** Clicking "Play" calls `onStartBattle(quiz.quizId)` which sets state to battle screen.

### Flashcard Creation Behavior
- **Current:** "Generate Flashcards" button. Requires `selectedDocIds.length > 0`. Calls `POST /flashcards/generate` with `{projectId, docIds, cardCount: 10}`.
- **Viewer:** `FlashcardList` flattens all sets' cards, shows one card at a time with flip + Previous/Next.

### Battle Entry Behavior
- **Current:** Each exam in `ExamListView` has its own "Play" button. No separate "select exam then start battle" flow. Clicking Play immediately transitions to battle.

### Responsive Behavior
- **Current:** Three-column grid with `lg:grid-cols-[280px_minmax(0,1fr)_minmax(320px,380px)]`. No breakpoints for `sm` or `md`. Below `lg`, columns stack vertically (default grid behavior).
- **No mobile-specific layout.** No hamburger menu. No collapsible sidebar.

---

## Mandatory Chat and Workspace Requirements

| Requirement | Currently Exists? | Status |
|---|---|---|
| Project-aware workspace | **Yes** | Exists |
| Project selector | **Yes** | Exists |
| Create project flow | **Yes** | Exists |
| Sidebar with chat history | **Yes** | Exists |
| Create new chat flow | **Yes** | Exists |
| Active chat selection | **Yes** | Exists |
| Chat header showing selected chat name and time | **No** — shows static "Grounded Chat" | **Gap** |
| Main chat message area | **Yes** | Exists |
| Prompt input | **Yes** | Exists |
| Upload/document panel | **Yes** | Exists |
| File upload for .pdf and .txt | **Partial** — uploads work but no file type restriction in UI | **Gap** |
| File metadata display | **Partial** — shows filename + status, no size | **Gap** |
| Multi-select active file behavior | **Yes** | Exists |
| File deletion | **No** | **Gap** |
| Exam creation | **Yes** | Exists |
| Exam question-count selector (5/10/20) | **No** — hardcoded to 10 | **Gap** |
| Exam selection for Battle | **No** — each exam has direct "Play" button, no selection state | **Gap** |
| Battle entry button enabled only when exam selected | **No** — no global battle button; per-exam Play buttons | **Gap** |
| Flashcard deck creation | **Yes** | Exists |
| Flashcard list/deck state | **Partial** — flattens all decks into one card stream | **Gap** |
| Responsive app layout | **No** — only `lg` breakpoint, no mobile layout | **Gap** |

---


## Battle Route Extraction

### Current Implementation

**Component:** `BattleCard` (`src/components/BattleCard.jsx`)
**Hook:** `useBattle` (`src/hooks/useBattle.js`)

**Visual Phases:**

1. **Opening Animation** (2.5 seconds)
   - Full-screen dark background (`bg-slate-950`)
   - "Entering Battle..." heading in red, uppercase, tracking-widest
   - `opening.gif` displayed full-width with rounded corners and shadow

2. **Battle Gameplay**
   - Dark theme throughout (`bg-slate-950`, white text)
   - "Flee Battle" button (top-left, ArrowLeft icon)
   - Boss card: red border glow, boss persona name, intro line, quiz title, `boss 1.gif` image
   - HP bars: Boss (red) and Player (green) in two-column grid, percentage-based width
   - Question card: question index counter, difficulty badge, boss ask line (italic), prompt text, 4-choice grid
   - Result feedback: green (correct) or red (incorrect) bordered box with Swords icon and narration

3. **Victory Screen**
   - "Return to Workspace" button
   - `win.avif` image (max-h-[60vh], rounded, bordered)
   - "VICTORY" text in green, uppercase, 5xl font
   - Quiz title + HP summary

4. **Defeat Screen**
   - Same layout as victory
   - `lose.jpg` image
   - "DEFEAT" text in red

**Session Persistence:**
- `sessionStorage` key: `battleSession:{projectId}:{quizId}`
- On mount: attempts to resume existing session before starting new one
- On completion: removes session from storage

**Assets Used:**
| Asset | File | Purpose |
|---|---|---|
| Opening animation | `src/assets/opening.gif` (3.6 MB) | 2.5s intro |
| Boss character | `src/assets/boss 1.gif` (965 KB) | Boss display during gameplay |
| Victory image | `src/assets/win.avif` (44 KB) | Victory screen |
| Defeat image | `src/assets/lose.jpg` (130 KB) | Defeat screen |
| Streak animation | `src/assets/streak.gif` (15.4 MB) | Not currently used in BattleCard |

**API Endpoints:**
- `POST /battle-sessions/start` — body: `{projectId, quizId}`
- `GET /battle-sessions/:sessionId?projectId=` — resume session
- `POST /battle-sessions/:sessionId/answers?projectId=` — body: `{questionId, selectedChoiceId}`

**State Shape (from API):**
```
battleState = {
  session: {
    sessionId, projectId, quizId, status ('active'|'won'|'lost'),
    bossHp (0-100), userHp (0-100), currentQuestionIndex,
    answerHistory[], lastNarration
  },
  quiz: {
    quizId, title, bossPersona: { name, introLine },
    questions: [{ questionId, prompt, difficulty, bossAskLine, bossCorrectLine, bossWrongLine, choices: [{ choiceId, text/label }] }]
  }
}
```

**No difficulty selection exists in current code.** Battle starts directly from a quiz — difficulty is embedded in the quiz questions themselves.

---

## Battle Route Preservation Constraint

**The following are mandatory future frontend requirements for Battle:**

1. **Battle-related routes must be preserved visually in any future redesign.**

2. **Existing Battle layout, visual design, assets, animations, characters, backgrounds, icons, and visual identity must remain intact.**

3. **Battle assets must not be replaced:**
   - `opening.gif` — opening animation
   - `boss 1.gif` — boss character
   - `win.avif` — victory screen
   - `lose.jpg` — defeat screen
   - `streak.gif` — streak animation (reserved for future use)

4. **Battle gameplay screens must not be restyled.** The dark theme, HP bars, question cards, choice buttons, result feedback, victory/defeat layouts must remain as-is.

5. **Only the difficulty selection mechanism may be removed in a future implementation.** (Note: no difficulty selection currently exists in the frontend — this constraint applies if one were to be added.)

6. **Battle must no longer ask users to choose difficulty in the redesigned frontend.** Difficulty is determined by the quiz content, not by user selection.

7. **Any future changes to Battle must be limited to:**
   - Removing difficulty selection (if present)
   - Connecting Battle cleanly to the rest of the redesigned app flow (e.g., proper URL routing, transition animations)

8. **Chat routes and workspace routes must be redesigned in the future, but Battle routes must remain visually intact.**

---


## State and Data Model Observations

### Current State Architecture

**Context Providers (global):**
- `AuthContext` — user, loading, authError, login(), logout(), isAuthenticated
- `ProjectContext` — projects[], activeProjectId, loading, createProject(), renameProject(), deleteProject(), switchProject()

**Component-level state (Workspace):**
- `currentScreen` ('workspace' | 'battle') — in App.jsx
- `activeQuizId` — in App.jsx
- `activeThreadId` — in Workspace
- `selectedDocIds[]` — in Workspace
- `inputValue` — in Workspace
- `citation` — in Workspace
- `actionError` — in Workspace

**Hook-managed state:**
- `useChat`: threads[], messages[], loading
- `useDocuments`: documents[], loading, error
- `useQuizzes`: quizzes[], loading
- `useFlashcards`: flashcardSets[], loading
- `useBattle`: battleState, loading

### Current Data Shapes (from API responses)

```
project = { projectId: string, name: string, createdAt: string }
thread = { threadId: string, projectId: string, title: string, createdAt: string }
message = { messageId: string, role: 'user'|'assistant', content: string, citations?: [] }
document = { docId: string, projectId: string, filename: string, kbIngestStatus: string }
quiz = { quizId: string, projectId: string, title: string, questions: [], bossPersona: {} }
flashcardSet = { setId: string, projectId: string, cards: [{ front, back, source }] }
battleSession = { sessionId, projectId, quizId, status, bossHp, userHp, currentQuestionIndex, answerHistory[] }
```

### Differences from Reference Data Model

| Reference Model | Current Implementation | Mismatch |
|---|---|---|
| `projects[].id: number` | `project.projectId: string` (UUID) | Type mismatch — current uses string UUIDs |
| `projects[].files[]` with `active: boolean` | Documents are separate entities with `selectedDocIds[]` state | Selection is UI state, not persisted |
| `projects[].files[].type: 'pdf' \| 'txt'` | No file type field in document response | **Gap** — no type restriction |
| `projects[].files[].size: string` | No size field in document response | **Gap** |
| `projects[].exams[].count: number` | No count field — hardcoded 10 | **Gap** |
| `projects[].chats[].preview: string` | No preview field in thread response | **Gap** |
| `projects[].activeExam: number \| null` | No activeExam state — per-exam Play buttons | **Gap** |
| `projects[].activeFlashcard: number \| null` | No activeFlashcard state | **Gap** |
| `activeChatId: number` | `activeThreadId: string` (component state) | Type mismatch + not global |
| `battle state: bossHp, playerHp, score, streak, currentIdx, timeLeft, isTransitioning` | `battleState.session: { bossHp, userHp, currentQuestionIndex }` — no score, streak, timeLeft, isTransitioning | **Gap** — missing fields |

---

## Functional Specification Reference

This model represents mandatory future frontend behavior unless the current app has a stronger existing model that should be preserved.

```
DATA MODEL
projects[]
  ├── id: number
  ├── name: string
  ├── files[]
  │     ├── name: string
  │     ├── size: string
  │     ├── type: 'pdf' | 'txt'
  │     └── active: boolean
  ├── exams[]
  │     ├── name: string
  │     ├── count: number (5/10/20)
  │     └── time: string
  ├── flashcards[]
  │     ├── name: string
  │     ├── cards: number
  │     └── time: string
  ├── chats[]
  │     ├── id: number
  │     ├── name: string
  │     ├── time: string
  │     └── preview: string
  ├── activeExam: number | null
  └── activeFlashcard: number | null

GLOBAL STATE
  ├── activeProjectId: number
  ├── activeChatId: number | null
  └── battle state: bossHp, playerHp, score, streak, currentIdx, timeLeft, isTransitioning
```

### F1 — PROJECT MANAGEMENT

**Choose project:**
- Click dropdown → show project list
- Click project → set activeProjectId, reset activeChatId = null
- Sidebar chat and tool cards re-render based on the new project

**Create new project:**
- Click "+ New Project"
- Prompt for name → create empty object `{files:[], exams:[], flashcards:[], chats:[]}`
- Auto-select the new project

### F2 — CHAT HISTORY Sidebar

**View list:**
- Render `project.chats[]` — each item includes: icon, name, time, preview

**Choose chat:**
- Click → set activeChatId
- Update: chatHeaderName, chatHeaderTime, topbarChatName
- Highlight active chat in sidebar

**Create new chat:**
- Click "+ New Chat"
- Prompt for name → add to the top of `project.chats[]`
- Auto-select newly created chat

### F3 — CHAT Main Left

**Send message:**
- Input text → Enter or click send button
- Add user message to DOM
- Add bot message "Đang xử lý..."
- After processing → bot replies with AI-generated response
- Auto-scroll to bottom

### F4 — FILE MANAGEMENT Main Right

**Upload file:**
- Click upload zone → native file picker
- Accept: `.pdf`, `.txt`
- Add to `project.files[]` with metadata
- Re-render file list

**Toggle active:**
- Click file → flip `file.active`
- Support multi-select, do not reset other files
- Active = red border, checkmark visible

**Delete file:**
- Click × → splice from `project.files[]`
- Re-render list

### F5 — EXAM CREATION

**Create exam:**
- Choose question count: dropdown 5 / 10 / 20
- Click "Tạo Exam →"
- Add to `project.exams[]`
- Auto-select created exam `activeExam = new index`

**Choose exam for battle:**
- Render `project.exams[]` in Battle section
- Click exam → toggle activeExam
- Button "⚔ Battle" enabled when `activeExam !== null`

### F6 — FLASHCARD CREATION

**Create deck:**
- Click "Tạo Deck →"
- Add to `project.flashcards[]` with:
  - Name: "Deck N"
  - Cards: generated count
  - Time: "vừa xong"

---

## Assets and Styling Observations

### CSS Architecture
- **Tailwind CSS 4** via `@tailwindcss/vite` plugin (no `tailwind.config.js` needed)
- **Custom CSS** in `src/index.css`: only 4 utility classes for 3D flashcard flip (`.perspective-1000`, `.preserve-3d`, `.backface-hidden`, `.rotate-y-180`)
- **`src/App.css`**: Default Vite template CSS (3KB) — appears unused/legacy

### Icon Library
- **lucide-react** — used throughout: `Send`, `Sparkles`, `LoaderCircle`, `ArrowLeft`, `Skull`, `Swords`, `User`, `FileText`, `X`, `CheckSquare`, `Square`, `UploadCloud`, `FileQuestion`

### Color Palette (observed)
- Primary: `indigo-600` (buttons, active states)
- Background: `slate-50` (workspace), `slate-950` (battle)
- Text: `slate-900` (headings), `slate-700` (body), `slate-400`/`slate-500` (secondary)
- Danger: `red-500`/`red-600` (battle, delete)
- Success: `green-400`/`green-500` (victory, player HP)
- Borders: `slate-200` (workspace), `slate-700`/`slate-800` (battle)

### Typography
- No custom fonts loaded. Uses Tailwind's default `font-sans` (system font stack).
- Heading weights: `font-black` (titles), `font-bold` (section heads), `font-semibold` (buttons)

---

## Responsive Behavior Observations

### Current State

| Breakpoint | Behavior |
|---|---|
| `< lg` (< 1024px) | Three-column grid collapses to single column (stacked). No special mobile layout. |
| `≥ lg` (≥ 1024px) | Three-column grid: 280px / flex / 320-380px |
| Battle `md` | Boss card uses `md:grid-cols-[1.2fr_1fr]`. Choices use `md:grid-cols-2`. |

### Gaps
- No mobile navigation (hamburger, drawer, bottom nav)
- No tablet-specific layout
- Sidebar has no collapse/expand toggle
- Right panel (documents, actions) stacks below chat on small screens with no priority ordering
- No `sm:` breakpoint usage anywhere in workspace

---


## Extraction Insights, Requirement Gaps, and Risks

### Missing Mandatory Frontend Flows

| Missing Flow | Severity | Notes |
|---|---|---|
| Custom Sign In form | **Critical** | Currently delegates to Cognito Hosted UI. Must be replaced with app-branded form. |
| Custom Sign Up form | **Critical** | No registration UI exists in the app. |
| Custom Forgot Password form | **Critical** | No forgot password flow exists. |
| Custom Reset Password form | **Critical** | No reset password flow exists. |
| Custom Email/code verification form | **Critical** | No verification UI exists. Cognito may require this during sign-up or MFA. |
| URL-based routing | **High** | No router library. Browser navigation broken. Deep links impossible. |
| Exam question-count selector (5/10/20) | **High** | Hardcoded to 10. No UI for selection. |
| File deletion | **High** | No delete button or API call for documents. |
| File type restriction (.pdf/.txt) | **Medium** | `<input type="file">` has no `accept` attribute. |
| Responsive mobile layout | **High** | No mobile-specific design. Unusable on phones. |
| Chat header with thread name/time | **Medium** | Static header text, not dynamic. |
| Exam selection state for Battle | **Medium** | No `activeExam` concept — each exam has direct Play button. |
| Battle entry button (global, conditional) | **Medium** | No single "Battle" button that requires exam selection. |
| Flashcard deck-level management | **Medium** | All cards flattened into one stream. No per-deck view. |
| File size display | **Low** | Not shown in document list. |

### Existing Flows That Differ from Mandatory Future Requirements

| Current Behavior | Mandatory Requirement | Risk |
|---|---|---|
| Cognito Hosted UI for all auth | Custom app-branded auth forms | Requires implementing Cognito SDK calls (InitiateAuth, SignUp, ForgotPassword, ConfirmForgotPassword, ConfirmSignUp) directly |
| State-based screen switching | URL-based routing | Requires adding react-router or equivalent; all navigation logic must be restructured |
| Per-exam "Play" button | Global "Battle" button enabled by exam selection | Requires new `activeExam` state and conditional button rendering |
| Hardcoded 10-question exam | 5/10/20 selector | Requires UI dropdown + passing `count` param to API |
| No file accept filter | `.pdf` and `.txt` only | Simple fix: add `accept=".pdf,.txt"` to file input |
| No file deletion | Delete button per file | Requires new API endpoint or existing DELETE endpoint integration |

### Fragile State Handling

| Issue | Risk Level | Detail |
|---|---|---|
| No token refresh | **High** | Access token will expire (typically 1 hour). No refresh mechanism. User silently loses auth. API calls will 401. |
| No 401 interceptor | **High** | `apiFetch` does not detect 401 responses to trigger re-auth. |
| sessionStorage only | **Medium** | Token lost when tab closes. No persistent session across browser restarts. |
| No optimistic updates | **Low** | All mutations wait for API response before updating UI. Acceptable but slower UX. |
| activeThreadId sync | **Medium** | If threads list changes externally, `activeThreadId` may point to deleted thread. Current code handles this but with a useEffect race condition risk. |

### Auth Risks

| Risk | Detail |
|---|---|
| No PKCE | OAuth2 code flow without PKCE (Proof Key for Code Exchange). Vulnerable to authorization code interception. |
| Client-side token exchange | Token exchange happens in browser JavaScript. Client secret not used (public client), which is correct, but no PKCE adds risk. |
| No token validation | JWT is parsed but not cryptographically verified. Relies on Cognito's token endpoint returning valid tokens. |
| No session timeout | No idle timeout or forced re-auth after extended inactivity. |

### Battle Preservation Risks

| Risk | Detail |
|---|---|
| Large asset sizes | `streak.gif` is 15.4 MB, `opening.gif` is 3.6 MB. These will impact load times if not lazy-loaded or optimized. |
| `streak.gif` unused | Referenced in assets but not imported in any component. May be intended for future use. Must be preserved. |
| Asset path coupling | Battle assets imported directly via relative paths. Moving to a different routing structure must preserve these imports. |
| Dark theme isolation | Battle uses `bg-slate-950` (near-black). Workspace uses `bg-slate-50` (near-white). Transition between them is abrupt with no animation. |

### UI Consistency Issues

| Issue | Detail |
|---|---|
| Mixed component patterns | `ProjectSwitcher` combines create/rename/delete in one card. `CreateProjectGate` is a separate full-page form. |
| Unused legacy component | `src/components/Flashcard.jsx` contains hardcoded Vietnamese dummy data and 3D flip CSS. Not imported anywhere in the active app. `FlashcardList.jsx` is the active component. |
| Inconsistent naming | `useChat` hook used twice in Workspace — once for thread list, once for active thread messages. Confusing dual instantiation. |
| No loading skeletons | All loading states are plain text ("Loading..."). No skeleton UI or shimmer effects. |

### Data Model Mismatches

| Reference Field | Current Reality | Resolution Needed |
|---|---|---|
| `id: number` | All IDs are string UUIDs | Future frontend should use strings (current backend uses UUIDs) |
| `files[].active: boolean` | Selection is ephemeral UI state (`selectedDocIds[]`) | Decide: persist selection or keep as UI-only state |
| `exams[].count` | Not stored or selectable | Must add to generation flow |
| `chats[].preview` | Not returned by API | Backend may need to add this field |
| `battle.score, streak, timeLeft, isTransitioning` | Not present in current battle state | Backend does not track these. Clarify if needed. |

---

## Open Questions

1. **Token refresh strategy:** Should the redesigned frontend use Cognito refresh tokens (stored in httpOnly cookies or secure storage) or implement silent re-auth?

2. **PKCE implementation:** Should the future auth flow use PKCE with the authorization code grant, or switch to direct Cognito SDK calls (InitiateAuth with SRP)?

3. **Chat preview field:** Does the backend currently return a preview/snippet for chat threads, or must this be added?

4. **Battle score/streak/timeLeft:** Are these fields planned for the backend battle session model, or should the frontend derive them client-side?

5. **streak.gif usage:** When and where should this asset appear? It is preserved in assets but not rendered anywhere.

6. **File deletion API:** Does `DELETE /documents/:docId` exist in the backend? The frontend has no delete UI but the backend may already support it.

7. **Exam count parameter:** Does `POST /quizzes/generate` already accept a `count` or `questionCount` parameter that the frontend is not sending?

8. **Flashcard deck naming:** Should users name decks manually, or should they be auto-named based on source documents?

9. **Mobile-first or desktop-first:** Should the redesigned responsive layout prioritize mobile or desktop as the primary experience?

10. **Battle transition:** Should there be an animated transition between workspace (light theme) and battle (dark theme), or is the abrupt switch intentional?
