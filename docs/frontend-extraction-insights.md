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
