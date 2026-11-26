/**
 * Shared TypeScript types and DTOs matching apps/solver-service/app/models.py
 */

// ========== Enums ==========
export enum ProcessType {
  CS = 'CS',
  ACC = 'ACC',
  NDR = 'NDR',
  RETENTION = 'RETENTION',
}

export enum OperatingCalendar {
  ALL_365 = 'ALL_365',
  EXCL_PH = 'EXCL_PH',
  EXCL_SUN_PH = 'EXCL_SUN_PH',
}

export enum RoleType {
  DEDICATED = 'DEDICATED',
  SHARED = 'SHARED',
  FLOAT_BACKUP = 'FLOAT_BACKUP',
}

export enum AssignmentType {
  PRIMARY = 'PRIMARY',
  SECONDARY_BACKUP = 'SECONDARY_BACKUP',
}

export enum ShiftCode {
  W = 'W', // Working
  WO = 'WO', // Weekly Off
  PH = 'PH', // Public Holiday
  AL = 'AL', // Approved Leave
  CO = 'CO', // Comp Off
  BK = 'BK', // Backup (working on another brand/process)
}

export enum LeaveType {
  APPROVED_LEAVE = 'APPROVED_LEAVE',
  COMP_OFF = 'COMP_OFF',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RosterStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

// ========== Employee Models ==========
export interface EmployeeInput {
  id: string;
  name: string;
  pod_id: string;
  role_type: RoleType;
  preferred_weekly_off: number; // 0=Sunday, 6=Saturday
  max_daily_capacity: number; // 0.0 - 1.0
  process_skill_tags: ProcessType[];
  is_active: boolean;
}

// ========== Brand & ProcessRule Models ==========
export interface BrandProcessRuleInput {
  id: string;
  brand_id: string;
  brand_name: string;
  pod_id: string;
  process: ProcessType;
  operating_calendar: OperatingCalendar;
  min_headcount: number;
  is_active: boolean;
}

// ========== Allocation Models ==========
export interface EmployeeAllocationInput {
  employee_id: string;
  brand_process_rule_id: string;
  assignment_type: AssignmentType;
  allocation_weight: number; // 0.0 - 1.0
}

// ========== Leave & Holiday Models ==========
export interface LeaveRequestInput {
  employee_id: string;
  date: string; // "YYYY-MM-DD"
}

export interface HolidayInput {
  date: string; // "YYYY-MM-DD"
  is_public_holiday: boolean;
}

// ========== Solver Request & Response ==========
export interface SolveRequest {
  month_key: string; // e.g., "2026-11"
  employees: EmployeeInput[];
  brand_process_rules: BrandProcessRuleInput[];
  allocations: EmployeeAllocationInput[];
  leaves: LeaveRequestInput[];
  holidays: HolidayInput[];
  time_limit_seconds?: number; // default 300
}

export interface ShiftAssignmentDTO {
  employee_id: string;
  date: string; // "YYYY-MM-DD"
  shift_code: ShiftCode;
  brand_process_rule_id?: string | null;
  notes?: string | null;
}

export interface UnsatisfiableCoreItem {
  constraint_type: string; // e.g., "COVERAGE", "LEAVE_LOCK", "MAX_CAPACITY", "WEEKLY_OFF"
  description: string;
  affected_entities: string[]; // employee IDs, brand IDs, dates, etc.
  remediation_hint: string;
}

export interface SolveResponse {
  success: boolean;
  month_key: string;
  shift_assignments: ShiftAssignmentDTO[];
  objective_score: number | null;
  solver_duration_ms: number;
  error_message?: string | null;
  unsatisfiable_core?: UnsatisfiableCoreItem[] | null;
}

// ========== Reoptimization / Disruption Solver ==========
export interface BackupCandidate {
  employee_id: string;
  employee_name: string;
  score: number;
  reason: string; // plain-English explanation
}

export interface CascadeDiffItem {
  employee_id: string;
  employee_name: string;
  date: string;
  before_shift: ShiftCode | null;
  after_shift: ShiftCode;
  before_brand?: string | null;
  after_brand?: string | null;
}

export interface ReoptimizeRequest {
  month_key: string;
  original_roster: ShiftAssignmentDTO[];
  disruption_date: string; // "YYYY-MM-DD"
  disrupted_employee_ids: string[];
  employees: EmployeeInput[];
  brand_process_rules: BrandProcessRuleInput[];
  allocations: EmployeeAllocationInput[];
  leaves: LeaveRequestInput[];
  holidays: HolidayInput[];
  time_limit_seconds?: number; // default 180
}

export interface ReoptimizeResponse {
  success: boolean;
  month_key: string;
  new_roster: ShiftAssignmentDTO[];
  backup_candidates: BackupCandidate[];
  cascade_diff: CascadeDiffItem[];
  perturbation_count: number;
  objective_score: number | null;
  solver_duration_ms: number;
  error_message?: string | null;
}

// ========== SPOF Audit ==========
export interface SpofAuditItem {
  brand_id: string;
  brand_name: string;
  process: ProcessType;
  risk_level: string; // "HIGH", "MEDIUM", "LOW"
  description: string;
  affected_dates: string[]; // dates with zero backup redundancy
}

export interface SpofAuditRequest {
  month_key: string;
  employees: EmployeeInput[];
  brand_process_rules: BrandProcessRuleInput[];
  allocations: EmployeeAllocationInput[];
  leaves: LeaveRequestInput[];
  holidays: HolidayInput[];
}

export interface SpofAuditResponse {
  success: boolean;
  month_key: string;
  spof_items: SpofAuditItem[];
  total_risks: number;
  error_message?: string | null;
}

// ========== Validation Results ==========
export enum ViolationType {
  P0_COVERAGE_GAP = 'P0_COVERAGE_GAP',
  P0_LEAVE_LOCK = 'P0_LEAVE_LOCK',
  P0_SINGLE_ASSIGNMENT_CAP = 'P0_SINGLE_ASSIGNMENT_CAP',
  P1_WEEKLY_OFF = 'P1_WEEKLY_OFF',
}

export interface RuleViolation {
  type: ViolationType;
  severity: 'P0' | 'P1';
  employeeId: string;
  employeeName: string;
  date: string;
  description: string;
  affectedBrandProcessRuleId?: string;
  affectedBrandName?: string;
  affectedProcess?: ProcessType;
}

export interface CoverageGap {
  brandProcessRuleId: string;
  brandName: string;
  process: ProcessType;
  date: string;
  requiredHeadcount: number;
  actualHeadcount: number;
  gap: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
  coverageGaps: CoverageGap[];
  affectedSummary: {
    totalViolations: number;
    p0Violations: number;
    p1Violations: number;
    affectedEmployees: string[];
    affectedDates: string[];
  };
}

export interface ConflictExplanation {
  summary: string;
  rootCauses: string[];
  recommendedActions: string[];
  provider: 'openai' | 'anthropic' | 'deterministic';
}

export interface AuditLogEntry {
  timestamp: string; // ISO 8601
  actor: string;
  action: string; // e.g., "GENERATE", "MANUAL_EDIT", "PUBLISH", "UNLOCK", "REOPTIMIZE"
  details: string;
  affectedEntities?: string[];
}
