# Feature Proposal: AI-Powered Quiz Boss Battle (Chatbot + Quiz App) on AWS

## 1. Summary
This proposal formalizes an initial concept for an AI-assisted learning experience that turns study material (PDF/slide decks) into an interactive quiz game. Users upload learning content, the system generates quizzes in a strict machine-readable format, and users answer questions in a lightweight “boss battle” UI where correct answers damage the boss and incorrect answers cause the boss to counterattack.

The system is split into two core services:
1) **Chatbot service**: ingestion and quiz generation from uploaded content.
2) **Quiz Application service**: a real-time-feeling quiz game loop (no server session required) that validates answers against pre-generated content stored in DynamoDB.

The intended deployment target is AWS using Terraform, with an architecture emphasizing private networking, least privilege, and avoiding public exposure of resources.

## 2. Problem Statement
Learners often struggle to convert static learning materials (PDFs, slide decks) into active recall practice. Manual quiz creation is time-consuming, and “generic” quizzes may not reflect what the learner actually needs.

We want a workflow that quickly transforms a user’s own materials into targeted quizzes and provides an engaging, game-like loop that encourages completion.

## 3. Goals
- Allow a user to provide learning material (PDF/slide) and generate a quiz from it.
- Ensure quiz output is produced in a predictable **text/JSON format** so it can be stored and validated reliably.
- Allow users to provide additional requirements/prompts to influence quiz generation (e.g., number of questions, difficulty mix, topic focus).
- Provide a simple quiz UI that supports keyboard-only answering (e.g., `a/b/c/d` or `1/2/3/4`).
- Validate answers on the backend using pre-generated “correct and incorrect choices” stored in DynamoDB.
- Avoid maintaining backend server sessions; the client sends `userId`, `quizId`, `questionId`, and the chosen answer.
- Deploy on AWS with:
  - Route 53 → CloudFront → S3 static frontend hosting
  - CloudFront routing to API Gateway
  - API Gateway integrating to Lambda inside a multi-AZ VPC
  - DynamoDB for chat + quiz storage (outside VPC)
  - S3 bucket for vectors (custom KB approach; not using Bedrock Knowledge Base)
- Meet security constraints: no unnecessary public resources, use least-privilege IAM roles and restrictive security groups.

## 4. Non-Goals (Initial Scope)
- Multiplayer synchronization or authoritative real-time combat is not required.
- Persisting a long-lived backend “session” for each user is explicitly not required.
- Building a full-featured authoring UI for quizzes is out of scope for the first iteration.
- Bedrock Knowledge Base managed service is not used (custom vector storage approach).

## 5. Primary Users and Use Cases
Primary users are learners who want to practice quickly from their own materials.

Core use cases:
1) **Generate quiz from content**
   - Input: PDF/slide deck (and optionally additional instructions)
   - Output: quiz definition in a strict format (text/JSON)
2) **Play quiz boss battle**
   - User answers via keyboard
   - Correct → boss loses HP (damage based on difficulty)
   - Incorrect → user loses HP (boss counterattack; damage based on difficulty)

## 6. Proposed User Experience
### 6.1 Chatbot Flow (Quiz Generation)
1) User uploads a PDF/slide deck.
2) System extracts content and (optionally) uses vector retrieval over stored embeddings in S3.
3) User adds extra requirements (e.g., “focus on chapter 2”, “10 questions”, “hard questions only”).
4) System generates quiz content in a strict JSON schema and stores it in DynamoDB.

### 6.2 Quiz App Flow (Boss Battle)
1) User starts/opens a quiz by `quizId`.
2) UI displays:
   - Boss information (fixed boss identity for MVP: **Deep Dark Fantasy**, HP = **1000**)
   - User HP
   - Current question with answer options
   - Difficulty label (easy/medium/hard)
3) User answers using keyboard shortcuts (e.g., `abcd` or `1234`).
4) Frontend sends answer payload: `userId`, `quizId`, `questionId`, `selectedAnswerId` (or selected option).
5) Backend checks DynamoDB for that quiz question’s pre-generated correct answer and wrong answers.
6) Backend returns result (correct/incorrect) + updated HP values.

## 7. Functional Requirements
### 7.1 Quiz Generation (Chatbot Service)
- Accept file uploads for PDFs/slides.
- Generate quizzes in a deterministic structure:
  - Quiz metadata
  - Questions list
  - Each question includes: `questionId`, `difficulty`, `prompt`, `choices[]`, `correctChoiceId`
