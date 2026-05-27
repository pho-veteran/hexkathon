# AI-Focused MVP Scope (W7 Capstone) — EduTech Study Buddy + Battle Quiz

Context: This MVP scope prioritizes **AI features end-to-end** (real Bedrock calls, real persistence) while satisfying W7 mandatory capabilities and cost/security constraints. Authentication uses **Amazon Cognito**. It is written for a Product + Engineering audience.

## 0. One-sentence demo goal (Friday 09:00)
Trainer opens HTTPS URL → signs in with Amazon Cognito → uploads PDF/slide → sees AI generate flashcards + boss-fight quiz from document content → starts Battle Quiz → boss asks themed questions and narrates right/wrong explanations → system updates HP + stores attempt → trainer refreshes / new browser session still sees uploaded doc + last quiz attempt.

## 1. W7 constraints we must satisfy (non-negotiable)
From W7 rules/announcement:

- Public HTTPS URL accessible from trainer browser.
- Backend compute handles request + calls AI + reads/writes data.
- AI/ML feature must be **real Bedrock invocation from app** (not console playground).
- Persistence: write state, read back across sessions.
- Object storage: S3 for uploaded files/blobs.
- Network foundation: isolate resources; DB must not be public.
- IAM least privilege required for all services.
- Authentication uses Amazon Cognito and must work from trainer browser during live demo.

Cost / ops constraints:
- Hard cap $100/group (ap-southeast-1). Pre-flight: Budget alert $80 + Cost Anomaly Detection + tagging.
- Avoid NAT Gateway if possible; prefer VPC endpoints.
- Prefer cheapest sufficient Bedrock model for dev; upgrade only if measured.

## 2. Product scope: what MVP MUST do
### 2.1 Upload + Document ingestion (AI input)
MVP must support at least one “non-trivial extraction” document (slide deck with a table/figure caption or scanned page) to align with EduTech challenge expectations.

Acceptance criteria:
- User can upload PDF/slide from frontend.
- File stored in S3 (encrypted; bucket not public).
- Backend stores upload metadata in DynamoDB (userId, docId, filename, createdAt, s3Key).

### 2.2 AI feature #1: Flashcard generation (Bedrock InvokeModel)
Because current frontend already has Flashcard UI entry point, MVP should make this real.

Acceptance criteria:
- User selects uploaded file + number of cards (10/20/full).
- Backend calls Bedrock **InvokeModel** to generate flashcards grounded to extracted doc text.
- Output returned as strict JSON (so FE can render deterministically), e.g.:
  ```json
  {
    "docId": "...",
    "cards": [
      {"id":"1","front":"...","back":"...","source":"slide 3"}
    ]
  }
  ```
- Flashcards persisted in DynamoDB keyed by docId (so refresh still shows same result).

### 2.3 AI feature #2: Boss-fight quiz generation from uploaded doc (RAG-generated + Bedrock InvokeModel)
This is core AI feature for MVP. Battle Quiz must be AI-driven from retrieved document context, not hardcoded QUESTIONS.

Acceptance criteria:
- User triggers “Generate Quiz” from uploaded document.
- Backend retrieves relevant document chunks from stored content/chunks and uses them as grounding context.
- Backend calls Bedrock InvokeModel to generate boss-fight quiz in strict JSON schema:
  - quizId, docId
  - bossPersona: name, tone, introLine
  - questions[]: questionId, difficulty (easy|medium|hard), prompt, choices[], correctChoiceId, bossAskLine, bossCorrectLine, bossWrongLine, source
- Boss voice is themed and consistent, but answer key remains deterministic JSON.
- Store quiz definition in DynamoDB.
- Generated question list is grounded in RAG context from uploaded document, not free-form model recall.
- Generated boss lines explain why answer is right/wrong in-theme after each turn.

Architecture note:
- For MVP speed, “RAG-generated” can mean document chunk retrieval from extracted text/chunk store before InvokeModel. It does not require full Bedrock Knowledge Base if simpler retrieval is more reliable in 48h.

