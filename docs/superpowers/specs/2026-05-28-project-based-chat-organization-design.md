# Project-Based Chat Organization — Design

Date: 2026-05-28
Status: Approved in chat, written for review

## 1. Goal

Add project-based organization to the existing AWS Study Buddy app so authenticated users can:

1. Create projects before using the workspace
2. Switch active project from a dropdown in the main shell
3. See only project-scoped chat threads in the single left sidebar
4. Keep documents, flashcards, quizzes, and battle sessions isolated by project
5. Start multiple named chat threads within each project
6. Deploy the change to AWS on a fresh data model without backward-compatibility constraints

This change must preserve the simplified navigation rule: one left sidebar only, used for chat history. Projects are managed from a dropdown, not a dedicated sidebar.

Local development and local testing must run through Docker Compose only. No direct host-run frontend/backend flow is part of the supported local path.

## 2. Recommended approach

Recommended approach: add a first-class `projects` resource plus project ownership on all user content, then refactor chat from one user-wide message stream into project-scoped threads and messages.

Why this approach:
- matches FR-01 through FR-10 directly
- fits current app shell with minimal UX ambiguity
- keeps backend ownership rules explicit
- allows clean DynamoDB access patterns for project-scoped queries
- fresh deployment means data model can change directly without migration shims

Rejected alternatives:
- UI-only project wrapper around existing user-wide resources: lower immediate effort, but fails strict content isolation and leaves backend rules ambiguous
- deeper project-centric aggregate redesign of every table from scratch: potentially stronger long-term shape, but more refactor surface than needed for this feature

## 3. UX shell design

### 3.1 Workspace layout
The app keeps one left sidebar only. That sidebar displays chat threads for the currently active project.

The top shell adds a project dropdown near the app title. The dropdown is the only project-management entry point and supports:
- switch project
- create project
- rename project
- delete project

No separate project sidebar is introduced.

### 3.2 Default project handling
The app does not auto-create a default project.

If the authenticated user has zero projects, the normal workspace is blocked and replaced by a create-first-project screen. The user must create a project before starting chat or content work.

After project creation succeeds, the new project becomes the active project automatically and the user enters the main workspace.

### 3.3 Project switch behavior
Switching the active project immediately:
- resets unsent chat input
- clears selected document IDs
- clears active thread selection if the current thread belongs to the previous project
- refetches project-scoped resources
- prevents stale content from the previous project from remaining visible while new data loads

The user requested reset behavior rather than draft preservation or switch warnings.

### 3.4 Chat behavior
Each project supports multiple named chat threads.

The left sidebar lists only threads for the active project. Selecting a thread loads only that thread’s messages. Starting a new chat creates a new thread under the active project and makes it visible in the sidebar immediately.

## 4. Domain model

### 4.1 Core entities
Add a first-class project entity and project ownership on all user content.

Entities:
- `projects`
- `chat_threads`
- `chat_messages`
- `documents`
- `flashcard_sets`
- `quizzes`
- `battle_sessions`

### 4.2 Ownership rules
Every entity belongs to the authenticated user. Every content entity also belongs to exactly one project.

Ownership model:
- project belongs to `userId`
- chat thread belongs to `userId` + `projectId`
- chat message belongs to `userId` + `projectId` + `threadId`
- document belongs to `userId` + `projectId`
- flashcard set belongs to `userId` + `projectId`
- quiz belongs to `userId` + `projectId`
- battle session belongs to `userId` + `projectId`

This ensures backend validation can reject resources that match the user but not the active project, or match the project but not the user.

## 5. Data model and access patterns

### 5.1 Recommendation
Keep focused DynamoDB stores rather than merging everything into a single-table redesign.

This aligns with the current codebase, keeps the implementation understandable, and reduces refactor risk before live deployment.

### 5.2 Required query targets
Golden-path queries must avoid scans and support:
- list projects for user
- get project by ID for user
- list chat threads for user + project
- get thread by ID for user + project
- list messages for user + project + thread
- list documents for user + project
- list flashcard sets for user + project
- list quizzes for user + project
- list battle sessions for user + project

### 5.3 Practical storage direction
Exact key layouts can be finalized during implementation planning, but the storage design must support strict project scoping in the query path rather than filtering broad user-wide results in application code.

The current backend already uses focused stores for documents, chat messages, flashcards, quizzes, and battle sessions. This feature should extend those stores with project-aware key design and introduce new project and chat-thread stores.

### 5.4 Fresh-state allowance
Because the user approved a fresh AWS deployment with no backward-compatibility requirement, the table contracts can be updated directly. No legacy data backfill or default-project migration path is required.

## 6. Backend API design

### 6.1 Projects
Add project CRUD routes:
- `GET /projects`
- `POST /projects`
- `PATCH /projects/{projectId}`
- `DELETE /projects/{projectId}`

Validation rules:
- project name required
- empty or whitespace-only names rejected
- duplicate project names for the same user rejected