- Support user-provided generation constraints (free-form text prompt).
- Persist generated quiz content to DynamoDB.

### 7.2 Quiz Gameplay (Quiz Application Service)
- Retrieve quiz content by `quizId`.
- Validate answer submissions against stored quiz content.
- Apply damage rules:
  - Difficulty levels: easy / medium / hard
  - Each difficulty maps to a damage value (boss damage and counterattack damage may be same or configurable).
- Store and update gameplay state (room/state) in DynamoDB:
  - Boss HP
  - Boss image URL (optional)
  - User HP
  - User’s answers for each question
- Do not require server-side sessions; treat each answer request as independent.

## 8. Data Model (DynamoDB)
DynamoDB stores:
- Chat history (if chatbot includes conversational refinement)
- Quiz definitions:
  - Questions, difficulty, correct choice, wrong choices
- Quiz room / game state:
  - Boss health, boss image URL
  - User health
  - Per-question user answers

Note: Exact partition/sort key design is an implementation decision; MVP can start with a small number of tables (or a single-table design) and evolve later.

## 9. AWS Architecture (Target)
### 9.1 High-Level Routing
- **Route 53**: DNS
- **CloudFront**:
  - Serves frontend assets from S3 static hosting bucket
  - Routes API requests to API Gateway
- **S3 (Static FE)**: host frontend
- **API Gateway**: public API entrypoint (behind CloudFront)

### 9.2 Compute & Networking
- **VPC**: Multi-AZ (2 AZ)
- **Private subnets**: contain Lambda ENIs
- **Lambda functions** (inside VPC):
  - Chatbot Lambda → DynamoDB
  - QuizApplication Lambda → DynamoDB
- **VPC Endpoints**:
  - Required endpoints so Lambdas in private subnets can reach AWS services without public internet (e.g., DynamoDB Gateway Endpoint; S3 Gateway Endpoint; plus any needed Interface Endpoints depending on services used)

### 9.3 Storage
- **DynamoDB** (outside VPC; accessed via endpoint):
  - Chat history
  - Quiz content (questions, difficulty, correct/incorrect choices)
  - Quiz room state
- **S3 (Vector storage)**: stores vector data for custom retrieval/knowledge base (not Bedrock Knowledge Base)

## 10. Security and Compliance Requirements
- Avoid publicly exposing resources beyond what is necessary to serve the application.
  - CloudFront and API Gateway are inherently internet-facing, but origin resources (e.g., S3 buckets) should be locked down (e.g., OAC/OAI for S3 origin) and not directly public.
- Use least-privilege IAM roles:
  - Each Lambda role should only have the DynamoDB/S3 permissions it needs.
- Use restrictive security groups and subnets:
  - Lambdas run in private subnets; no direct inbound.
  - Use VPC endpoints instead of NAT/internet egress where possible.

## 11. Tagging Standard
Apply the following tags to all supported resources:
- `Project = W7Capstone`
- `Team = G6`
- `Owner = Hoang`
- `Environment = Hackathon`
- `Application = [service-name]-[function]`

## 12. API Sketch (Conceptual)
The exact API design may evolve, but the MVP should cover:
- `POST /quiz/generate`
  - Inputs: file reference (upload mechanism), user prompt/constraints
  - Output: `quizId`
- `GET /quiz/{quizId}`
  - Output: quiz definition (or a safe subset for the client)
- `POST /quiz/{quizId}/answer`
  - Input: `userId`, `questionId`, `selectedChoice`
  - Output: correctness + updated state (boss HP/user HP) + next question pointer

## 13. Open Questions / Assumptions
The following were not specified in the initial notes and should be confirmed:
- User HP default value and whether it resets per quiz run.
- Damage values per difficulty (easy/medium/hard).
- Boss image URL source and whether boss is always fixed or configurable later.
- Upload mechanism for PDF/slide: direct-to-S3 presigned upload vs API Gateway upload (size limits may push toward presigned).
- Whether quiz questions are served to the client all at once or page-by-page.
- Concurrency expectations (number of users) to inform DynamoDB key design and CloudFront/API limits.

## 14. Milestones (Suggested)
- MVP 1: Quiz generation pipeline stores quiz JSON in DynamoDB; simple FE renders questions.
- MVP 2: Boss battle mechanics (HP tracking, difficulty-based damage).
- MVP 3: Terraform deployment with hardened security posture and tagging.
- MVP 4: Add vector retrieval backed by S3 vector storage.

---
Document status: Draft based on initial notes. Items in “Open Questions / Assumptions” should be confirmed before implementation.
