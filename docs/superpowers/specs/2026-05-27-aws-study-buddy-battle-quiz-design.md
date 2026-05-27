# AWS Study Buddy + Battle Quiz — Design

Date: 2026-05-27
Status: Approved in chat, written for review

## 1. Goal

Deliver AWS-first MVP for W7 EduTech capstone where trainer can:

1. Open HTTPS frontend
2. Sign in with Cognito Hosted UI
3. Upload study documents
4. Ask grounded chat questions and inspect citations
5. Generate flashcards from selected documents
6. Generate reusable 10-question quiz exams from selected documents
7. Choose saved exam and play Battle Quiz with boss narration
8. Refresh or reopen browser and still see documents, chat history, generated artifacts, and battle state

This design assumes real AWS services from start. Local development must run through Docker Compose only, with local containers orchestrating frontend/backend entrypoints while still targeting deployed AWS services. No ad hoc local environment flow and no local-stub backend are part of golden path.

## 2. Recommended approach

Recommended approach: create new `backend/` service derived from `W7/starter_apps/studybot` patterns, while keeping `frontend/` as standalone Vite app.

Why this approach:
- `studybot` already matches EduTech upload + retrieval + chat flow
- it is user-scoped rather than tenant-scoped, which aligns better with Cognito user identity
- it gives reusable adapter and FastAPI structure without forcing multi-tenant concepts from `dochub`
- it is faster than greenfield backend, while still leaving room to add quiz and battle domain models cleanly

Rejected alternatives:
- embed backend into frontend repo structure: simpler short-term layout, but worse boundaries and harder Terraform/deploy story
- greenfield backend from scratch: cleaner domain model, but too much wiring risk for hackathon timeline

## 3. High-level architecture

### Frontend
- Existing Vite React app in `frontend/`
- Local dev: frontend runs through Docker Compose against AWS backend endpoints
- Deploy: S3 + CloudFront over HTTPS

### Authentication
- Amazon Cognito User Pool + Hosted UI
- Frontend redirects users to Hosted UI for sign-in
- Cognito returns tokens to frontend
- Frontend sends bearer token on protected API calls
- API Gateway validates JWT before invoking Lambda

### Backend
- New FastAPI app in `backend/`
- Local dev: backend runs through Docker Compose only
- Deploy on AWS Lambda
- API Gateway HTTP API routes requests to Lambda
- Backend owns all document, chat, flashcard, quiz, citation, and battle logic

### Storage and AI
- S3 stores uploaded original documents
- DynamoDB stores application state
- Bedrock Knowledge Base performs retrieval over uploaded documents
- Bedrock model invocation handles:
  - grounded chat responses
  - flashcard generation
  - quiz generation
  - boss narration content generation inside quiz payload

### Infrastructure as Code
- Terraform manages Cognito, API Gateway, Lambda, IAM, S3, DynamoDB, CloudFront, Bedrock KB integration resources, and budget-conscious defaults
- Docker Compose is required for local orchestration so team uses one consistent startup path instead of hand-run local commands or mixed environments

## 4. System boundaries

### `frontend/`
Responsibilities:
- Cognito sign-in/out entry
- document upload UI
- selected-document scoping UI
- chat history display and citation modal
- flashcard viewing
- exam list and creation flow
- battle gameplay rendering and answer submission

Non-responsibilities:
- ownership enforcement
- answer validation
- quiz correctness
- state persistence authority
- retrieval logic

### `backend/`
Responsibilities:
- resolve authenticated user identity from JWT-backed request context
- persist and query app state
- upload files to S3
- coordinate KB ingest/readiness flow
- retrieve citations from KB
- invoke Bedrock models with strict output schemas
- validate battle answers against stored quiz data
- compute battle state transitions

### AWS managed services
Responsibilities:
- Cognito: user authentication
- API Gateway: HTTPS API, JWT protection
- Lambda: compute
- S3: object storage
- DynamoDB: persistence
- Bedrock KB: retrieval layer
- Bedrock model runtime: generation layer

## 5. Core user flows

### 5.1 Sign-in
1. User opens frontend
2. If no session, frontend shows sign-in CTA
3. User authenticates via Cognito Hosted UI
4. Frontend stores session tokens and loads protected app data

### 5.2 Upload and ingest
1. User uploads PDF/slide/text document
2. Frontend sends multipart request to backend
3. Backend stores original file in S3 under user-scoped key
4. Backend creates document metadata record in DynamoDB
5. Backend prepares KB-ingest metadata and records ingestion status
6. Document becomes selectable in frontend when ready for retrieval-backed features

