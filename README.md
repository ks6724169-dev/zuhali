# Zuhali AI — Production AI Workspace

Zuhali AI is an enterprise-grade AI chatbot and development workspace built with **React**, **FastAPI (Python)**, **Supabase (PostgreSQL + RLS + Auth + Storage)**, and optimized for deployment on **Render**.

---

## 🚀 Quick Start

### 1. Frontend (React + Vite)
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Backend (Python FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # On Windows
# source venv/bin/activate  # On Linux / Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger API documentation.

---

## 🗄️ Database & Security (Supabase)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Run the migration script in `supabase/migrations/001_initial_schema.sql`.
4. Row Level Security (RLS) policies are automatically activated, ensuring strict user isolation.

---

## ☁️ Deployment on Render

### Deploying the Backend on Render
1. Push this repository to GitHub.
2. In Render dashboard, select **New Web Service** and connect your repository.
3. Configure:
   - **Root Directory**: `backend`
   - **Environment**: `Docker` (uses `backend/Dockerfile`) or `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `backend/.env.example`.

### Deploying the Frontend
1. Deploy via Render Static Site or Vercel:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
