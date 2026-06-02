
# AI Language Tutor

AI Language Tutor هو مشروع تعليم لغة إنجليزية مدعوم بـReact + Vite أمامي وFastAPI + PostgreSQL خلفي، مع تكامل Supabase وGroq وFirebase.

## هيكل المشروع
- `backend/`: API الخلفية مع FastAPI وSQLAlchemy وتهيئة Supabase وGroq.
- `frontend/`: واجهة المستخدم بـReact وVite وTailwind.
- `supabase/`: وظائف Supabase وEdge Functions وmigrations.
- `archives/` و `scratch/`: سكربتات وأدوات فحص وبيانات أرشيفية، وليست جزءًا من المسار الإنتاجي الرئيسي.

## المتطلبات الأساسية
- Node.js 20.x
- Python 3.11+ أو أحدث
- PostgreSQL أو قاعدة بيانات Supabase
- مفاتيح Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- مفتاح Groq: `GROQ_API_KEY`
- (اختياري) Firebase Cloud Messaging لإشعارات الدفع

## إعداد البيئة

### backend/.env
انسخ `backend/.env.example` إلى `backend/.env` ثم عدّل القيم التالية:

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
انسخ `frontend/.env.example` إلى `frontend/.env` ثم عدّل القيم التالية:

```env
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
VITE_API_URL="http://localhost:8000"
VITE_GROQ_API_KEY="your_groq_api_key"
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

> إذا كان `frontend` منشورًا منفصلًا عن `backend`، فتأكد من أن `VITE_API_URL` يشير إلى عنوان خادم الخلفية الخاص بك، ويشمل البروتوكول `https://`.

> ملاحظة: يوجد ملف `.gitignore` بالفعل لاستبعاد `.env` من Git.

## تشغيل محلي

### 1. تثبيت الاعتماديات
```bash
npm install
npm run install:all
```

### 2. تشغيل الواجهة والخلفية معًا
```bash
npm run dev
```

### 3. تشغيل الواجهة فقط
```bash
cd frontend
npm run dev
```

### 4. تشغيل الخلفية فقط
```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
venv\Scripts\python -m uvicorn app.main:app --reload
```

## واجهة برمجة التطبيقات الأساسية
- `GET /health`
- `GET /api/v1/openapi.json`
- `POST /api/v1/auth/...`
- `GET /api/v1/learner/...`
- `POST /api/v1/tasks/...`
- `POST /api/v1/daily/...`
- `POST /api/v1/notifications/...`
- `POST /api/v1/chat/...`

> القاعدة الأساسية في الوضع المحلي هي: `http://localhost:8000/api/v1`.

## إعداد CORS والإنتاج
المسار الخلفي الآن يقرأ `BACKEND_CORS_ORIGINS` من `backend/.env`. استخدم هذا المتغير لإدراج أصول الإنتاج مثل:

```env
BACKEND_CORS_ORIGINS="https://your-frontend-domain.com,http://localhost:3000"
```

إذا كنت تنشر الواجهة على Vercel أو Netlify، أضف القيم التالية إلى إعدادات المشروع:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GROQ_API_KEY`
- `VITE_FIREBASE_API_KEY` وبيانات Firebase الأخرى إذا كنت تريد إشعارات

## الإشعارات (Firebase FCM)
- `frontend/src/lib/notifications.ts` يستخدم الآن قيم `VITE_FIREBASE_*` من `frontend/.env`.
- إذا بقيت القيم كـ placeholder، فلن يتم تسجيل الجهاز ولن تكون الإشعارات فعالة.
- `frontend/public/firebase-messaging-sw.js` هو قالب ثابت يجب تحديثه يدوياً بقيم Firebase الحقيقية إذا أردت دعم الرسائل في الخلفية.

## ملاحظات عن الملفات القديمة
- `archives/` و `scratch/` يحتويان على سكربتات مساعدة، فحص بيانات، وأدوات اختبار.
- هذه المجلدات ليست جزءًا من مسار الإنتاج الرئيسي، ويمكن تنظيفها أو نقلها إلى مجلد `tools/` بعد التأكد من عدم استخدامها في التطبيق الأساسي.

## نقاط مهمة
- `backend/app/core/config.py` يقرأ `backend/.env`.
- `frontend/src/lib/supabaseClient.ts` يعتمد على `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.
- `supabase/functions/analyze-assessment/index.ts` يحتاج `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` في بيئة Supabase Functions.
- إذا كان هناك خطأ في إعدادات Supabase أو Groq، سيظهر تحذير في الكونسول عند تشغيل الواجهة.