### 5.3 Chat with citations and history
1. User selects one or more documents
2. User sends question
3. Backend retrieves relevant chunks from Bedrock KB filtered to authenticated user and selected docs
4. Backend invokes Bedrock model with retrieved context
5. Backend stores chat turn in DynamoDB
6. Frontend renders answer, inline citations, and citation modal showing source excerpt/location
7. On refresh, frontend reloads persisted chat history

### 5.4 Flashcard generation
1. User selects one or more documents and desired card count
2. Frontend calls backend
3. Backend retrieves grounded context from KB using selected docs
4. Backend invokes Bedrock with strict flashcard JSON schema
5. Backend stores generated flashcard set in DynamoDB
6. Frontend renders stored set

### 5.5 Quiz exam generation
1. User selects one or more documents
2. Frontend requests exam generation
3. Backend retrieves grounded context from KB using selected docs
4. Backend invokes Bedrock with strict quiz schema
5. Backend stores reusable quiz record as saved exam in DynamoDB
6. Frontend lists saved exams with source docs and created time

Each generated quiz exam always contains exactly 10 multiple-choice questions.

### 5.6 Battle gameplay
1. User chooses saved exam from exam list
2. Frontend starts or resumes battle session for chosen exam
3. Backend returns battle state plus current boss narration payload
4. User answers with click or keyboard shortcut
5. Backend validates answer using stored quiz answer key
6. Backend updates HP, progress, answer history, and question index in DynamoDB
7. Backend returns outcome narration plus next state
8. Refresh or new session can resume battle from persisted state

## 6. Frontend design

## 6.1 Auth gate
- Replace current unauthenticated app entry with auth gate
- Before login: only show product intro and sign-in button
- After login: load workspace shell

## 6.2 Workspace shell
Workspace becomes document-centered and split into functional panels:
- document library panel
- chat panel
- AI actions panel
- generated exam list panel

### Document library
- show uploaded documents
- support multi-select
- selection becomes active scope for chat, flashcard generation, and quiz generation
- surface ingest status: uploaded, processing, ready, failed

### Chat panel
- show persisted conversation history
- show current selected-doc scope
- render answer with citation chips
- clicking citation chip opens modal with:
  - filename
  - source label such as page/chunk
  - excerpt text returned from retrieval layer

### AI actions panel
- flashcard generation from selected docs
- quiz generation from selected docs
- loading and error states

### Exam list panel
- list saved quizzes as exams
- show source docs and created time
- show play battle action

## 6.3 Battle screen
- load chosen exam from backend
- render boss intro line, question prompt, choices, result narration
- support keyboard shortcuts `A/B/C/D` and `1/2/3/4`
- show persisted progress, HP, and answer history
- allow resume of active session

## 7. Backend API surface

Initial target endpoints:

### Auth/session helper
- `GET /me`
  - returns normalized authenticated user info for frontend bootstrapping

### Documents
- `POST /documents/upload`
- `GET /documents`
- `GET /documents/{docId}`

### Chat
- `GET /chat/messages?docScope=...`
- `POST /chat/messages`

### Flashcards
- `POST /flashcards/generate`
- `GET /flashcards?docIds=...`

### Quizzes / exams
- `POST /quizzes/generate`
- `GET /quizzes`
- `GET /quizzes/{quizId}`

### Battle sessions
- `POST /battle-sessions/start`
- `GET /battle-sessions/{sessionId}`
- `POST /battle-sessions/{sessionId}/answers`

Endpoint naming can shift slightly during planning, but separation of document, chat, quiz, and battle resources should remain.

## 8. Retrieval and citation design

## 8.1 Why Bedrock KB
Project direction is AWS-first from start. Retrieval should use managed AWS retrieval rather than local chunk search.

Benefits:
- aligns with capstone AWS focus
- reduces custom vector logic in app code
- gives built-in retrieval + citation-friendly metadata path
- cleaner story for trainer demo and architecture defense

## 8.2 Retrieval scope
Every retrieval-backed request must constrain results by:
- authenticated `userId`
- selected `docIds`

This means KB ingestion metadata must include enough fields to filter by owner and document identity.

Required metadata per ingested chunk/file:
- `user_id`
- `doc_id`
- `filename`
- optional page/chunk locator fields for citation display

## 8.3 Citation payload contract
Backend should normalize KB retrieval results into frontend-friendly citations:
- `citationId`
- `docId`
- `filename`
- `locator` such as page/chunk label
- `excerpt`
- optional raw score / metadata if useful

Chat responses should include citation references tied to rendered answer. Frontend citation modal reads this normalized payload, not raw Bedrock response shape.

## 9. Bedrock model strategy

Use cheapest model that can reliably satisfy strict JSON contracts and acceptable answer quality in region.

Model usage split:
- chat generation: cheap text model with grounded context
- flashcard generation: same cheap model if JSON compliance acceptable
- quiz generation: same model first; only upgrade if schema reliability or quality fails

