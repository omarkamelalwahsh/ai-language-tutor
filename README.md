# AI Language Tutor

AI Language Tutor is an English learning application with a React + Vite frontend and a FastAPI + PostgreSQL backend. It integrates Supabase, Groq, and optional Firebase push notifications.

## Project Structure
- `backend/`: FastAPI API server with SQLAlchemy, Supabase, and Groq configuration.
- `frontend/`: React UI with Vite and Tailwind.
- `supabase/`: Supabase Functions, Edge Functions, and migrations.
- `archives/` and `scratch/`: helper scripts, data inspection tools, and archive files. These are not part of the main production flow.

## Requirements
- Node.js 20.x
- Python 3.11+
- PostgreSQL or Supabase database
- Supabase keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Groq API key: `GROQ_API_KEY` (stored in `backend/.env`)
- (Optional) Firebase Cloud Messaging for notifications

## Environment Setup

### backend/.env
Copy `backend/.env.example` to `backend/.env` and update the values:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/your_db_name
SUPABASE_JWT_SECRET="your_supabase_jwt_secret"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
GROQ_API_KEY="your_groq_api_key"
GROQ_TASK_ENGINE_API_KEY="your_optional_groq_task_engine_api_key"
BACKEND_CORS_ORIGINS="http://localhost:3000,https://your-production-url.com"
```

### frontend/.env
Copy `frontend/.env.example` to `frontend/.env` and update the values:

```env
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
VITE_API_URL="http://localhost:8000"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
VITE_FIREBASE_PROJECT_ID="your_firebase_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
VITE_FIREBASE_APP_ID="your_firebase_app_id"
VITE_FIREBASE_VAPID_KEY="your_firebase_web_push_vapid_key"

# Optional admin/script credentials
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
GROQ_TASK_ENGINE_API_KEY="your_optional_groq_task_engine_api_key"
```

> If the frontend is deployed separately from the backend, make sure `VITE_API_URL` points to your backend server and includes the protocol, for example `https://your-backend.example.com`.

> Note: `.env` files are ignored by Git via `.gitignore`.

## Local Development

> Internal admin seeding now lives in `tools/internal/seed-admin.ts` and reads `ADMIN_PASSWORD` / `ADMIN_EMAIL` from `backend/.env`, not from the deployable frontend bundle.

### 1. Install dependencies
```bash
npm install
npm run install:all
```

### 2. Run both frontend and backend
```bash
npm run dev
```

### 3. Run frontend only
```bash
cd frontend
npm run dev
```

### 4. Run backend only
```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
venv\Scripts\python -m uvicorn app.main:app --reload
```

## Core API Endpoints
- `GET /health`
- `GET /api/v1/openapi.json`
- `POST /api/v1/auth/...`
- `GET /api/v1/learner/...`
- `POST /api/v1/tasks/...`
- `POST /api/v1/daily/...`
- `POST /api/v1/notifications/...`
- `POST /api/v1/chat/...`

> Local API base URL: `http://localhost:8000/api/v1`

## CORS and Production Setup
The backend reads `BACKEND_CORS_ORIGINS` from `backend/.env` or from environment variables on deployment platforms like Railway.

```env
BACKEND_CORS_ORIGINS="https://your-frontend-domain.com,http://localhost:3000"
```

If your frontend is deployed on Vercel, include the full Vercel origin with `https://`.

```env
BACKEND_CORS_ORIGINS="https://ai-language-tutor-j0lh5mfs3-omar-kamels-projects-2d079e4d.vercel.app"
```

> Make sure `VITE_API_URL` in `frontend/.env` is a full URL with protocol, such as `https://ai-language-tutor-production-ec00.up.railway.app`.

If deploying on Vercel or Netlify, add these environment variables to the frontend project settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GROQ_API_KEY` in backend/.env for backend-only LLM operations
- Firebase values if you want notifications

## Notifications (Firebase FCM)
- `frontend/src/lib/notifications.ts` now reads `VITE_FIREBASE_*` values from `frontend/.env`.
- If these values remain placeholders, device registration will not occur and notifications will remain disabled.
- `frontend/public/firebase-messaging-sw.js` is a static service worker template that should be updated manually with real Firebase values if background messaging is required.

## Legacy / Archive Notes
- `archives/` and `scratch/` contain helper scripts, data inspection utilities, and archival tools.
- These folders are not part of the main production flow and can be cleaned up or moved into a `tools/` directory after verifying they are not needed.

## Key Notes
- `backend/app/core/config.py` loads configuration from `backend/.env`.
- `frontend/src/lib/supabaseClient.ts` depends on `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `supabase/functions/analyze-assessment/index.ts` requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Supabase Functions environment.
- If Supabase or Groq settings are incorrect, warnings may appear in the browser console when the frontend runs.

