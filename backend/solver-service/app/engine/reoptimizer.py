"""Minimal-Perturbation Disruption Solver for roster reoptimization."""

import time
from datetime import datetime
from typing import List, Dict, Set, Tuple
from ortools.sat.python import cp_model
from app.models import (
    ReoptimizeRequest,
    ReoptimizeResponse,
    ShiftAssignment,
    ShiftCode,
    BackupCandidate,
    CascadeDiffItem,
    OperatingCalendar,
    AssignmentType,
)


class ReoptimizeSolver:
    def __init__(self, request: ReoptimizeRequest):
        self.request = request
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

        # Parse dates
        year, month = map(int, request.month_key.split("-"))
        start_date = datetime(year, month, 1)
        from calendar import monthrange
        _, last_day = monthrange(year, month)
        end_date = datetime(year, month, last_day)

        self.dates = []
        from datetime import timedelta
        current = start_date
        while current <= end_date:
            self.dates.append(current)
            current += timedelta(days=1)

        self.date_strs = [d.strftime("%Y-%m-%d") for d in self.dates]
        self.disruption_date_obj = datetime.strptime(request.disruption_date, "%Y-%m-%d")

        # Build lookup structures
        self.employee_map = {emp.id: emp for emp in request.employees}
        self.rule_map = {rule.id: rule for rule in request.brand_process_rules}

        # Holiday set
        self.holiday_dates = {datetime.strptime(h.date, "%Y-%m-%d") for h in request.holidays if h.is_public_holiday}

        # Leave map
        self.leave_map: Dict[str, Set[datetime]] = {}
        for leave in request.leaves:
            emp_id = leave.employee_id
            leave_date = datetime.strptime(leave.date, "%Y-%m-%d")
            if emp_id not in self.leave_map:
                self.leave_map[emp_id] = set()
            self.leave_map[emp_id].add(leave_date)

        # Allocation map
        self.allocation_map: Dict[str, List[Tuple[str, AssignmentType, float]]] = {}
        for alloc in request.allocations:
            rule_id = alloc.brand_process_rule_id
            if rule_id not in self.allocation_map:
                self.allocation_map[rule_id] = []
            self.allocation_map[rule_id].append((alloc.employee_id, alloc.assignment_type, alloc.allocation_weight))

        # Original roster map: (emp_id, date_str) -> ShiftAssignment
        self.original_roster_map: Dict[Tuple[str, str], ShiftAssignment] = {}
        for assignment in request.original_roster:
            self.original_roster_map[(assignment.employee_id, assignment.date)] = assignment

        # Decision variables
        self.shift_vars: Dict[str, Dict[str, Dict[str, cp_model.IntVar]]] = {}
        self.wo_vars: Dict[str, Dict[str, cp_model.IntVar]] = {}
        self.perturbation_vars: List[cp_model.IntVar] = []

    def build_variables(self):
        """Create decision variables."""
        for emp in self.request.employees:
            if not emp.is_active:
                continue
            emp_id = emp.id
            self.shift_vars[emp_id] = {}
            self.wo_vars[emp_id] = {}

            for date_str in self.date_strs:
                self.shift_vars[emp_id][date_str] = {}
                self.wo_vars[emp_id][date_str] = self.model.NewBoolVar(f"wo_{emp_id}_{date_str}")

                for rule in self.request.brand_process_rules:
                    if not rule.is_active:
                        continue
                    allocations = self.allocation_map.get(rule.id, [])
                    if any(alloc[0] == emp_id for alloc in allocations):
                        if rule.process in emp.process_skill_tags:
                            var = self.model.NewBoolVar(f"shift_{emp_id}_{date_str}_{rule.id}")
                            self.shift_vars[emp_id][date_str][rule.id] = var

    def add_freeze_constraints(self):
        """Freeze dates before disruption_date and lock unaffected employees."""
        for emp_id in self.shift_vars:
            is_disrupted = emp_id in self.request.disrupted_employee_ids

            for date_str in self.date_strs:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")

                # Freeze dates before disruption
                if date_obj < self.disruption_date_obj:
                    original = self.original_roster_map.get((emp_id, date_str))
                    if original:
                        if original.shift_code == ShiftCode.WO:
                            self.model.Add(self.wo_vars[emp_id][date_str] == 1)
                        elif original.brand_process_rule_id and original.brand_process_rule_id in self.shift_vars[emp_id][date_str]:
                            self.model.Add(self.shift_vars[emp_id][date_str][original.brand_process_rule_id] == 1)
                    continue

                # For disrupted employees on disruption date, mark unavailable
                if is_disrupted and date_obj == self.disruption_date_obj:
                    # Employee is unavailable (on leave/disrupted)
                    for rule_id in self.shift_vars[emp_id][date_str]:
                        self.model.Add(self.shift_vars[emp_id][date_str][rule_id] == 0)
                    self.model.Add(self.wo_vars[emp_id][date_str] == 0)  # Not WO, it's AL/disruption
                    continue

                # Also enforce pre-approved leaves
                if date_obj in self.leave_map.get(emp_id, set()):
                    for rule_id in self.shift_vars[emp_id][date_str]:
                        self.model.Add(self.shift_vars[emp_id][date_str][rule_id] == 0)
                    self.model.Add(self.wo_vars[emp_id][date_str] == 0)

                # If WO == 1, cannot work any shift
                wo_var = self.wo_vars[emp_id][date_str]
                for shift_var in self.shift_vars[emp_id][date_str].values():
                    self.model.Add(shift_var == 0).OnlyEnforceIf(wo_var)

    def add_coverage_constraints(self):
        """Brand & Process Coverage constraints."""
        for rule in self.request.brand_process_rules:
            if not rule.is_active:
                continue

            for idx, date in enumerate(self.dates):
                date_str = self.date_strs[idx]
                is_sunday = date.weekday() == 6
                is_holiday = date in self.holiday_dates

                operates = True
                if rule.operating_calendar == OperatingCalendar.EXCL_PH and is_holiday:
                    operates = False
                elif rule.operating_calendar == OperatingCalendar.EXCL_SUN_PH and (is_sunday or is_holiday):
                    operates = False

                if not operates:
                    continue

                working_vars = []
                for emp_id in self.shift_vars:
                    if rule.id in self.shift_vars[emp_id].get(date_str, {}):
                        working_vars.append(self.shift_vars[emp_id][date_str][rule.id])

                if working_vars:
                    self.model.Add(sum(working_vars) >= rule.min_headcount)

    def add_capacity_constraints(self):
        """Single-Assignment Cap."""
        for emp_id, emp in self.employee_map.items():
            if not emp.is_active or emp_id not in self.shift_vars:
                continue

            for date_str in self.date_strs:
                if date_str not in self.shift_vars[emp_id]:
                    continue

                shift_assignments = list(self.shift_vars[emp_id][date_str].values())
                if shift_assignments:
                    self.model.Add(sum(shift_assignments) <= 1)

    def add_perturbation_penalty(self):
        """Minimize Hamming distance from original roster."""
        for emp_id in self.shift_vars:
            for date_str in self.date_strs:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")

                # Only penalize changes on/after disruption date
                if date_obj < self.disruption_date_obj:
                    continue

                original = self.original_roster_map.get((emp_id, date_str))
                if not original:
                    continue

                if date_str not in self.shift_vars[emp_id]:
                    continue

                # Create perturbation variable
                perturb_var = self.model.NewBoolVar(f"perturb_{emp_id}_{date_str}")

                if original.shift_code == ShiftCode.WO:
                    # Original was WO, penalize if changed
                    self.model.Add(perturb_var == 1 - self.wo_vars[emp_id][date_str])
                elif original.brand_process_rule_id:
                    # Original was working on a specific rule
                    if original.brand_process_rule_id in self.shift_vars[emp_id][date_str]:
                        original_var = self.shift_vars[emp_id][date_str][original.brand_process_rule_id]
                        self.model.Add(perturb_var == 1 - original_var)
                    else:
                        # Rule no longer available, any assignment is a perturbation
                        any_assignment = sum(self.shift_vars[emp_id][date_str].values())
                        self.model.Add(perturb_var >= any_assignment)

                self.perturbation_vars.append(perturb_var)

        # Minimize total perturbations
        if self.perturbation_vars:
            self.model.Minimize(sum(self.perturbation_vars))

    def solve(self) -> ReoptimizeResponse:
        """Run reoptimization solver."""
        start_time = time.time()

        try:
            self.build_variables()
            self.add_freeze_constraints()
            self.add_coverage_constraints()
            self.add_capacity_constraints()
            self.add_perturbation_penalty()

            self.solver.parameters.max_time_in_seconds = self.request.time_limit_seconds
            self.solver.parameters.log_search_progress = False

            status = self.solver.Solve(self.model)
            solver_duration_ms = int((time.time() - start_time) * 1000)

            if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
                new_roster = self._extract_solution()
                backup_candidates = self._rank_backup_candidates()
                cascade_diff = self._compute_cascade_diff(new_roster)
                perturbation_count = sum(self.solver.Value(var) for var in self.perturbation_vars)

                return ReoptimizeResponse(
                    success=True,
                    month_key=self.request.month_key,
                    new_roster=new_roster,
                    backup_candidates=backup_candidates,
                    cascade_diff=cascade_diff,
                    perturbation_count=perturbation_count,
                    objective_score=self.solver.ObjectiveValue() if status == cp_model.OPTIMAL else None,
                    solver_duration_ms=solver_duration_ms,
                )

            else:
                return ReoptimizeResponse(
                    success=False,
                    month_key=self.request.month_key,
                    solver_duration_ms=solver_duration_ms,
                    error_message=f"Reoptimization failed: {self.solver.StatusName(status)}",
                )

        except Exception as e:
            solver_duration_ms = int((time.time() - start_time) * 1000)
            return ReoptimizeResponse(
                success=False,
                month_key=self.request.month_key,
                solver_duration_ms=solver_duration_ms,
                error_message=f"Reoptimization exception: {str(e)}",
            )

    def _extract_solution(self) -> List[ShiftAssignment]:
        """Extract new roster from solved model."""
        assignments = []

        for emp_id in self.shift_vars:
            for date_str in self.date_strs:
                if date_str not in self.shift_vars[emp_id]:
                    continue

                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                is_on_leave = date_obj in self.leave_map.get(emp_id, set())
                is_holiday = date_obj in self.holiday_dates

                # Check if disrupted employee on disruption date
                if emp_id in self.request.disrupted_employee_ids and date_obj == self.disruption_date_obj:
                    assignments.append(
                        ShiftAssignment(
                            employee_id=emp_id,
                            date=date_str,
                            shift_code=ShiftCode.AL,
                            brand_process_rule_id=None,
                        )
                    )
                    continue

                if is_on_leave:
                    assignments.append(
                        ShiftAssignment(
                            employee_id=emp_id,
                            date=date_str,
                            shift_code=ShiftCode.AL,
                            brand_process_rule_id=None,
                        )
                    )
                    continue

                if is_holiday:
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

                working_rule_id = None
                for rule_id, var in self.shift_vars[emp_id][date_str].items():
                    if self.solver.Value(var) == 1:
                        working_rule_id = rule_id
                        break

                if working_rule_id:
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
                    assignments.append(
                        ShiftAssignment(
                            employee_id=emp_id,
                            date=date_str,
                            shift_code=ShiftCode.WO,
                            brand_process_rule_id=None,
                        )
                    )

        return assignments

    def _rank_backup_candidates(self) -> List[BackupCandidate]:
        """Rank backup candidates by process certification, utilization, consecutive days worked."""
        candidates = []

        # Find which brand-process needs backup on disruption date
        disrupted_rules = set()
        for emp_id in self.request.disrupted_employee_ids:
            original = self.original_roster_map.get((emp_id, self.request.disruption_date))
            if original and original.brand_process_rule_id:
                disrupted_rules.add(original.brand_process_rule_id)

        # If no specific rules disrupted (employee was on WO/leave), return empty
        if not disrupted_rules:
            return []

        # For each disrupted rule, find eligible backup employees
        for rule_id in disrupted_rules:
            rule = self.rule_map.get(rule_id)
            if not rule:
                continue

            allocations = self.allocation_map.get(rule_id, [])

            for emp_id, assignment_type, weight in allocations:
                if emp_id in self.request.disrupted_employee_ids:
                    continue

                emp = self.employee_map.get(emp_id)
                if not emp or not emp.is_active:
                    continue

                # Check if certified
                if rule.process not in emp.process_skill_tags:
                    continue

                # Compute score based on:
                # 1. Assignment type (SECONDARY_BACKUP > PRIMARY from other brands)
                # 2. Monthly utilization (fewer working days = higher availability)
                # 3. Consecutive days worked before disruption

                score = 0.0
                reason_parts = []

                if assignment_type == AssignmentType.SECONDARY_BACKUP:
                    score += 10.0
                    reason_parts.append("designated backup")
                else:
                    score += 5.0
                    reason_parts.append("cross-trained")

                # Count working days in original roster
                working_days = sum(
                    1 for date_str in self.date_strs
                    if self.original_roster_map.get((emp_id, date_str))
                    and self.original_roster_map[(emp_id, date_str)].shift_code in [ShiftCode.W, ShiftCode.BK]
                )
                utilization = working_days / len(self.date_strs) if len(self.date_strs) > 0 else 0
                score += (1.0 - utilization) * 5.0  # Lower utilization = higher score
                reason_parts.append(f"{utilization*100:.0f}% utilized")

                # Consecutive days worked before disruption
                consecutive_days = 0
                for date in reversed(self.dates):
                    if date >= self.disruption_date_obj:
                        continue
                    date_str = date.strftime("%Y-%m-%d")
                    original = self.original_roster_map.get((emp_id, date_str))
                    if original and original.shift_code in [ShiftCode.W, ShiftCode.BK]:
                        consecutive_days += 1
                    else:
                        break

                score -= consecutive_days * 0.5  # More consecutive days = lower score (fatigue)
                if consecutive_days > 0:
                    reason_parts.append(f"{consecutive_days} consecutive days")

                candidates.append(
                    BackupCandidate(
                        employee_id=emp_id,
                        employee_name=emp.name,
                        score=score,
                        reason=", ".join(reason_parts),
                    )
                )

        # Sort by score descending
        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates[:10]  # Top 10

    def _compute_cascade_diff(self, new_roster: List[ShiftAssignment]) -> List[CascadeDiffItem]:
        """Compute before/after cascade diff."""
        diff_items = []

        new_roster_map = {(a.employee_id, a.date): a for a in new_roster}

        for date_str in self.date_strs:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            if date_obj < self.disruption_date_obj:
                continue

            for emp_id in self.employee_map:
                original = self.original_roster_map.get((emp_id, date_str))
                new = new_roster_map.get((emp_id, date_str))

                if not original and not new:
                    continue

                # Compare shifts
                original_shift = original.shift_code if original else None
                new_shift = new.shift_code if new else None
                original_brand = original.brand_process_rule_id if original else None
                new_brand = new.brand_process_rule_id if new else None

                if original_shift != new_shift or original_brand != new_brand:
                    emp = self.employee_map.get(emp_id)
                    emp_name = emp.name if emp else emp_id

                    diff_items.append(
                        CascadeDiffItem(
                            employee_id=emp_id,
                            employee_name=emp_name,
                            date=date_str,
                            before_shift=original_shift,
                            after_shift=new_shift,
                            before_brand=original_brand,
                            after_brand=new_brand,
                        )
                    )

        return diff_items


def run_reoptimizer(request: ReoptimizeRequest) -> ReoptimizeResponse:
    """Entry point for reoptimizer."""
    solver = ReoptimizeSolver(request)
    return solver.solve()
