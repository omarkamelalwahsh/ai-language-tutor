# AI Language Tutor - Full Project Documentation

## 1. Executive Summary

AI Language Tutor is a full-stack English learning platform that combines:

- A React + Vite frontend for onboarding, diagnostic assessment, dashboards, practice sessions, admin panels, and learner progress views.
- A FastAPI backend for authenticated APIs, adaptive task generation, assessment evaluation, learner profile updates, journey execution, notifications, and tutor chat.
- Supabase for authentication, PostgreSQL persistence, Row Level Security, team/admin data, and an Edge Function for deep assessment analysis.
- Groq and xAI/Grok-style LLM integrations for task generation, open-ended evaluation, final diagnostic reports, and tutor conversations.
- A CEFR-aligned learning model that tracks skill states, errors, XP, streaks, journey nodes, and daily/targeted practice.

The system is not just a quiz app. It is designed as a pedagogical engine:

1. The learner signs in and completes onboarding.
2. The diagnostic engine builds and runs a fixed-length adaptive assessment.
3. Responses are scored through deterministic checks for objective tasks and AI evaluation for open-ended tasks.
4. The app persists responses, skill states, learner profile metrics, and error intelligence.
5. A personalized learning journey is generated.
6. Daily practice and targeted skill practice use the learner profile, weak skills, recent mistakes, journey node, CEFR level, and domain interests to generate new tasks.
7. Session results update skill states, XP, streaks, journey progress, and error profiles.

## 2. Repository Structure

```text
.
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |-- core/
|   |   |-- db/
|   |   |-- integrations/
|   |   |-- models/
|   |   |-- schemas/
|   |   |-- services/
|   |   `-- main.py
|   |-- alembic/
|   |-- data/
|   |-- question_banks/
|   |-- scripts/
|   |-- scratch/
|   `-- tests/
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |-- config/
|   |   |-- constants/
|   |   |-- context/
|   |   |-- data/
|   |   |-- engine/
|   |   |-- hooks/
|   |   |-- lib/
|   |   |-- services/
|   |   |-- tests/
|   |   |-- types/
|   |   |-- views/
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- scripts/
|   `-- public/
|-- supabase/
|   |-- functions/
|   `-- migrations/
|-- tools/
|-- scratch/
|-- package.json
`-- README.md
```

Main production areas:

- `backend/app/main.py`: FastAPI app entrypoint and route registration.
- `backend/app/models/domain.py`: SQLAlchemy domain model definitions.
- `backend/app/services/`: business logic for assessments, journeys, sessions, learners, daily bites, notifications, pedagogy, task generation, and profile aggregation.
- `backend/app/integrations/groq_client.py`: LLM model routing, prompts, JSON generation, and scoring calls.
- `frontend/src/App.tsx`: React routing and high-level orchestration.
- `frontend/src/context/DataContext.tsx`: auth-aware global app state.
- `frontend/src/services/`: frontend API clients and persistence orchestration.
- `frontend/src/engine/`: assessment, scoring, CEFR, selector, evidence, and learner-model logic.
- `supabase/migrations/`: database schema, RLS policies, RBAC/admin setup, invite functions, and profile hardening.
- `supabase/functions/analyze-assessment/`: Edge Function for deep diagnostic analysis and persistence.

Non-production/helper areas:

- `backend/scratch/`, `frontend/archives/scratch/`, root `scratch/`: inspection, repair, migration, and debugging scripts.
- `backend/question_banks/`, `frontend/src/data/banks/`: question bank data by CEFR level.

## 3. Technology Stack

### Frontend

- React 19
- Vite 6
- TypeScript
- React Router 7
- TanStack Query
- Supabase JS
- Firebase optional push notification support
- Motion for animation
- Tailwind CSS v4 tooling
- Vitest for frontend tests

### Backend

- Python 3.11+
- FastAPI
- Uvicorn
- SQLAlchemy async ORM
- PostgreSQL/Supabase
- Alembic migrations
- PyJWT with Supabase HS256 and ES256/JWKS validation
- Groq Python SDK
- Pydantic Settings

### Database and Auth

- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- Supabase Edge Functions
- Public tables for learner profiles, profiles/RBAC, skill states, assessments, logs, journeys, invites, notifications, and curriculum data.

## 4. Running the Project

Root-level scripts in `package.json`:

```bash
npm install
npm run install:all
npm run dev
```

What those scripts do:

- `npm run dev:frontend`: starts Vite in `frontend` on port `3000`.
- `npm run dev:backend`: starts FastAPI with `uvicorn app.main:app --reload`.
- `npm run dev`: runs frontend and backend concurrently.
- `npm run install:all`: installs frontend npm dependencies and backend Python requirements.

Frontend scripts:

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run test
```