Implementation implication:
- Replace current hardcoded `QUESTIONS` array in frontend BattleCard with API-provided quiz payload.
- Battle UI should display boss narration before/after each answer.

### 2.4 AI feature #3: Chat refinement over uploaded content (RAG-lite)
Frontend currently has chat box but uses dummy response. MVP must replace with real AI.

Given time and W7 grading emphasis, MVP can implement “RAG-lite” without Bedrock KB/Agents by:
- extracting text from uploaded PDF/slide
- selecting top relevant chunks (simple keyword overlap / naive retrieval) OR embedding retrieval
- injecting context into prompt

Acceptance criteria:
- User asks question in chat.
- Backend uses doc content as context and calls Bedrock InvokeModel.
- Response shown in UI.
- Persist chat messages in DynamoDB and reload on refresh.

Notes:
- If team already has Bedrock Knowledge Base implementation available and stable, we can swap RAG-lite with KB retrieve+generate later. MVP requirement is “AI works end-to-end”, not “must use KB”.

### 2.5 Authentication: strict AWS Cognito
Authentication is now mandatory for MVP direction.

Acceptance criteria:
- Users sign in through Amazon Cognito.
- Frontend receives Cognito session/token and includes it in protected API calls.
- Backend authorizes requests using Cognito-backed API protection.
- Uploaded documents, chat history, quizzes, and battle attempts are scoped by authenticated user identity.
- Trainer can log in with a prepared test account during demo from a fresh browser session.

### 2.6 Battle Quiz uses AI-generated quiz (not hardcoded)
BattleCard.jsx currently hardcodes QUESTIONS. MVP must drive gameplay from quiz stored in DynamoDB.

Acceptance criteria:
- Start Battle picks a quizId generated from uploaded doc.
- Battle loads questions from backend API.
- User answers via keyboard shortcuts supported by FE (`A/B/C/D` and/or `1/2/3/4`).
- Backend validates answer against DynamoDB (no server session required).
- Backend updates and persists “quiz room” state:
  - bossHp (fixed boss identity OK for MVP)
  - userHp
  - per-question answer history
- Refresh / new browser session still sees the prior quiz attempt state.
- Boss asks each question in themed voice and explains outcome after each turn.
- Quiz room and quiz retrieval are scoped to authenticated Cognito user.

## 3. What MVP explicitly does NOT need (cut list)
To keep AI-focused MVP shippable under 48h:

- No auth work beyond Cognito sign-in needed for demo (skip password reset, skip email verification UX during demo).
- No perfect UI polish. W7 does not grade UI.
- No multiplayer / real-time sync.
- No advanced error handling beyond logging.
- No OpenSearch Serverless (large fixed cost). Prefer DynamoDB + S3 + (optional) embeddings.

## 4. Proposed architecture (meets W7 mandatory capabilities)
### 4.1 Edge / UI
- CloudFront (HTTPS) + S3 static hosting for frontend.
- CloudFront routes `/api/*` to API Gateway.

### 4.2 Compute
- API Gateway HTTP API → Lambda.

### 4.3 AI/ML
- Bedrock InvokeModel for:
  - flashcard generation
  - quiz generation
  - chat answers
- Prefer cheaper model in dev (e.g., Haiku / Llama / Titan) and measure quality vs cost.

### 4.4 Persistence
- DynamoDB tables (or single-table design) for:
  - documents metadata
  - flashcards
  - quizzes
  - quiz room state
  - chat history

### 4.5 Object storage
- S3 buckets:
  - uploads bucket (PDF/slide)
  - optional “vector/chunks” bucket if doing embeddings

### 4.6 Network foundation
- VPC with private subnets for Lambda ENIs.
- VPC endpoints:
  - S3 Gateway endpoint (free)
  - DynamoDB Gateway endpoint (free)
  - Bedrock Interface endpoint (cost ~ $0.62 for 48h per endpoint/AZ)
- Avoid NAT Gateway unless absolutely necessary.

