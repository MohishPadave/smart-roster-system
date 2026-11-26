# Free Cloud Deployment on Vercel + Neon (No Credit Card Required)

Because the repository is split cleanly into `frontend/`, `backend/api/`, and `backend/solver-service/`, you can host **all 3 services for free on Vercel** and PostgreSQL for free on **Neon** — without entering any credit card.

---

## Step 1: Create Free PostgreSQL on Neon (No Credit Card)
1. Sign in directly at **[neon.tech](https://neon.tech)** with GitHub/email (free tier requires no credit card).
2. Create a new project (e.g. `smart-roster`).
3. Copy your **Connection String** (`postgresql://...?sslmode=require`).

---

## Step 2: Deploy Python Solver (`backend/solver-service`) on Vercel
1. In Vercel Dashboard, click **Add New → Project** and import `MohishPadave/smart-roster-system`.
2. Set **Project Name**: e.g. `smart-roster-solver`.
3. Click **Edit** next to **Root Directory** and set it to: `backend/solver-service`
4. Leave Framework Preset / Build / Output settings as default (Vercel auto-detects `app/main.py`, `.python-version`, `requirements.txt`, and `backend/solver-service/vercel.json`).
5. Click **Deploy**.
6. Once live, test `https://<your-solver-domain>.vercel.app/health` — it should return `{"status":"healthy","service":"solver-service"}`.
   - Copy this base URL (`https://<your-solver-domain>.vercel.app`, **no trailing slash**).

---

## Step 3: Deploy Backend API (`backend/api`) on Vercel
1. Click **Add New → Project** and import `MohishPadave/smart-roster-system` again.
2. Set **Project Name**: e.g. `smart-roster-api`.
3. Set **Root Directory** to: `backend/api`
4. **Framework Preset**: `Next.js` (auto-detected). `backend/api/vercel.json` automatically runs `prisma generate`, pushes the schema, seeds initial data if empty, and runs `next build`.
5. Expand **Environment Variables** *before* clicking Deploy and add:
   - `DATABASE_URL` = your Neon connection string from Step 1
   - `SOLVER_URL` = `https://<your-solver-domain>.vercel.app` (from Step 2, no trailing slash)
   - `AUTH_SECRET` = any strong random secret string (e.g. `roster-prod-secret-key-2026` — **save this exact value** for Step 4)
   - `COOKIE_SECURE` = `true`
   - *(Optional)* `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (deterministic AI fallback works without them)
6. Click **Deploy**.
7. Once live, verify `https://<your-api-domain>.vercel.app/api/health` returns `{"healthy":true,...}`.

---

## Step 4: Deploy Frontend (`frontend`) on Vercel
1. Click **Add New → Project** and import `MohishPadave/smart-roster-system` a third time.
2. Set **Project Name**: e.g. `smart-roster-system` (this is the main URL you submit to HR).
3. Set **Root Directory** to: `frontend`
4. **Framework Preset**: `Next.js` (auto-detected).
5. Expand **Environment Variables** and add:
   - `BACKEND_API_URL` = `https://<your-api-domain>.vercel.app` (from Step 3, no trailing slash)
   - `AUTH_SECRET` = the **exact same** `AUTH_SECRET` value from Step 3
6. Click **Deploy**.

Open `https://<your-frontend-domain>.vercel.app` and sign in with the seeded Admin account (`admin@roaster.io` / `Admin@123`) or click one of the quick-fill demo accounts on the login page.

---

## Optional Alternative: Render (`backend/render.yaml`)
If you ever prefer Render (`backend/render.yaml`), use **New → Blueprint** with `backend/render.yaml` to deploy Postgres + `roster-solver` + `roster-api` together, then point `frontend/` on Vercel to your Render API URL.