Backend run command:

```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
venv\Scripts\python -m uvicorn app.main:app --reload
```

## 5. Environment Configuration

### Backend Settings

`backend/app/core/config.py` loads configuration from `.env` using Pydantic Settings.

Important backend variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `SUPABASE_JWT_SECRET`: legacy Supabase HS256 JWT validation secret.
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key for privileged server operations.
- `GROQ_API_KEY`: primary Groq key.
- `GROQ_TASK_ENGINE_API_KEY`: optional dedicated task-generation Groq key.
- `BACKEND_CORS_ORIGINS`: allowed frontend origins.

The backend converts `postgresql://` or `postgres://` into `postgresql+asyncpg://` for async SQLAlchemy.

### Frontend Settings

Important frontend variables:

- `VITE_API_URL`: backend base URL, for example `http://localhost:8000`.
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key.
- `VITE_FIREBASE_*`: optional Firebase notification config.
- `APP_URL`: frontend app URL.

## 6. Backend Architecture

### FastAPI Entrypoint

`backend/app/main.py` creates the FastAPI app, configures CORS, registers a global exception handler, exposes `/health`, and mounts all API routers under `settings.API_V1_STR`, which defaults to `/api/v1`.

Registered route groups include:

- `/api/v1/auth`
- `/api/v1/assessments`
- `/api/v1/chat`
- `/api/v1/questions`
- `/api/v1/leaderboard`
- `/api/v1/learner`
- `/api/v1/audit-logs`
- `/api/v1/invites`
- `/api/v1/tasks`
- `/api/v1/analytics`
- `/api/v1/practice`
- `/api/v1/daily`
- `/api/v1/notifications`
- `/api/v1/tutor`
- Journey execution routes such as `/api/v1/journey/initialize` and `/api/v1/tasks/{task_id}/submit`

### Authentication

`backend/app/api/deps.py` validates Supabase JWTs.

It supports two validation modes:

- ES256 tokens through Supabase JWKS at `/auth/v1/.well-known/jwks.json`.
- HS256 legacy tokens through `SUPABASE_JWT_SECRET`.

The dependency returns either:

- Full JWT payload through `get_current_user_payload`.
- User ID through `get_current_user_id`.
- A self-healed unified learner profile through `get_unified_profile`.

### Database Layer

`backend/app/db/database.py` creates:

- Async SQLAlchemy engine.
- `AsyncSessionLocal`.
- Declarative `Base`.
- `get_db()` dependency.

All main services use `AsyncSession` for database reads and writes.

## 7. Backend Domain Model

The main SQLAlchemy models live in `backend/app/models/domain.py`.

### Learner and Auth Models

- `User`: read-only mapping to `auth.users`.
- `LearnerProfile`: student learning profile, onboarding state, XP, CEFR level, confidence, streaks, notification settings, pacing, accuracy, response-time metrics, goals, topics, and personalization fields.
- `Profile`: public RBAC profile with `role`, `team_id`, email, full name, avatar, and last seen timestamp.

### Assessment Models

- `QuestionBankItem`: question/task bank item with skill, task type, response mode, level, difficulty, prompt, stimulus, options, answer key, and rubric.
- `Assessment`: parent assessment session with status, current index, total questions, metadata, timestamps, and child responses.
- `AssessmentResponse`: normalized per-question response with score, correctness, answer level, difficulty, raw evaluation, explanation, skill, category, response time, and status.
- `AssessmentLog`: flatter event log used for dashboards, trends, session analytics, and historical context.

### Error Intelligence

- `UserErrorProfile`: cumulative learner error profile, weakness areas, common mistakes, bridge progress, action plan, and full AI report.
- `UserErrorAnalysis`: per-question/per-error analysis with interpretation, answer comparison, category, and deep insight.
- `ErrorProfile`: newer invisible-judge style error record for journey task failures and unresolved errors.

### Skill and Progress Models

- `UserSkill` mapped to `skill_states`: per-skill CEFR state, current score, XP, proficiency level, confidence, stability buffer, category, CQ score, and timestamps.
- `UserAchievement`: badges.
- `UserNotificationLog`: notification history.
- `UserVocabularyLog`: vocabulary exposure deduplication.
- `UserVocabularyState`: recognized/activated vocabulary state.
- `WeeklyVocabulary`: weekly advanced/basic vocabulary pair schedule.

