"""Pydantic models for solver service API."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class ProcessType(str, Enum):
    CS = "CS"
    ACC = "ACC"
    NDR = "NDR"
    RETENTION = "RETENTION"


class OperatingCalendar(str, Enum):
    ALL_365 = "ALL_365"
    EXCL_PH = "EXCL_PH"
    EXCL_SUN_PH = "EXCL_SUN_PH"


class RoleType(str, Enum):
    DEDICATED = "DEDICATED"
    SHARED = "SHARED"
    FLOAT_BACKUP = "FLOAT_BACKUP"


class AssignmentType(str, Enum):
    PRIMARY = "PRIMARY"
    SECONDARY_BACKUP = "SECONDARY_BACKUP"


class ShiftCode(str, Enum):
    W = "W"  # Working
    WO = "WO"  # Weekly Off
    PH = "PH"  # Public Holiday
    AL = "AL"  # Approved Leave
    CO = "CO"  # Comp Off
    BK = "BK"  # Backup (working on another brand/process)


# ========== Employee Models ==========
class EmployeeInput(BaseModel):
    id: str
    name: str
    pod_id: str
    role_type: RoleType
    preferred_weekly_off: int = Field(ge=0, le=6, description="0=Sunday, 6=Saturday")
    max_daily_capacity: float = Field(default=1.0, ge=0.0, le=1.0)
    process_skill_tags: List[ProcessType]
    is_active: bool = True


# ========== Brand & ProcessRule Models ==========
class BrandProcessRuleInput(BaseModel):
    id: str
    brand_id: str
    brand_name: str
    pod_id: str
    process: ProcessType
    operating_calendar: OperatingCalendar
    min_headcount: int = Field(ge=1, default=1)
    is_active: bool = True


# ========== Allocation Models ==========
class EmployeeAllocationInput(BaseModel):
    employee_id: str
    brand_process_rule_id: str
    assignment_type: AssignmentType
    allocation_weight: float = Field(ge=0.0, le=1.0, default=1.0)


# ========== Leave & Holiday Models ==========
class LeaveRequestInput(BaseModel):
    employee_id: str
    date: str  # "YYYY-MM-DD"


class HolidayInput(BaseModel):
    date: str  # "YYYY-MM-DD"
    is_public_holiday: bool = True


# ========== Solver Request & Response ==========
class SolveRequest(BaseModel):
    month_key: str  # e.g., "2026-11"
    employees: List[EmployeeInput]
    brand_process_rules: List[BrandProcessRuleInput]
    allocations: List[EmployeeAllocationInput]
    leaves: List[LeaveRequestInput]
    holidays: List[HolidayInput]
    time_limit_seconds: int = Field(default=15, ge=2, le=1800)


class ShiftAssignment(BaseModel):
    employee_id: str
    date: str  # "YYYY-MM-DD"
    shift_code: ShiftCode
    brand_process_rule_id: Optional[str] = None
    notes: Optional[str] = None


class SolveResponse(BaseModel):
    success: bool
    month_key: str
    shift_assignments: List[ShiftAssignment] = []
    objective_score: Optional[float] = None
    solver_duration_ms: int
    error_message: Optional[str] = None
    unsatisfiable_core: Optional[List['UnsatisfiableCoreItem']] = None


# ========== Unsatisfiable Core / IIS Diagnostics ==========
class UnsatisfiableCoreItem(BaseModel):
    constraint_type: str  # e.g., "COVERAGE", "LEAVE_LOCK", "MAX_CAPACITY", "WEEKLY_OFF"
    description: str
    affected_entities: List[str]  # employee IDs, brand IDs, dates, etc.
    remediation_hint: str


# ========== Reoptimization / Disruption Solver ==========
class BackupCandidate(BaseModel):
    employee_id: str
    employee_name: str
    score: float
    reason: str  # plain-English explanation


class CascadeDiffItem(BaseModel):
    employee_id: str
    employee_name: str
    date: str
    before_shift: Optional[ShiftCode]
    after_shift: ShiftCode
    before_brand: Optional[str] = None
    after_brand: Optional[str] = None


class ReoptimizeRequest(BaseModel):
    month_key: str
    original_roster: List[ShiftAssignment]
    disruption_date: str  # "YYYY-MM-DD"
    disrupted_employee_ids: List[str]
    employees: List[EmployeeInput]
    brand_process_rules: List[BrandProcessRuleInput]
    allocations: List[EmployeeAllocationInput]
    leaves: List[LeaveRequestInput]
    holidays: List[HolidayInput]
    time_limit_seconds: int = Field(default=15, ge=2, le=1800)


class ReoptimizeResponse(BaseModel):
    success: bool
    month_key: str
    new_roster: List[ShiftAssignment] = []
    backup_candidates: List[BackupCandidate] = []
    cascade_diff: List[CascadeDiffItem] = []
    perturbation_count: int = 0
    objective_score: Optional[float] = None
    solver_duration_ms: int
    error_message: Optional[str] = None


# ========== SPOF Audit ==========
class SpofAuditItem(BaseModel):
    brand_id: str
    brand_name: str
    process: ProcessType
    risk_level: str  # "HIGH", "MEDIUM", "LOW"
    description: str
    affected_dates: List[str]  # dates with zero backup redundancy


class SpofAuditRequest(BaseModel):
    month_key: str
    employees: List[EmployeeInput]
    brand_process_rules: List[BrandProcessRuleInput]
    allocations: List[EmployeeAllocationInput]
    leaves: List[LeaveRequestInput]
    holidays: List[HolidayInput]


class SpofAuditResponse(BaseModel):
    success: bool
    month_key: str
    spof_items: List[SpofAuditItem] = []
    total_risks: int = 0
    error_message: Optional[str] = None