Decision rule:
- default to cheapest available model in account/region
- only upgrade after measured failure on JSON quality or answer usefulness

## 10. DynamoDB data design

DynamoDB design must be access-pattern-first and explicitly justified in implementation artifacts.

## 10.1 Why DynamoDB over relational DB for this app
Choose DynamoDB for MVP because:
- dominant access pattern is by authenticated user and resource id, not multi-table joins
- Lambda integration avoids connection pooling and RDS operational overhead
- cost profile is better for intermittent hackathon traffic
- persistence model is event/resource oriented: documents, messages, generated sets, quizzes, battle sessions
- demo reliability improves by avoiding DB connection management under serverless cold/warm starts

Tradeoff accepted:
- more up-front key design work
- denormalization over joins
- some cross-resource reporting is less convenient

These tradeoffs are acceptable for this app because golden path operations are point reads and bounded queries.

## 10.2 Table strategy recommendation
Use focused tables instead of one giant single-table design.

Reasoning:
- team comprehension faster under hackathon time pressure
- lower bug risk when debugging access patterns
- clearer Terraform and IAM boundaries
- easier to explain in demo and evidence pack

Recommended tables:
- `documents`
- `chat_messages`
- `flashcard_sets`
- `quizzes`
- `battle_sessions`

## 10.3 Table designs

### `documents`
Purpose:
- list documents for user
- resolve selected docs
- track KB ingest readiness

Keys:
- PK: `userId`
- SK: `DOC#{docId}`

Attributes:
- `docId`
- `filename`
- `s3Key`
- `contentType`
- `uploadStatus`
- `kbIngestStatus`
- `createdAt`
- optional derived metadata like page count / extracted char count

Why this key shape:
- list user documents with one query
- fetch exact document with PK + SK
- no scan for workspace document library

### `chat_messages`
Purpose:
- load persisted chat history
- optionally scoped by conversation or selected-doc set

Keys:
- PK: `userId`
- SK: `CHAT#{createdAt}#{messageId}`

Attributes:
- `messageId`
- `role`
- `content`
- `docIds`
- `citations`
- `createdAt`

Why this key shape:
- recent-first or chronological history per user is cheap
- no join required to reload chat history
- document scope stored with each message for UX clarity

Consideration during planning:
- if per-conversation threads become required, move to PK `userId#conversationId`

### `flashcard_sets`
Purpose:
- store generated flashcards by user and source selection

Keys:
- PK: `userId`
- SK: `FLASHCARD#{setId}`

Attributes:
- `setId`
- `docIds`
- `cardCount`
- `cards`
- `createdAt`

Why this key shape:
- list all sets for user or fetch exact set without scan
- allows future filter-by-doc in app layer or via secondary index if needed

Potential GSI if needed later:
- GSI1PK `userId`
- GSI1SK `createdAt`

### `quizzes`
Purpose:
- store reusable saved 10-question exams
- list exams available for battle

Keys:
- PK: `userId`
- SK: `QUIZ#{quizId}`

Attributes:
- `quizId`
- `title`
- `docIds`
- `bossPersona`
- `questions`
- `createdAt`

Why this key shape:
- list all exams for user with one query
- fetch exact quiz for battle start
- no scan on golden path

### `battle_sessions`
Purpose:
- resume active playthroughs
- persist answer progression and HP state

Keys:
- PK: `userId`
- SK: `BATTLE#{sessionId}`

Attributes:
- `sessionId`
- `quizId`
- `status`
- `bossHp`
- `userHp`
- `currentQuestionIndex`
- `answerHistory`
- `startedAt`
- `updatedAt`

Why this key shape:
- fetch active/resumable sessions for user cheaply
- update single session atomically
- battle state stays isolated from quiz definition

Potential GSI if needed:
- GSI on `quizId` for analytics or admin lookup, not required for MVP

## 10.4 Query discipline
Golden path must avoid scans.
Required access patterns:
- list user documents
- list user chat history
- list user flashcard sets
- list user quizzes
- get exact quiz
- get exact battle session
- list user active battle sessions

If any planned endpoint requires scan, redesign keys before implementation.

## 11. S3 object design

Uploads bucket only. Keep raw originals private.

Recommended key pattern:
- `users/{userId}/docs/{docId}/original/{filename}`

Benefits:
- easy user scoping
- simple debugging in S3 console
- aligns with KB source metadata generation

## 12. Knowledge Base ingestion design

Because project is AWS-first, ingestion path must be deliberate.

Required behavior:
- upload original file to S3
- generate whatever KB-compatible metadata/sidecar structure is needed for filtering by `user_id` and `doc_id`
- trigger or record ingestion/sync workflow
- reflect readiness status back into `documents` table

Design requirement:
- user cannot rely on retrieval-backed features until selected docs are in `ready` state
- frontend must show this clearly