### Journey Models

There are two journey architectures in the codebase.

Legacy/current frontend journey:

- `LearningJourney`: user journey row with JSON nodes, current node, and metadata.
- `JourneyStep`: ordered journey steps with title, status, skill focus, content payload, completion accuracy, and repair-node flags.

Newer 20-node invisible-judge journey:

- `JourneyMap`: active journey map with total nodes and current index.
- `JourneyNode`: node with target Can-Do statement, node type, lock status, and tasks.
- `JourneyTask`: task inside a journey node with skill type, status, task index, and alternative attempts.

### Curriculum Models

The CEFR master curriculum is normalized into:

- `CurriculumStage`
- `CurriculumModule`
- `CanDoOutcome`
- `GrammarTag`
- `FunctionTag`
- `VocabularyDomainTag`
- `PromotionGate`

These tables support authentic CEFR Can-Do outcomes and curriculum-driven journey nodes.

## 8. Backend Services and Logic

### Profile Aggregation

`ProfileAggregator` merges learner information from several sources:

- Legacy assessment responses/logs.
- `skill_states`.
- `learner_profiles`.
- Recent errors.

This is used before generating tasks so the AI has a coherent view of:

- Current CEFR level.
- Weak and strong skills.
- Learning domain and interests.
- Target goal.
- Recent errors.
- Historical performance.

### Assessment Service

`backend/app/services/assessment_service.py` handles server-side assessment flow:

1. Start an assessment session.
2. Fetch the latest in-progress assessment.
3. Evaluate responses through the dynamic evaluator.
4. Sync evaluation results into profile, skill state, error profile, assessment responses, and logs.
5. Complete an assessment and calculate final skill levels.

Important logic:

- Accuracy is updated as a weighted moving average.
- Practice tasks can grant XP.
- Incorrect answers update `user_error_profiles` and create `user_error_analysis`.
- Skill confidence increases when scores are strong.
- CQ/idiom dimensions can update `cq_score` and `cq_confidence`.

### Task Generator

`backend/app/services/task_generator.py` generates personalized single tasks.

Core behavior:

1. Fetch unified learner profile.
2. Normalize requested skill and level.
3. Extract bridge-level hints from journey node text such as `Bridge A1->B2`.
4. Extract Can-Do outcome text from node context.
5. Avoid recently exposed vocabulary.
6. Adjust difficulty based on recent performance.
7. Build domain-specific user context.
8. Add cultural intelligence/idiom instructions for relevant tasks.
9. Call the Groq task architect.
10. Validate the response shape.
11. Return a contextual fallback if AI generation fails.

The fallback is not random. It adapts to the requested skill, CEFR level, domain, and Can-Do target so the UI can keep working even during model/provider failure.

### Session Manager

`backend/app/services/session_manager.py` is the main runtime practice orchestrator.

#### Smart Daily Mix

`build_daily_mix()` creates a 5-task batch:

- 2 review tasks targeting weakest skills.
- 2 journey tasks anchored to the active journey node.
- 1 maintenance task targeting a strong skill at higher difficulty.

The plan uses:

- Learner's unified profile.
- Weakness ranking.
- Strength ranking.
- Active journey focus.
- Recent errors.
- Per-skill CEFR level lock.
- Adapted difficulty from recent performance.

The preferred path is one LLM batch call. If that fails or returns invalid slots, the service falls back to per-slot generation. Journey slots are strictly rebuilt with locked metadata to avoid AI drift.

#### Targeted Skill Practice

`build_skill_practice()` creates a 5-task ladder for one skill.

Logic:

- Prefer the learner's per-skill level over overall level.
- Anchor difficulty slightly above the current skill level.
- If a task type is requested, try fetching matching DB question bank items first.
- If DB content is insufficient, call the AI batch generator.
- Filter hallucinated or pedagogically weak tasks, such as image vocabulary for high-level learners or trivial vocabulary for C1/C2.
- Fall back to per-slot task generation if needed.

#### Session Completion

`process_session_results()` closes the feedback loop:

- Aggregates results per skill.
- Updates `skill_states`.
- Updates learner profile metrics, XP, streaks, and logs.
- Merges new and solved errors into `user_error_profiles`.
- Advances journey steps if accuracy passes the threshold.

Journey advancement requires at least 60% session accuracy. It marks the current step completed, unlocks the next step, and can trigger gateway/level-up logic through `PedagogyService`.

