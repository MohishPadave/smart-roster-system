"""Deterministic CP-SAT Solver for roster generation."""

import time
from datetime import datetime, timedelta
from typing import List, Dict, Set, Tuple, Optional
from ortools.sat.python import cp_model
from app.models import (
    SolveRequest,
    SolveResponse,
    ShiftAssignment,
    ShiftCode,
    OperatingCalendar,
    AssignmentType,
    ProcessType,
    UnsatisfiableCoreItem,
)


class RosterSolver:
    def __init__(self, request: SolveRequest):
        self.request = request
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

        # Parse month dates
        year, month = map(int, request.month_key.split("-"))
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)

        self.dates = []
        current = start_date
        while current <= end_date:
            self.dates.append(current)
            current += timedelta(days=1)

        self.date_strs = [d.strftime("%Y-%m-%d") for d in self.dates]
        self.num_days = len(self.dates)

        # Build lookup structures
        self.employee_map = {emp.id: emp for emp in request.employees}
        self.rule_map = {rule.id: rule for rule in request.brand_process_rules}

        # Holiday set
        self.holiday_dates = {datetime.strptime(h.date, "%Y-%m-%d") for h in request.holidays if h.is_public_holiday}

        # Leave map: employee_id -> set of leave dates
        self.leave_map: Dict[str, Set[datetime]] = {}
        for leave in request.leaves:
            emp_id = leave.employee_id
            leave_date = datetime.strptime(leave.date, "%Y-%m-%d")
            if emp_id not in self.leave_map:
                self.leave_map[emp_id] = set()
            self.leave_map[emp_id].add(leave_date)

        # Allocation map: brand_process_rule_id -> list of (employee_id, assignment_type, weight)
        self.allocation_map: Dict[str, List[Tuple[str, AssignmentType, float]]] = {}
        for alloc in request.allocations:
            rule_id = alloc.brand_process_rule_id
            if rule_id not in self.allocation_map:
                self.allocation_map[rule_id] = []
            self.allocation_map[rule_id].append((alloc.employee_id, alloc.assignment_type, alloc.allocation_weight))

        # Decision variables: shift_vars[emp_id][date_str][rule_id] = BoolVar
        # True if employee works on this rule on this date
        self.shift_vars: Dict[str, Dict[str, Dict[str, cp_model.IntVar]]] = {}

        # Weekly off variables: wo_vars[emp_id][date_str] = BoolVar
        self.wo_vars: Dict[str, Dict[str, cp_model.IntVar]] = {}

        # Conflict tracking for infeasibility diagnostics
        self.constraint_descriptions: List[str] = []

    def build_variables(self):
        """Create decision variables for shifts and weekly offs."""
        for emp in self.request.employees:
            if not emp.is_active:
                continue
            emp_id = emp.id
            self.shift_vars[emp_id] = {}
            self.wo_vars[emp_id] = {}

            for date_str in self.date_strs:
                self.shift_vars[emp_id][date_str] = {}
                self.wo_vars[emp_id][date_str] = self.model.NewBoolVar(f"wo_{emp_id}_{date_str}")

                # Create shift variables for each eligible rule
                for rule in self.request.brand_process_rules:
                    if not rule.is_active:
                        continue
                    # Check if employee has allocation for this rule
                    allocations = self.allocation_map.get(rule.id, [])
                    if any(alloc[0] == emp_id for alloc in allocations):
                        # Check skill match
                        if rule.process in emp.process_skill_tags:
                            var = self.model.NewBoolVar(f"shift_{emp_id}_{date_str}_{rule.id}")
                            self.shift_vars[emp_id][date_str][rule.id] = var

    def add_coverage_constraints(self):
        """HARD P0: Brand & Process Coverage constraints."""
        for rule in self.request.brand_process_rules:
            if not rule.is_active:
                continue

            for idx, date in enumerate(self.dates):
                date_str = self.date_strs[idx]
                is_sunday = date.weekday() == 6
                is_holiday = date in self.holiday_dates

                # Check if brand operates on this date
                operates = True
                if rule.operating_calendar == OperatingCalendar.EXCL_PH and is_holiday:
                    operates = False
                elif rule.operating_calendar == OperatingCalendar.EXCL_SUN_PH and (is_sunday or is_holiday):
                    operates = False

                if not operates:
                    continue

                # Sum of employees working on this rule on this date >= minHeadcount
                working_vars = []
                for emp_id in self.shift_vars:
                    if rule.id in self.shift_vars[emp_id].get(date_str, {}):
                        working_vars.append(self.shift_vars[emp_id][date_str][rule.id])

                if working_vars:
                    # Add coverage constraint
                    self.model.Add(sum(working_vars) >= rule.min_headcount)
                    self.constraint_descriptions.append(
                        f"COVERAGE: Brand '{rule.brand_name}' process '{rule.process.value}' "
                        f"on {date_str} requires >= {rule.min_headcount} employees"
                    )
                else:
                    # Zero eligible employees for an active operating day -> impossible
                    self.model.Add(0 >= rule.min_headcount)
                    self.constraint_descriptions.append(
                        f"COVERAGE_UNSTAFFED: Brand '{rule.brand_name}' process '{rule.process.value}' "
                        f"on {date_str} has 0 eligible employees (requires {rule.min_headcount})"
                    )

    def add_leave_holiday_constraints(self):
        """HARD P0: Leave & Holiday Lock constraints."""
        for emp_id, leave_dates in self.leave_map.items():
            if emp_id not in self.shift_vars:
                continue
            for leave_date in leave_dates:
                date_str = leave_date.strftime("%Y-%m-%d")
                if date_str not in self.shift_vars[emp_id]:
                    continue
                # Employee cannot work on any rule on leave date and leave does not count as WO
                for rule_id, var in self.shift_vars[emp_id][date_str].items():
                    self.model.Add(var == 0)
                if date_str in self.wo_vars.get(emp_id, {}):
                    self.model.Add(self.wo_vars[emp_id][date_str] == 0)

    def add_capacity_constraints(self):
        """HARD P0: Single-Assignment Cap (no double-booking, <= maxDailyCapacity)."""
        for emp_id, emp in self.employee_map.items():
            if not emp.is_active or emp_id not in self.shift_vars:
                continue

            for date_str in self.date_strs:
                if date_str not in self.shift_vars[emp_id]:
                    continue

                # Sum of all shift assignments on this date <= 1 (since maxDailyCapacity=1.0)
                shift_assignments = list(self.shift_vars[emp_id][date_str].values())
                if shift_assignments:
                    # At most one brand-process assignment per day
                    self.model.Add(sum(shift_assignments) <= 1)

    def add_weekly_off_constraints(self):
        """HARD P1: Mandatory Weekly Offs (>= 4 WO per 30-day cycle, max 6 consecutive workdays)."""
        for emp_id, emp in self.employee_map.items():
            if not emp.is_active or emp_id not in self.shift_vars:
                continue

            # Minimum weekly offs scaled by month length
            min_weekly_offs = max(4, int(self.num_days / 30 * 4))

            # Total weekly offs >= min_weekly_offs
            wo_sum = sum(self.wo_vars[emp_id][date_str] for date_str in self.date_strs)
            self.model.Add(wo_sum >= min_weekly_offs)
            self.constraint_descriptions.append(
                f"WEEKLY_OFF: Employee '{emp.name}' requires >= {min_weekly_offs} weekly offs"
            )

            # Max 6 consecutive workdays without rest
            for start_idx in range(self.num_days - 6):
                consecutive_work = []
                for offset in range(7):
                    date_str = self.date_strs[start_idx + offset]
                    # Working = not on weekly off and not on leave
                    is_on_leave = (
                        self.dates[start_idx + offset] in self.leave_map.get(emp_id, set())
                    )
                    if is_on_leave:
                        consecutive_work.append(0)
                    else:
                        # working = 1 - wo_var (if not WO, then potentially working)
                        work_var = self.model.NewBoolVar(f"work_{emp_id}_{date_str}_consec")
                        self.model.Add(work_var == 1 - self.wo_vars[emp_id][date_str])
                        consecutive_work.append(work_var)

                # At least one day off in every 7-day window
                if consecutive_work:
                    self.model.Add(sum(consecutive_work) <= 6)

            # Link weekly off and shift variables: if WO, cannot work
            for date_str in self.date_strs:
                if date_str not in self.shift_vars[emp_id]:
                    continue
                wo_var = self.wo_vars[emp_id][date_str]
                shift_assignments = list(self.shift_vars[emp_id][date_str].values())
                if shift_assignments:
                    # If wo_var == 1, then all shift assignments must be 0
                    for shift_var in shift_assignments:
                        self.model.Add(shift_var == 0).OnlyEnforceIf(wo_var)

    def add_soft_constraints(self):
        """SOFT constraints: Primary Brand Continuity, Preferred Weekly-Off, Equitable Sunday Offs."""
        penalties = []

        # SOFT W=10: Primary Brand Continuity
        for emp_id, emp in self.employee_map.items():
            if not emp.is_active or emp_id not in self.shift_vars:
                continue

            # Find PRIMARY allocations
            primary_rules = set()
            for rule in self.request.brand_process_rules:
                allocations = self.allocation_map.get(rule.id, [])
                for alloc_emp_id, atype, _ in allocations:
                    if alloc_emp_id == emp_id and atype == AssignmentType.PRIMARY:
                        primary_rules.add(rule.id)

            # Penalize working on non-primary brands
            for date_str in self.date_strs:
                if date_str not in self.shift_vars[emp_id]:
                    continue
                for rule_id, var in self.shift_vars[emp_id][date_str].items():
                    if rule_id not in primary_rules:
                        # Penalty for working on non-primary brand
                        penalty_var = self.model.NewBoolVar(f"penalty_continuity_{emp_id}_{date_str}_{rule_id}")
                        self.model.Add(penalty_var == var)
                        penalties.append((penalty_var, 10))

        # SOFT W=6: Preferred Weekly-Off Day (0=Sunday .. 6=Saturday)
        for emp_id, emp in self.employee_map.items():
            if not emp.is_active or emp_id not in self.wo_vars:
                continue

            preferred_day = emp.preferred_weekly_off
            for idx, date in enumerate(self.dates):
                date_str = self.date_strs[idx]
                js_weekday = (date.weekday() + 1) % 7
                if js_weekday == preferred_day:
                    # Reward if WO on preferred day (penalize if not)
                    penalty_var = self.model.NewBoolVar(f"penalty_pref_wo_{emp_id}_{date_str}")
                    self.model.Add(penalty_var == 1 - self.wo_vars[emp_id][date_str])
                    penalties.append((penalty_var, 6))

        # SOFT W=4: Equitable Sunday Offs per pod
        # Group employees by pod
        pod_employees: Dict[str, List[str]] = {}
        for emp in self.request.employees:
            if emp.is_active:
                if emp.pod_id not in pod_employees:
                    pod_employees[emp.pod_id] = []
                pod_employees[emp.pod_id].append(emp.id)

        for pod_id, emp_ids in pod_employees.items():
            sunday_wo_counts = []
            for emp_id in emp_ids:
                if emp_id not in self.wo_vars:
                    continue
                sunday_wos = []
                for idx, date in enumerate(self.dates):
                    if date.weekday() == 6:  # Sunday
                        date_str = self.date_strs[idx]
                        if date_str in self.wo_vars[emp_id]:
                            sunday_wos.append(self.wo_vars[emp_id][date_str])
                if sunday_wos:
                    count_var = self.model.NewIntVar(0, len(sunday_wos), f"sunday_wo_count_{emp_id}")
                    self.model.Add(count_var == sum(sunday_wos))
                    sunday_wo_counts.append(count_var)

            # Minimize variance (use max - min as proxy)
            if len(sunday_wo_counts) > 1:
                max_var = self.model.NewIntVar(0, len(self.dates), f"max_sunday_wo_{pod_id}")
                min_var = self.model.NewIntVar(0, len(self.dates), f"min_sunday_wo_{pod_id}")
                self.model.AddMaxEquality(max_var, sunday_wo_counts)
                self.model.AddMinEquality(min_var, sunday_wo_counts)
                spread_var = self.model.NewIntVar(0, len(self.dates), f"spread_sunday_wo_{pod_id}")
                self.model.Add(spread_var == max_var - min_var)
                penalties.append((spread_var, 4))

        # Set objective: minimize total penalty
        if penalties:
            total_penalty = sum(var * weight for var, weight in penalties)
            self.model.Minimize(total_penalty)

    def solve(self) -> SolveResponse:
        """Run CP-SAT solver and return result."""
        start_time = time.time()

        try:
            self.build_variables()
            self.add_coverage_constraints()
            self.add_leave_holiday_constraints()
            self.add_capacity_constraints()
            self.add_weekly_off_constraints()
            self.add_soft_constraints()

            # Set solver parameters
            self.solver.parameters.max_time_in_seconds = self.request.time_limit_seconds
            self.solver.parameters.log_search_progress = False

            # Solve (without assumptions API)
            status = self.solver.Solve(self.model)

            solver_duration_ms = int((time.time() - start_time) * 1000)

            if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
                # Extract solution
                shift_assignments = self._extract_solution()
                objective_score = self.solver.ObjectiveValue() if status == cp_model.OPTIMAL else None

                return SolveResponse(
                    success=True,
                    month_key=self.request.month_key,
                    shift_assignments=shift_assignments,
                    objective_score=objective_score,
                    solver_duration_ms=solver_duration_ms,
                )

            elif status == cp_model.INFEASIBLE:
                # Extract unsatisfiable core
                unsatisfiable_core = self._extract_unsatisfiable_core()
                return SolveResponse(
                    success=False,
                    month_key=self.request.month_key,
                    shift_assignments=[],
                    solver_duration_ms=solver_duration_ms,
                    error_message="Problem is infeasible (no solution exists).",
                    unsatisfiable_core=unsatisfiable_core,
                )

            else:
                return SolveResponse(
                    success=False,
                    month_key=self.request.month_key,
                    shift_assignments=[],
                    solver_duration_ms=solver_duration_ms,
                    error_message=f"Solver status: {self.solver.StatusName(status)}",
                )

        except Exception as e:
            solver_duration_ms = int((time.time() - start_time) * 1000)
            return SolveResponse(
                success=False,
                month_key=self.request.month_key,
                shift_assignments=[],
                solver_duration_ms=solver_duration_ms,
                error_message=f"Solver exception: {str(e)}",
            )

    def _extract_solution(self) -> List[ShiftAssignment]:
        """Extract shift assignments from solved model."""
        assignments = []

        for emp_id in self.shift_vars:
            for date_str in self.date_strs:
                if date_str not in self.shift_vars[emp_id]:
                    continue

                # Check if on leave
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                is_on_leave = date_obj in self.leave_map.get(emp_id, set())
                is_holiday = date_obj in self.holiday_dates

                if is_on_leave:
                    # Determine leave type (AL or CO)
                    shift_code = ShiftCode.AL  # default to APPROVED_LEAVE
                    assignments.append(
                        ShiftAssignment(
                            employee_id=emp_id,
                            date=date_str,
                            shift_code=shift_code,
                            brand_process_rule_id=None,
                        )
                    )
                    continue

                if is_holiday:
                    # Mark as PH if not working
                    working_on_any_rule = any(
                        self.solver.Value(var) == 1
                        for var in self.shift_vars[emp_id][date_str].values()
                    )
                    if not working_on_any_rule:
                        assignments.append(
                            ShiftAssignment(
                                employee_id=emp_id,
                                date=date_str,
                                shift_code=ShiftCode.PH,
                                brand_process_rule_id=None,
                            )
                        )
                        continue

                # Check if weekly off
                wo_var = self.wo_vars[emp_id][date_str]
                if self.solver.Value(wo_var) == 1:
                    assignments.append(
                        ShiftAssignment(
                            employee_id=emp_id,
                            date=date_str,
                            shift_code=ShiftCode.WO,
                            brand_process_rule_id=None,
                        )
                    )
                    continue

                # Check if working on any rule
                working_rule_id = None
                for rule_id, var in self.shift_vars[emp_id][date_str].items():
                    if self.solver.Value(var) == 1:
                        working_rule_id = rule_id
                        break

                if working_rule_id:
                    # Determine if PRIMARY or BACKUP
                    allocations = self.allocation_map.get(working_rule_id, [])
                    is_primary = any(
                        alloc[0] == emp_id and alloc[1] == AssignmentType.PRIMARY
                        for alloc in allocations
                    )
                    shift_code = ShiftCode.W if is_primary else ShiftCode.BK

                    assignments.append(
                        ShiftAssignment(
                            employee_id=emp_id,
                            date=date_str,
                            shift_code=shift_code,
                            brand_process_rule_id=working_rule_id,
                        )
                    )
                else:
                    # Default to WO if not working
                    assignments.append(
                        ShiftAssignment(
                            employee_id=emp_id,
                            date=date_str,
                            shift_code=ShiftCode.WO,
                            brand_process_rule_id=None,
                        )
                    )

        return assignments

    def _extract_unsatisfiable_core(self) -> List[UnsatisfiableCoreItem]:
        """Extract diagnostic information about infeasibility."""
        core_items = []

        # Return high-level diagnostic information based on constraint descriptions
        # Group by constraint type
        coverage_constraints = [desc for desc in self.constraint_descriptions if "COVERAGE" in desc]
        weekly_off_constraints = [desc for desc in self.constraint_descriptions if "WEEKLY_OFF" in desc]

        if coverage_constraints:
            core_items.append(
                UnsatisfiableCoreItem(
                    constraint_type="COVERAGE",
                    description=f"{len(coverage_constraints)} brand coverage constraints may be conflicting",
                    affected_entities=[],
                    remediation_hint="Add more employees with required skills, reduce minHeadcount, or adjust operating calendars.",
                )
            )

        if weekly_off_constraints:
            core_items.append(
                UnsatisfiableCoreItem(
                    constraint_type="WEEKLY_OFF",
                    description=f"{len(weekly_off_constraints)} weekly off constraints may be conflicting",
                    affected_entities=[],
                    remediation_hint="Reduce workload, hire more employees, or adjust weekly off requirements.",
                )
            )

        # Add general diagnostic
        core_items.append(
            UnsatisfiableCoreItem(
                constraint_type="GENERAL",
                description="Problem is over-constrained. No feasible solution exists.",
                affected_entities=[],
                remediation_hint="Review all constraints: coverage, leaves, weekly offs, and capacity limits.",
            )
        )

        return core_items


def run_solver(request: SolveRequest) -> SolveResponse:
    """Entry point for solver."""
    solver = RosterSolver(request)
    return solver.solve()