Planning phase must choose exact KB source/sync strategy based on cheapest viable vector store in region/account.

## 13. Security design

- All API routes except health/session bootstrap protected by JWT validation
- Frontend never sends trusted `userId`; backend derives identity from validated token context
- S3 bucket private, encrypted, no public access
- DynamoDB access limited to specific tables
- Lambda IAM policy limited to exact S3 prefixes/tables/Bedrock actions/KB actions needed
- DB and storage access remain server-side only

## 14. Error handling

Keep MVP-simple, focused on recoverable user states:
- unsupported or empty file upload
- KB ingest pending or failed
- no retrieval results for selected docs
- model generation failure or invalid JSON
- missing quiz or battle session
- expired auth session

Frontend should show clear actionable messages and retry affordances. Avoid deep fallback logic.

## 15. Testing and verification targets

## 15.1 Golden path manual checks
- sign in from fresh browser via Cognito Hosted UI
- upload document and see ready status
- ask grounded chat question and open citation modal
- refresh and confirm chat history persists
- generate flashcards from selected docs
- generate 10-question exam from selected docs
- choose saved exam and play battle
- refresh and resume battle state

## 15.2 Backend tests
- strict schema tests for flashcard generation payload normalization
- strict schema tests for quiz generation payload normalization
- battle state transition tests for correct/wrong answers
- authorization tests ensuring user cannot fetch another user's resources
- DynamoDB key-pattern tests verifying no scan needed for golden path

## 15.3 Frontend verification targets
- selected-doc scope reflected consistently across chat, flashcards, quizzes
- citation modal renders correct source details
- exam list can start battle from chosen saved quiz
- keyboard shortcuts work in battle view

## 16. Delivery decomposition and build order

This scope is large and should be divided into parallel workstreams with subagents, not treated as one undifferentiated implementation pass.

Recommended workstreams:
1. **Platform/IaC workstream**
   - Terraform baseline
   - Cognito Hosted UI
   - API Gateway + Lambda wiring
   - S3, DynamoDB, IAM, KB infrastructure
   - Docker Compose local orchestration
2. **Document ingestion and retrieval workstream**
   - backend scaffold from StudyBot-derived structure
   - upload API
   - documents table design and readiness tracking
   - KB metadata, sync path, citation normalization
3. **Chat and flashcards workstream**
   - chat APIs
   - chat persistence
   - citation modal payload contract
   - flashcard generation and retrieval
4. **Quiz and battle workstream**
   - quiz generation API
   - quizzes table design
   - battle session APIs and transition logic
   - battle session persistence
5. **Frontend integration workstream**
   - auth gate
   - document selection UX
   - chat history UI
   - flashcard and quiz flows
   - exam list and battle screen integration
6. **Verification workstream**
   - contract tests
   - access-pattern validation
   - golden-path manual verification

Recommended dependency-aware order:
1. scaffold `backend/` from StudyBot-derived structure
2. wire Terraform baseline for Cognito, API Gateway, Lambda, S3, DynamoDB, KB, and Docker Compose local orchestration
3. implement auth-aware `/me` and documents upload/list flow
4. implement KB ingest readiness tracking and citation normalization
5. in parallel, implement:
   - chat with citations and persisted history
   - flashcard generation from selected docs
   - quiz exam generation and battle session APIs
6. replace frontend placeholders with backend-driven flows
7. verify full demo path end-to-end

Subagent guidance for later execution:
- Use multiple Sonnet subagents for independent workstreams once shared contracts are fixed.
- Do not parallelize before agreeing on API contracts, DynamoDB keys, and citation payload shape.
- Best split point is after platform contracts, table contracts, and endpoint contracts are written.

## 17. Open implementation decisions for planning phase

These are not unresolved product ambiguities; they are implementation choices to settle during planning:
- exact Terraform module/layout structure
- exact Docker Compose service layout and env injection strategy
- exact Cognito Hosted UI callback/logout URL setup
- exact cheapest viable Bedrock model ID in account/region
- exact cheapest viable Bedrock KB vector backend in account/region
- exact KB sync trigger mechanism and metadata sidecar shape
- whether chat history is single thread per user or explicit conversations
- whether flashcard and quiz records need GSIs beyond MVP
- exact contract freeze point before dispatching parallel subagents for feature work

## 18. Success criteria

MVP is successful when trainer can:
- authenticate via Cognito Hosted UI
- upload real document
- wait for KB-ready status
- ask grounded question and inspect citation modal
- generate flashcards from selected docs
- generate reusable saved 10-question exam from selected docs
- choose saved exam and play battle with persisted state
- refresh and still see persisted app state

This design intentionally favors demo reliability, AWS-native architecture, and low-ops services over maximal feature breadth.