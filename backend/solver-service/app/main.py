"""FastAPI main application."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import (
    SolveRequest,
    SolveResponse,
    ReoptimizeRequest,
    ReoptimizeResponse,
    SpofAuditRequest,
    SpofAuditResponse,
)
from app.engine.solver import run_solver
from app.engine.reoptimizer import run_reoptimizer
from app.engine.spof import run_spof_audit

app = FastAPI(
    title="Smart Roster Solver Service",
    description="CP-SAT-based roster optimization with OR-Tools",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "solver-service"}


@app.post("/solve", response_model=SolveResponse)
def solve_roster(request: SolveRequest):
    """
    Solve roster generation problem using CP-SAT.
    
    Enforces:
    - HARD P0: Brand & Process Coverage
    - HARD P0: Leave & Holiday Lock
    - HARD P0: Single-Assignment Cap (1.0 FTE)
    - HARD P1: Mandatory Weekly Offs (>= 4 per 30-day cycle, max 6 consecutive workdays)
    - SOFT: Primary Brand Continuity, Preferred Weekly-Off, Equitable Sunday Offs
    
    Returns unsatisfiable core diagnostics if infeasible.
    """
    try:
        result = run_solver(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")


@app.post("/reoptimize", response_model=ReoptimizeResponse)
def reoptimize_roster(request: ReoptimizeRequest):
    """
    Minimal-perturbation reoptimization for disruptions.
    
    Freezes dates before disruption_date, locks unaffected employees,
    marks disrupted employee(s) unavailable, computes ranked backup candidates,
    and returns cascade diff.
    """
    try:
        result = run_reoptimizer(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reoptimizer error: {str(e)}")


@app.post("/audit/spof", response_model=SpofAuditResponse)
def audit_spof(request: SpofAuditRequest):
    """
    Pre-flight Bus Factor / SPOF Radar audit.
    
    Flags brand-process pairs with zero backup redundancy on Sundays or public holidays.
    """
    try:
        result = run_spof_audit(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SPOF audit error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