### Journey Service

`backend/app/services/journey_service.py` implements the newer 20-node journey architecture.

#### Get or Create Journey

`get_or_create_journey()`:

1. Finds the active `JourneyMap`.
2. Initializes one if missing.
3. Loads nodes and tasks.
4. Formats them for the frontend.
5. Computes node status from lock state and completed tasks.

#### Catch-Up Chain Injection

`initialize_catchup_chain()`:

1. Reads the learner profile and current proficiency level.
2. Reads core skill states for reading, writing, listening, and speaking.
3. Detects weak skills below 70%.
4. Allocates up to 4 catch-up nodes based on weakness count and severity.
5. Creates a 20-node map.
6. Prepends catch-up nodes when needed.
7. Creates core nodes from CEFR curriculum modules.
8. Creates 10 tasks per node.

Core node task distribution:

- 2 listening
- 2 reading
- 2 writing
- 2 speaking
- 2 integrated capstones

#### Task Submission

`submit_task_evaluation()` handles journey task execution:

- Marks successful tasks completed.
- Logs errors and creates alternative tasks after repeated failure.
- Promotes vocabulary from recognized to activated when constrained words are used.
- Unlocks the next task or next node.

#### Graduation

`check_graduation()` blocks graduation if unresolved errors remain. If clean, it marks the map complete and promotes the learner to the next CEFR level.

### Pedagogy Service

`PedagogyService` supports:

- XP reward calculation.
- Streak updates.
- Gateway unlock checks.
- Level-up logic.
- Smart hints for error types.

The general design separates XP progression from CEFR proficiency. This matters because a learner can train consistently without automatically being promoted unless evidence supports it.

### Daily Service

`DailyService` supports:

- Daily bites.
- Daily word.
- Weekly vocabulary cycles.
- Bite completion records.

It can generate new daily content, ensure weekly batches exist, and record completion by date and bite type.

### Notification Service

`NotificationService` supports:

- FCM token updates.
- Notification log retrieval.
- Mark-as-read.
- Reminder type decisions based on learner activity.

Firebase is optional. If Firebase env values are placeholders or missing, notification registration should be treated as disabled.

### Tutor and Chat

The backend includes:

- A chat proxy route.
- A tutor route with chat history persistence.
- User context injection so tutor responses can reference learner level, skills, and progress.

`ChatHistory` stores assistant/user messages for continuity.

## 9. LLM Architecture

LLM integration lives mainly in `backend/app/integrations/groq_client.py`.

### Model Routing

The code defines:

- `MODEL_FAST = llama-3.1-8b-instant`: fast objective scoring.
- `MODEL_DEEP = llama-3.3-70b-versatile`: open-ended evaluation, audits, and deeper analysis.
- `MODEL_TASK = llama-3.3-70b-versatile`: task-generation engine.

Two clients are configured:

- Primary Groq client from `GROQ_API_KEY`.
- Dedicated task client from `GROQ_TASK_ENGINE_API_KEY`, falling back to `GROQ_API_KEY`.

### Evaluation Modes

Objective tasks:

- MCQ, reading comprehension, listening detail, fill-in tasks.
- Expected answer is used.
- Model is fast unless caller uses deterministic frontend logic.

Open-ended tasks:

- Writing and speaking.
- No single correct answer.
- Evaluation is based on CEFR linguistic quality, task completion, grammar, vocabulary, coherence, and evidence in the response.
- Productive skills are protected from "collapse" rules that would incorrectly downgrade sophisticated short responses.

### Dynamic Task Generation

The task architect prompt enforces:

- Requested skill modality.
- CEFR level constraints.
- Domain personalization.
- Can-Do outcome alignment.
- No repeated recent vocabulary.
- Cultural intelligence/idiom injection when appropriate.
- Strict JSON schema.

The system explicitly guards against returning reading tasks for speaking slots or basic content for advanced learners.

### Dynamic Evaluation

The dynamic evaluator grades one learner response against one generated task.

It returns:

- `score`
- `is_correct`
- `evaluation_mode`
- `detected_level`
- `cefr_match`
- `cando_met`
- `detailed_feedback`
- `reasoning_summary`
- grammar/vocabulary/coherence/fluency/pronunciation/CQ dimensions
- error analysis

Feedback is intended to be Socratic: praise first, then guide the learner toward self-correction.

## 10. Frontend Architecture

### App Entrypoint

`frontend/src/main.tsx`:

- Creates a TanStack Query client.
- Wraps the app in `QueryClientProvider`.
- Renders React in `StrictMode`.

Default query behavior:

- 30 second stale time.
- 5 minute garbage collection.
- No refetch on window focus.
- One retry.

### App Routing

`frontend/src/App.tsx` defines all main routes.

Important routes:

- `/`: landing page.
- `/auth` and `/register`: authentication.
- `/portal`: role-based redirect.
- `/onboarding`: learner onboarding.
- `/diagnostic/intro`: diagnostic introduction.
- `/diagnostic`: diagnostic assessment runtime.
- `/diagnostic/results`: result analysis.
- `/dashboard/*`: main learner dashboard.
- `/journey`: learning journey.
- `/review/:sessionId`: assessment review.
- `/leaderboard`: user leaderboard.
- `/runtime`: shared runtime.
- `/practice/daily-mix`: smart daily mix runtime.
- `/practice/skill/:skill`: targeted skill practice.
- `/admin`: team/admin dashboard for role 1 or 2.
- `/super-admin`: super admin dashboard for role 2.
- `/invite/:token`: team invite acceptance.

### Route Protection Logic

`ProtectedRoute`:

- Shows a loader while initializing.
- Redirects unauthenticated users to `/auth`.
- Redirects new users to onboarding/diagnostic as needed.
- Prevents users who completed onboarding/assessment from going back to diagnostic unless reset mode is used.

`PublicRoute`:

- Redirects signed-in users to the right next step.
- Allows invite-token flow to continue.

`RoleProtectedRoute` and `RoleBasedRedirect` use the `profiles.role` value:

- `0`: student
- `1`: admin
- `2`: super admin

### Data Context

`frontend/src/context/DataContext.tsx` owns global app state:

- Supabase auth user.
- Merged profile.
- Assessment result.
- Assessment outcome.
- Task evaluations.
- Onboarding state.
- Proficiency data.
- Error profile.
- Initialization and journey-architecting flags.

Initialization flow:

1. Load local assessment/onboarding state from localStorage.
2. Read Supabase session.
3. Cache token and user ID.
4. Fetch RBAC profile from `profiles`.
5. Fetch learner profile from `learner_profiles`.
6. Fetch skill state and error profile.
7. Merge learner and RBAC profile.
8. Treat admins and super admins as onboarded.
9. Bump `last_seen_at`.
10. Subscribe to auth state changes.

It includes a safety timeout so the UI does not stay in an initializing state forever.

### Diagnostic Save Orchestration

When diagnostic assessment finishes, `App.tsx` runs `handleAssessmentSave()`:

1. Compute the local academic result immediately.
2. Store result, outcome, and evaluations in context/localStorage.
3. Navigate to `/diagnostic/results` immediately.
4. Start a background worker.
5. Warm up auth.
6. Run remote deep analysis through Supabase Edge Function if available.
7. Save comprehensive assessment data.
8. Only after backend persistence succeeds, set completion flags locally and in profile.
9. Refresh data from DB.
10. Generate and persist a dynamic journey in the background.

This design prioritizes fast UX while avoiding a dangerous state where the UI marks the diagnostic completed before persistence succeeds.

## 11. Frontend Assessment Engine

### AdaptiveAssessmentEngine

`frontend/src/services/AdaptiveAssessmentEngine.ts` implements the major diagnostic flow.

Documented design:

- Fixed-length 40-question assessment.
- Block order:
  - Reading + Grammar: 15
  - Writing: 5
  - Listening: 15
  - Speaking: 5
- Skill quotas:
  - Reading: 8
  - Grammar: 7
  - Listening: 15
  - Writing: 5
  - Speaking: 5
- Weighted scoring by CEFR difficulty.

Runtime behavior:

1. The engine creates a UUID assessment ID.
2. It recovers local assessment state from `localStorage`.
3. It can recover remote state from the latest assessment metadata.
4. If no state exists, it fetches a new battery through `BatterySelector`.
5. It creates a remote assessment session and syncs state.
6. It returns one question at a time.
7. MCQ tasks are checked deterministically.
8. Typed/audio/open-ended tasks are evaluated by AI.
9. Each answer is logged to Supabase immediately when possible.
10. If user ID is delayed, previous answers are retroactively synced.
11. At block boundaries, intermediate skill states can be synced.
12. Final outcome is computed from weighted skill scores.

### Scoring Logic

Each answer contributes:

```text
earned += evaluation.score * difficulty
total += difficulty
```

The outcome computes:

- Overall weighted percentage.
- Overall CEFR band through `CEFREngine.mapPercentageToLevel`.
- Per-skill score and band.
- Evidence-weighted confidence per skill.
- Accuracy rate.
- Average response time.
- Pacing score against a 45-second benchmark.
- Speaking audit metadata.

### MCQ vs AI Evaluation

The engine uses `response_mode` as the main discriminator:

- `mcq`: deterministic answer-key comparison.
- `typed`: AI evaluation.
- `audio`: AI evaluation.

If an MCQ task is missing options, the engine falls back to AI evaluation.

### Persistence and Recovery

The engine stores state in:

```text
asmt_state_<userId>
```

Remote state is stored in `assessments.evaluation_metadata`.

This enables:

- Page-refresh recovery.
- Cross-device recovery.
- Resume from latest in-progress assessment.
- Background syncing of answered questions.

## 12. Frontend Assessment Pipeline v2

`frontend/src/engine/assessment-v2/pipeline.ts` defines a newer deterministic evidence pipeline.

It is organized into nine layers:

1. Resolve task type from legacy question type.
2. Parse linguistic signals from LLM output or heuristics.
3. Normalize signals.
4. Attribute evidence to skills.
5. Aggregate skill evidence.
6. Make CEFR decisions.
7. Apply confidence calibration.
8. Guard authenticity per item.
9. Build the final report.

The pipeline is stateful in that it accumulates evidence, but the scoring and decision logic are designed as deterministic, testable functions.

This engine is useful for:

- Reducing over-reliance on raw LLM labels.
- Combining direct and indirect evidence.
- Applying authenticity checks.
- Producing explainable CEFR reports.

## 13. Frontend Services

### AssessmentSaveService

`frontend/src/services/AssessmentSaveService.ts` is the main assessment persistence orchestrator.

Important responsibilities:

- Warm up auth and token cache.
- Check system integrity before assessment.
- Create/anchor assessment sessions.
- Log each answer to `assessment_responses` and `assessment_logs`.
- Buffer failed logs in localStorage.
- Sync pending logs later.
- Lower question reliability for detected bad question-bank items.
- Save remote assessment state.
- Recover latest assessment state.
- Save comprehensive final diagnostic data.
- Merge historical weaknesses and action plans.
- Trigger remote deep analysis Edge Function.
- Update skill states.
- Update journey step status.
- Finalize full diagnostic.

The service uses a defensive "never break UI" approach for individual answer logging. Per-question logging failures are swallowed or buffered, while final comprehensive save is treated as critical.

### Session Service

`frontend/src/services/sessionService.ts` calls backend `/api/v1/tasks` endpoints:

- `buildDailyMix()`
- `buildSkillPractice(skill, count)`
- `submitSessionResults(payload)`
- `evaluateTask(payload)`
- `syncTaskResult(result)`

It attaches the Supabase bearer token to requests.

### Journey Service

`frontend/src/services/JourneyService.ts` builds and persists legacy-style dynamic journeys after diagnostic completion.

It:

- Determines current and target CEFR bands.
- Identifies gaps from assessment results.
- Calls inference gateway to generate journey nodes.
- Normalizes skills.
- Maps node types.
- Persists a `learning_journeys` row and `journey_steps`.

### Speech and Audio Services

The frontend includes:

- `SpeechToTextService`: sends audio to backend `/api/v1/transcribe`.
- `AudioRecordingService`: handles recording.
- `AudioValidator`: validates audio submissions.
- `useWebSpeech`: browser speech integration hook.

### Admin and Dashboard Services

Admin services interact mostly with Supabase:

- `AdminService`
- `SuperAdminService`
- `InviteService`
- `AuditService`
- `DashboardService`

They support teams, invites, role-aware dashboards, audit logs, and learner summaries.

## 14. Supabase Architecture

### Migrations

The migration folder includes schema and RLS work for:

- Assessment tables and responses.
- Assessment results.
- User error profiles and error analysis.
- Pedagogical engine tables.
- JWT claims hook.
- Learner/profile RLS fixes.
- Root admin/team schema.
- Team invite functions and policies.
- Audit logs.
- Single-organization admin scoping.

### Row Level Security

RLS policies generally enforce:

- Users can read/write their own learner data.
- Super admins can read or modify broader organization data.
- Team admins can read scoped team data.
- Role changes and root admin operations are protected by functions/triggers.
- Invites can be peeked publicly but consumed by authenticated users.

### JWT Claims Hook