### 4.7 Identity & Access
- Least-privilege IAM roles:
  - Lambda execution role scoped to specific DynamoDB tables + S3 prefixes + Bedrock InvokeModel.
- Amazon Cognito is required for user authentication.
- API protection should validate Cognito-issued identity so data access is user-scoped.
- Prepare one stable demo account for trainer login.

## 5. AI acceptance tests (what “AI must work” means)
For each AI feature, define one deterministic “demo script” input and expected output shape.

Minimum test cases:
- Upload test PDF (in repo under `docs/sample_input/`).
- Generate 10 flashcards → returns valid JSON with 10 cards.
- Generate quiz → returns valid JSON with at least 10 questions + difficulty distribution.
- Chat question: “Tóm tắt 5 ý chính của tài liệu” → response includes doc-grounded points.

## 6. Cost safety notes (align with W7 cost doc)
From W7_cost_estimates.md:
- Avoid NAT Gateway (fixed hourly + per-GB).
- Avoid OpenSearch Serverless unless forced (minimum 2 OCU ~ $27.65/48h).
- Bedrock Interface endpoint cost is predictable (~$0.62/48h per endpoint).

MVP should stay far under $30 if we keep infrastructure lean and use cheap models in dev.

## 7. Frontend alignment notes (current code reality)
Current FE (hexkathon/frontend):
- Workspace has chat UI + file picker + “Generate Flashcards” button, but AI responses are dummy and uploaded files are names only.
- BattleCard has hardcoded QUESTIONS array and local-only state.

Frontend rule:
- Frontend may be modified freely as needed to satisfy MVP scope, Cognito authentication flow, boss-fight quiz flow, and W7 demo constraints.
- Existing component structure is not fixed. Renaming, restructuring, adding screens, removing placeholder UI, and changing user flow are all allowed if they improve MVP reliability.
- Priority is demo success and AI end-to-end behavior, not preserving current UI structure.

MVP FE changes required (must):
- Add Cognito sign-in/sign-out flow and protected app state.
- Upload actual file to backend/S3 (not only store filename in React state).
- Replace dummy chat response with backend call.
- Replace Flashcard placeholder with backend-driven cards.
- Replace BattleCard QUESTIONS with backend-driven quiz questions + submit answer API.
- Add boss narration UI for question intro + right/wrong explanation.
- Scope displayed user data to authenticated Cognito user.

Architecture note:
- If current frontend slows delivery, team may simplify UI aggressively. A smaller but working flow is better than preserving unused screens.

Demo rule:
- Frontend is successful if trainer can sign in, upload file, trigger AI outputs, start battle, answer questions, and observe persisted state from a clean browser session.

## 8. Frontend modification policy
- Frontend changes are explicitly in scope.
- Team is free to modify frontend code, interaction flow, page structure, and component boundaries to match this plan.
- Do not treat current frontend as contract; treat it as starting point only.
- Preserve only what helps demo path; cut or rewrite anything that blocks MVP.

## 9. Architecture addendum for this direction
- Cognito login becomes entry step before document access.
- Quiz list and battle state must be fetched per authenticated user.
- Boss-theme content comes from backend AI payload, not frontend hardcoded copy.
- Frontend should remain thin: backend owns quiz generation, answer validation, and persistence logic.

## 10. Milestone checklist (AI-first ordering)
Recommended build order to keep MVP AI-focused:

1) File upload → S3 + DynamoDB metadata (unblocks everything).
2) Quiz generation (InvokeModel) → store quiz JSON.
3) Battle loads quiz questions from API and validates answers.
4) Flashcard generation → render.
5) Chat with doc context → render + persist.
6) Only then polish IaC / CloudFront routing / tagging, etc.

---
Status: MVP scope updated for Cognito + boss-fight quiz + flexible frontend policy.

Next step: frontend can be changed freely; if you want, I can now convert this into exact component-level edits for `Workspace.jsx`, `BattleCard.jsx`, and auth screens.
