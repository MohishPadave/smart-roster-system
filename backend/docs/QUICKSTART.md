# Quick Start Guide

## Start All 3 Local Services

### Terminal 1 — Solver Service (Port 8001)
```bash
cd backend/solver-service
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### Terminal 2 — Backend API + Prisma (Port 4000)
```bash
cd backend/api
npm run dev
```

### Terminal 3 — Frontend UI (Port 3000)
```bash
cd frontend
npm run dev
```

---

## Run Tests
```bash
cd backend/solver-service && .venv/bin/pytest -v
cd backend/api && npx tsc --noEmit
```

## Demo Credentials
- **Operations Admin:** `admin@roaster.io` / `Admin@123`
- **Pod Alpha Lead:** `alice.kumar@company.com` / `PodLead@123`
- **Pod Beta Lead:** `mia.george@company.com` / `PodLead@123`
- **Pod Gamma Lead:** `xander.mark@company.com` / `PodLead@123`

## Deployment
See [DEPLOY.md](./DEPLOY.md) for Render (`backend/`) and Vercel (`frontend/`) setup.