`jwt_claims_hook.sql` defines a custom access token hook so Supabase Auth tokens can include role/team data for RBAC.

### Invite Functions

The migrations define:

- `peek_team_invite(token)`: inspect an invite before accepting.
- `consume_team_invite(token)`: assign the user to the invited team/role.

## 15. Supabase Edge Function

`supabase/functions/analyze-assessment/index.ts` implements a deep diagnostic pipeline.

Flow:

1. Accept `user_id` and `user_answers`.
2. Use xAI/Grok-style API key from `GROK_API_KEY`.
3. Call a scorer model to evaluate raw answers.
4. Call a pedagogical expert model to produce a structured final diagnostic state.
5. Use Supabase service role to write:
   - `learner_profiles`
   - `skill_states`
   - `user_error_profiles`
   - `learning_journeys`
   - `journey_steps`
   - `user_error_analysis`
6. Return the final analysis JSON.

Important implementation note:

- The Edge Function uses `GROK_API_KEY` and xAI API endpoints, while the backend uses Groq model clients. Keep these provider names and environment variables aligned during deployment to avoid confusion.

## 16. Main User Flow

### New Learner Flow

1. User lands on `/`.
2. User signs up or signs in through Supabase Auth.
3. `DataContext` fetches profile data.
4. If onboarding is incomplete, `ProtectedRoute` sends user to `/onboarding`.
5. User completes goals, topics, focus skills, language metadata.
6. User goes to `/diagnostic/intro`.
7. User starts `/diagnostic`.
8. `AdaptiveAssessmentEngine` builds or recovers assessment battery.
9. User answers questions.
10. Each answer is scored and logged.
11. Final outcome is computed.
12. UI navigates immediately to `/diagnostic/results`.
13. Background worker runs comprehensive persistence and deep analysis.
14. Learner profile is marked onboarded/completed only after persistence succeeds.
15. Journey is generated.
16. User continues to dashboard.

### Daily Practice Flow

1. User opens `/practice/daily-mix`.
2. Frontend calls `sessionService.buildDailyMix()`.
3. Backend `SessionManager` reads unified profile.
4. Backend creates a 5-slot plan.
5. AI generates tasks or fallbacks are used.
6. User completes tasks.
7. Frontend evaluates open tasks and syncs individual results.
8. Frontend submits session completion.
9. Backend updates skill states, XP, streaks, error profile, logs, and journey progress.

### Targeted Skill Practice Flow

1. User opens `/practice/skill/:skill`.
2. Frontend calls `sessionService.buildSkillPractice(skill)`.
3. Backend uses per-skill CEFR level.
4. DB question bank is used first when task type matches.
5. AI fills missing tasks.
6. Tasks form a progressive 5-step ladder.
7. Completion updates the same learner state loop.

### Admin Flow

1. User signs in.
2. `/portal` reads `profiles.role`.
3. Role `1` goes to `/admin`.
4. Role `2` goes to `/super-admin`.
5. Admin routes are guarded by `RoleProtectedRoute`.
6. Team invites, team summaries, leaderboard, and audit logs are managed through Supabase-backed services.

## 17. Data Flow Summary

### Diagnostic Data Flow

```text
Frontend DiagnosticView
  -> AdaptiveAssessmentEngine
    -> BatterySelector / question_bank_items
    -> deterministic MCQ scoring or GroqScoringService
    -> AssessmentSaveService.log_and_update_assessment
      -> assessment_responses
      -> assessment_logs
  -> AssessmentAnalysisService local result
  -> ResultAnalysisView
  -> background AssessmentSaveService.saveAssessmentComprehensive
    -> learner_profiles
    -> skill_states
    -> user_error_profiles
    -> user_error_analysis
    -> assessment_responses
  -> JourneyService.generateDynamicJourney
    -> learning_journeys
    -> journey_steps
```

### Runtime Practice Data Flow

```text
DailyMixRuntimeView / SharedRuntime
  -> sessionService
  -> FastAPI /api/v1/tasks/*
  -> SessionManager
  -> ProfileAggregator
  -> Groq task batch or fallback
  -> frontend runtime modules
  -> evaluate-task / sync-task / session-complete
  -> skill_states
  -> learner_profiles
  -> assessment_logs
  -> user_error_profiles
  -> journey_steps
```

## 18. Testing

Backend tests exist under `backend/tests/`, including:

- Journey flow tests.
- Practice route tests.
- Task generator strict enforcement tests.
- Interactive pipeline tests.

Frontend tests exist under:

- `frontend/src/tests/`
- `frontend/src/engine/__tests__/`
- `frontend/src/engine/assessment-v2/__tests__/`

Frontend test coverage includes:

- Assessment engine behavior.
- CEFR scoring.
- Stability/regression tests.
- High proficiency paradox tests.
- Multi-skill behavior.
- Speaking fallback.
- Trace runner.
- Assessment pipeline v2.

Useful commands:

```bash
cd frontend
npm run test
```

Backend test command depends on the active virtual environment and test DB setup:

```bash
cd backend
pytest
```

## 19. Important Implementation Notes

### 1. Two Journey Architectures Exist

The codebase contains both:

- Legacy/frontend dynamic journey through `learning_journeys` and `journey_steps`.
- Newer 20-node invisible-judge journey through `journey_maps`, `nodes`, and `journey_tasks`.

This is intentional or transitional, but future development should clarify which one is canonical for each UI path.

### 2. Two Assessment Engines Exist

The frontend has:

- `AdaptiveAssessmentEngine`: currently central diagnostic runtime.
- `assessment-v2` pipeline: deterministic layered evidence pipeline.

The v2 pipeline appears more rigorous and testable, but the app still uses other assessment flows. Integration boundaries should be documented before replacing one with the other.

### 3. Provider Naming Is Mixed

Backend uses Groq SDK and variables like `GROQ_API_KEY`.

Supabase Edge Function uses `GROK_API_KEY` and xAI API endpoints.

This should be standardized or clearly documented in deployment instructions.

### 4. Some Comments Have Encoding Artifacts

Several source files contain mojibake/encoding artifacts in comments and logs. This does not necessarily break runtime behavior, but it makes code harder to maintain.

### 5. Local Storage Is Part of Reliability

The frontend uses localStorage heavily for:

- Assessment recovery.
- Last assessment result.
- Last assessment outcome.
- Last evaluations.
- Onboarding state.
- Pending assessment logs.
- Cached auth token/user ID.

This is a deliberate resilience strategy, but stale local data must be carefully cleared after DB confirmation.

### 6. RLS and Service Role Boundaries Matter

Client-side Supabase writes rely on authenticated user policies.

Server-side/Edge writes can use service role keys. Those keys must never be exposed to deployable frontend bundles.

The README already notes that internal admin seeding lives under `tools/internal/seed-admin.ts` and reads secrets from `backend/.env`, not from frontend code.

## 20. Suggested Maintenance Roadmap

1. Decide whether `learning_journeys/journey_steps` or `journey_maps/nodes/journey_tasks` is the canonical journey model.
2. Align provider naming for Groq/Grok/xAI environment variables.
3. Add a single architecture diagram to this documentation.
4. Remove or archive stale scratch scripts after confirming they are no longer needed.
5. Normalize score scales across services, especially where some code stores 0-1, 0-100, or 0-10000.
6. Add backend integration tests for `SessionManager.process_session_results`.
7. Add deployment-specific notes for Railway/Vercel/Supabase.
8. Clean encoding artifacts in comments/log strings.

## 21. Quick File Map

High-value files for onboarding:

- `README.md`: basic setup and environment notes.
- `backend/app/main.py`: backend app and route map.
- `backend/app/core/config.py`: environment variable contract.
- `backend/app/api/deps.py`: auth/JWT validation.
- `backend/app/models/domain.py`: database domain model.
- `backend/app/services/session_manager.py`: daily mix and practice orchestration.
- `backend/app/services/journey_service.py`: 20-node journey architecture.
- `backend/app/services/task_generator.py`: personalized task generation.
- `backend/app/services/assessment_service.py`: backend assessment evaluation and persistence.
- `backend/app/integrations/groq_client.py`: LLM prompts, models, and JSON contracts.
- `frontend/src/main.tsx`: frontend bootstrap.
- `frontend/src/App.tsx`: routes and diagnostic save orchestration.
- `frontend/src/context/DataContext.tsx`: auth/profile/global state.
- `frontend/src/services/AdaptiveAssessmentEngine.ts`: diagnostic runtime.
- `frontend/src/services/AssessmentSaveService.ts`: assessment persistence.
- `frontend/src/services/sessionService.ts`: practice runtime API client.
- `frontend/src/engine/assessment-v2/pipeline.ts`: newer evidence-based assessment pipeline.
- `supabase/functions/analyze-assessment/index.ts`: deep diagnostic Edge Function.
- `supabase/migrations/`: schema, RLS, RBAC, and invite functions.