### 6.2 Chat
Refactor chat into explicit threads and messages:
- `GET /chat/threads?projectId=...`
- `POST /chat/threads`
- `GET /chat/threads/{threadId}/messages`
- `POST /chat/threads/{threadId}/messages`

Behavior:
- thread creation requires `projectId`
- sending a message requires thread ownership validation against `userId` and `projectId`
- the first user message may be sent immediately after thread creation
- sidebar uses thread list, not a flattened user-wide message list

### 6.3 Documents and generated content
Project context becomes required for:
- document upload/list/get
- flashcard generation/list/get
- quiz generation/list/get
- battle session start/list/get/answer

Generated artifacts inherit the active project from the initiating document selection or active workspace context.

### 6.4 Authorization rules
The backend must:
- derive `userId` from validated auth context only
- never trust client-supplied `userId`
- validate resource ownership by both `userId` and `projectId`
- treat wrong-project access the same as inaccessible resource

## 7. Delete-project behavior

Deleting a project is destructive and requires confirmation in the UI.

Cascade delete behavior:
- delete project record
- delete chat threads and messages in that project
- delete documents in that project
- delete flashcard sets in that project
- delete quizzes in that project
- delete battle sessions in that project

Post-delete behavior:
- if another project exists, auto-select a remaining project
- if no project remains, return to the create-first-project screen

S3 cleanup for project-owned documents should be included in the cascade path so fresh state remains consistent.

## 8. Frontend design

### 8.1 App state
Extend frontend bootstrap/app state to include:
- `projects`
- `activeProjectId`
- `activeThreadId`

The current workspace already tracks auth user, selected docs, messages, flashcards, and quizzes. This feature adds project and thread context as first-class state rather than implicit UI filters.

### 8.2 Project dropdown
Add a project dropdown component in the top shell. It must:
- list all user projects
- highlight active project
- switch active project
- create project
- rename project
- delete project

The dropdown is the only project-management surface.

### 8.3 Sidebar
The left sidebar is repurposed to display chat threads only.

Sidebar behavior:
- show threads for active project only
- support selecting existing thread
- support starting a new thread
- update immediately after create/rename/delete actions affecting threads

### 8.4 Main content refresh
When the active project changes, the frontend refetches all scoped resource lists and should show loading or empty states rather than stale content from the previous project.

### 8.5 Content panels
The existing document library, flashcard list, exam list, and battle entry points remain, but every hook and request becomes project-aware.

## 9. Error handling

User-visible recoverable cases:
- no projects exist yet
- empty project name
- duplicate project name
- deleting last project
- project-scoped resource not found
- project switch loads empty content
- unauthorized cross-project or cross-user resource access

Guidelines:
- keep messages explicit and actionable
- prefer empty states over hidden failure
- after wrong-project access or stale selection, refetch current project state

## 10. Local development and test constraint

Local development and local testing are Docker Compose only.

Implications:
- frontend and backend must be started through Compose, not ad hoc host commands
- local verification should run against the Compose-orchestrated stack
- implementation should avoid introducing a separate non-Compose local path in docs, scripts, or habits

## 11. Testing strategy

### 11.1 Backend tests
Add or update tests for:
- project CRUD
- duplicate-name validation
- list queries scoped by project
- chat thread/message ownership rules
- documents scoped by project
- flashcards/quizzes/battles scoped by project
- project cascade delete
- unauthorized cross-project access rejection

### 11.2 Frontend verification targets
Verify:
- create-first-project gate appears for zero-project users
- create project auto-selects new project
- project dropdown switch updates all visible resource lists
- thread sidebar changes with active project
- new chat creates thread under active project
- deleting project reselects remaining project or returns to create-first-project state
- switching project clears draft input and selected docs

### 11.3 End-to-end deploy verification
After AWS deployment to fresh state, verify this golden path:
1. sign in
2. create first project
3. upload document into that project
4. create chat thread and ask grounded question
5. generate flashcards in that project
6. generate quiz in that project
7. start battle session in that project
8. create second project
9. switch projects and confirm thread/docs/flashcards/quizzes/battles are isolated
10. switch back and confirm original project data remains intact

## 12. Implementation approach constraint

Execution should prioritize subagents for independent workstreams, but all work must happen directly on the current `main` branch workspace. Do not create or use git worktrees for this task.

Model preference:
- Sonnet for implementation subagents
- Opus for verification-oriented tasks such as final review, live verification, and deployment/E2E validation

## 13. Implementation focus

This feature should stay surgical:
- no separate project sidebar
- no draft preservation across project switches
- no backward-compatibility shim for old data
- no extra project metadata beyond what the UX needs now

The implementation should follow current frontend/backend structure where possible, adding project and thread boundaries without unrelated refactors.

## 14. Success criteria

The feature is successful when an authenticated user can:
- create a first project before entering the workspace
- manage projects only through a dropdown
- see one left sidebar containing only chat threads for the active project
- create multiple chat threads inside each project
- upload and generate content under the active project
- switch projects and see full isolation across chats, docs, flashcards, quizzes, and battle sessions
- delete a project safely with cascade behavior
- use the deployed AWS app end-to-end with a fresh data model and real project isolation
