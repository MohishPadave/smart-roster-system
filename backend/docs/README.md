# Smart Roster Management System

**Constraint-Based Workforce Scheduling Engine, Multi-Lens Operations Matrix, SPOF Bus-Factor Radar, and Disruption Simulator**

Built by [Mohish Padave](https://www.mohishpadave.com).

---

## Architecture Overview

Rather than treating workforce scheduling as a calendar UI problem, the system models D2C operations as a **Constraint Satisfaction & Optimization Problem (CSOP)**, decoupling **Brand Operating Calendars** (`ALL_365`, `EXCL_PH`, `EXCL_SUN_PH`) from **Employee Shift Rules** (`>= 4` statutory rest days per 30-day cycle, max `6` consecutive workdays, approved leave locks, `1.0 FTE` daily cap) and introducing a cross-trained **Pod Float / Backup Pool**.

### Repository Structure (Segregated `frontend/` + `backend/`)

```
roaster/
├── frontend/                              # Next.js 15 UI (Pure JS/JSX, Vercel-ready)
│   ├── next.config.mjs                    # Proxies /api/* -> BACKEND_API_URL
│   ├── jsconfig.json
│   ├── .env.example
│   └── src/
│       ├── middleware.js                  # Edge HMAC session guard (/dashboard, /roster, /configuration)
│       ├── stores/rosterStore.js          # Zustand state + 50-step Undo/Redo + simulation state
│       ├── lib/
│       │   ├── auth.js                    # Web Crypto HMAC-SHA256 session verification
│       │   └── client-validator.js        # Zero-latency deterministic client constraint checker
│       ├── types/roster.js                # Shared JS enums (ShiftCode, ProcessType, etc.)
│       ├── app/
│       │   ├── login/page.jsx             # Monochrome sign-in page
│       │   ├── forgot-password/page.jsx   # 2-step 6-digit reset code recovery flow
│       │   ├── dashboard/page.jsx         # Overview & SPOF Bus-Factor Radar (also /)
│       │   ├── roster/page.jsx            # 5-Lens Operations Matrix & Disruption Simulator
│       │   └── configuration/page.jsx     # Entity & Constraint Configuration Studio
│       └── components/
│           ├── layout/                    # CommandShell.jsx, Footer.jsx
│           ├── guide/                     # PlatformGuideModal.jsx (first-login walkthrough)
│           ├── dashboard/                 # CommandDeck.jsx
│           ├── entities/                  # QuickCreateModals.jsx (+ New Employee, + New Brand)
│           ├── matrix/                    # LensSwitcher.jsx, RosterGrid.jsx, ShiftCell.jsx, DiffBadge.jsx
│           ├── simulator/                 # DisruptionDrawer.jsx, BackupCandidateCard.jsx, CascadePreview.jsx
│           ├── conflicts/                 # AICopilotPanel.jsx, ConflictInspector.jsx, RuleViolationAlert.jsx
│           ├── config/                    # ConfigurationStudio.jsx
│           └── ui/                        # CustomSelect.jsx, CustomMonthPicker.jsx, CustomDatePicker.jsx, ConfirmAlertModal.jsx
│
└── backend/
    ├── render.yaml                        # Render Blueprint (Postgres + Python Solver + Node API)
    ├── docs/
    │   ├── README.md
    │   ├── QUICKSTART.md
    │   └── DEPLOY.md                      # Step-by-step Render + Vercel deployment guide
    ├── api/                               # Next.js API Server + Prisma + PostgreSQL (port 4000)
    │   ├── prisma/
    │   │   ├── schema.prisma              # 11 models (Pod, Employee, Brand, BrandProcessRule, EmployeeAllocation, LeaveRequest, HolidayCalendar, RosterVersion, ShiftEntry, User, PasswordResetToken)
    │   │   ├── seed.ts                    # Idempotent seed: 3 Pods, 35 Employees, 22 Brands (18/4), 4 Users
    │   │   └── seed-if-empty.ts           # Safe auto-seed on first cloud deploy
    │   └── src/
    │       ├── lib/                       # prisma.ts, auth.ts, password.ts, solver-client.ts, validator.ts, export.ts
    │       └── app/api/
    │           ├── health/                # Postgres + Solver health check
    │           ├── auth/                  # login, logout, me, forgot-password, reset-password
    │           ├── dashboard/spof/        # Executive KPIs + SPOF radar
    │           ├── roster/                # generate, validate, publish, simulate, export (CSV/XLSX)
    │           ├── ai/explain/            # OpenAI / Anthropic structured conflict synthesis + deterministic fallback
    │           └── entities/              # CRUD for pods, employees, brands, rules, allocations, leaves, holidays
    │
    └── solver-service/                    # Python FastAPI + Google OR-Tools CP-SAT (port 8001)
        ├── requirements.txt
        ├── runtime.txt                    # python-3.11.11
        ├── app/
        │   ├── main.py                    # GET /health, POST /solve, POST /reoptimize, POST /audit/spof
        │   ├── models.py                  # Pydantic v2 schemas
        │   └── engine/
        │       ├── solver.py              # Deterministic CP-SAT solver
        │       ├── reoptimizer.py         # Minimal-perturbation disruption solver
        │       └── spof.py                # Pre-flight Bus-Factor SPOF audit
        └── tests/
            └── test_solver.py             # 15 pytest tests covering hard/soft rules, IIS, SPOF & reoptimization
```

---

## Core Features Implemented

1. **Constraint-Based Automated Roster Generator (`POST /api/roster/generate` -> `/solve`)**
   - **HARD P0**: Brand & Process minimum headcount on active operating days (`ALL_365`, `EXCL_PH`, `EXCL_SUN_PH`), Leave & Public Holiday locks (`AL`, `CO`, `PH`), Single-Assignment Daily Cap (`<= 1.0 FTE`), Skill & Allocation eligibility.
   - **HARD P1**: `>= 4` statutory rest days (`WO` + `PH`) per 30-day cycle and **never `> 6` consecutive workdays** without rest.
   - **SOFT**: Primary Brand Continuity (`W=10`), Preferred Weekly-Off Day (`W=6`, `0=Sunday`), Equitable Sunday Offs per Pod (`W=4`).
   - **Infeasibility Diagnostics**: Pinpoints conflicting coverage/rest constraints with plain-English remediation hints instead of saving an invalid schedule.

2. **Pre-Flight SPOF Bus-Factor Radar (`GET /api/dashboard/spof` -> `/audit/spof`)**
   - Audits the 80/20 split (`18` single-resource vs `4` multi-resource D2C brands across `3` Pods and `35` Employees).
   - Flags `Bus Factor = 1` brand-process rules lacking secondary/float backup coverage.

3. **5-Lens Interactive Operations Matrix (`/roster`)**
   - Instant client-side lens switching across **Company-Wide** (TanStack Table), **Pod-Wise**, **Brand-Wise (Demand)**, **Process-Wise**, and **Employee-Wise (Supply)**.
   - Color-coded shift cells (`W`/`BK` in green, `AL`/`CO` in red, `WO` in neutral white, `PH` in zinc) and a high-contrast `DAILY HEADCOUNT` footer bar.
   - Inline shift overrides with zero-latency client guardrail validation, **50-step Undo/Redo**, Force Override confirmation modal, **Publish & Lock** (`DRAFT` ↔ `PUBLISHED`), **Audit Log** history, and **CSV / Excel (`.xlsx`)** export.

4. **"What-If" Disruption & Minimal-Perturbation Simulator (`POST /api/roster/simulate` -> `/reoptimize`)**
   - Click any working shift cell → **Simulate Unplanned Leave** to freeze prior dates, minimize schedule perturbations, rank certified backup candidates by role/utilization/fatigue streak, and preview the visual before/after **Cascade Diff** before committing.

5. **Conflict Brief / AI Copilot (`POST /api/ai/explain`)**
   - Uses OpenAI (`gpt-4o-mini`) or Anthropic (`claude-3-5-sonnet`) when `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is configured, with a deterministic structured synthesis fallback so it always works out of the box.

6. **Authentication, Custom Controls & First-Login Guide**
   - Database-backed Login, Forgot/Reset Password (6-digit 15-minute recovery token), and Logout with `httpOnly` HMAC-SHA256 cookies and Next.js Edge Middleware.
   - 100% custom monochrome dropdowns, month/date pickers, and confirmation dialogs; auto-opening 4-step **Platform Guide** on first login; quick-create modals for **New Employee** and **New Brand**.

---

## Local Development Setup

### Prerequisites
- **PostgreSQL 15+**
- **Node.js 20+**
- **Python 3.9+** (Python 3.11 recommended in production)

### 1. Start the Python Solver (`backend/solver-service`)
```bash
cd backend/solver-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -v
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### 2. Setup & Start the Backend API (`backend/api`)
Configure `backend/api/.env`:
```env
DATABASE_URL="postgresql://user@127.0.0.1:5433/smart_roster?schema=public"
SOLVER_URL="http://127.0.0.1:8001"
AUTH_SECRET="roster-cpsat-local-dev-secret-key-2026"
```
Run migrations, seed, and start on port `4000`:
```bash
cd backend/api
npm install
npx prisma db push
npm run db:seed
npm run dev
```

### 3. Start the Frontend (`frontend`)
Configure `frontend/.env`:
```env
BACKEND_API_URL="http://127.0.0.1:4000"
AUTH_SECRET="roster-cpsat-local-dev-secret-key-2026"
```
Start on port `3000`:
```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:3000** (or `http://localhost:3000`) and sign in with the seeded credentials:
- **Admin:** `admin@roaster.io` / `Admin@123`
- **Pod Leads:** `alice.kumar@company.com`, `mia.george@company.com`, `xander.mark@company.com` / `PodLead@123`

---

## Cloud Deployment (Vercel + Render)

See **[DEPLOY.md](./DEPLOY.md)** for full instructions:
- **Backend (`backend/`) on Render**: Use [render.yaml](../render.yaml) to deploy PostgreSQL + `roster-solver` (`backend/solver-service`) + `roster-api` (`backend/api`).
- **Frontend (`frontend/`) on Vercel**: Set Root Directory to `frontend` and configure `BACKEND_API_URL` + matching `AUTH_SECRET`.

---

## Architecture & Design Notes

1. **Why CP-SAT instead of greedy heuristics?** Greedy assignment fails when 80/20 single-resource brands overlap with 6-consecutive-day caps and approved leaves. CP-SAT explores the exact constraint graph deterministically in `<1s` and provides mathematically valid schedules or conflict diagnostics.
2. **Why decouple `frontend/` and `backend/` via Next.js `rewrites()`?** Keeps frontend UI (`.jsx`/`.js`) cleanly separated from database/solver internals while keeping browser requests same-origin (`Set-Cookie` works with zero CORS friction across Vercel + Render).
3. **Why client + server deterministic validation?** `frontend/src/lib/client-validator.js` gives instant visual feedback on manual edits without network latency, while `backend/api/src/lib/validator.ts` enforces the exact same P0/P1 rules before persisting overrides or publishing.
4. **Why minimal-perturbation reoptimization?** Re-solving from scratch mid-month scrambles unaffected employees' plans. Freezing dates before `disruptionDate` and minimizing Hamming distance preserves stability while filling disrupted slots with ranked backups.
