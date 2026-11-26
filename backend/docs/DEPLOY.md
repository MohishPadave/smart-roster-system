# Deploying Frontend (Vercel) + Backend (Render)

## 1. Push Repository to GitHub
Make sure your repo root contains `frontend/` and `backend/`, and push to GitHub.

---

## 2. Deploy Backend on Render (`backend/`)

### Option A — Blueprint (`backend/render.yaml`)
1. In Render Dashboard, click **New → Blueprint** and connect your GitHub repository.
2. Render reads `backend/render.yaml` (if prompted for blueprint path, set `backend/render.yaml`), which creates:
   - `smart-roster-db` (PostgreSQL)
   - `roster-solver` (`backend/solver-service` — Python FastAPI + OR-Tools)
   - `roster-api` (`backend/api` — Next.js API + Prisma, auto-pushes schema & seeds initial data if empty)
3. When prompted for `AUTH_SECRET`, paste a strong random string (e.g. `openssl rand -hex 32`) — **save this exact value** to paste into Vercel too! (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are optional; deterministic fallback works without them.)

### Option B — Manual Web Services on Render
1. **PostgreSQL**: Create a Render PostgreSQL DB (or use Supabase) and copy `DATABASE_URL`.
2. **Solver Service** (`Web Service`):
   - **Root Directory**: `backend/solver-service`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
3. **Backend API** (`Web Service`):
   - **Root Directory**: `backend/api`
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate && npx prisma db push --accept-data-loss && npm run db:seed-if-empty && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
   - **Environment Variables**:
     - `DATABASE_URL` = your PostgreSQL URL
     - `SOLVER_URL` = `https://<your-roster-solver>.onrender.com` (no trailing slash)
     - `AUTH_SECRET` = strong random secret (same as Vercel)
     - `COOKIE_SECURE` = `true`

Verify `https://<your-roster-api>.onrender.com/api/health` returns `{"healthy":true,...}`.

---

## 3. Deploy Frontend on Vercel (`frontend/`)
1. In Vercel Dashboard, click **Add New → Project** and select your GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Framework Preset: **Next.js** (auto-detected).
4. Add **Environment Variables**:
   - `BACKEND_API_URL` = `https://<your-roster-api>.onrender.com` (no trailing slash)
   - `AUTH_SECRET` = the **exact same** `AUTH_SECRET` configured on `roster-api` in Render
5. Click **Deploy**.

> Note: Render Free tier instances sleep after 15 minutes of inactivity, so the very first login or `Generate Roster` call after idle may take ~30s while Render wakes up.
