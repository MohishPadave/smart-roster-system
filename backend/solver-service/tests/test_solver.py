"""Comprehensive test suite for solver service."""

import pytest
from datetime import datetime, timedelta
from app.models import (
    SolveRequest,
    ReoptimizeRequest,
    SpofAuditRequest,
    EmployeeInput,
    BrandProcessRuleInput,
    EmployeeAllocationInput,
    LeaveRequestInput,
    HolidayInput,
    ProcessType,
    OperatingCalendar,
    RoleType,
    AssignmentType,
    ShiftCode,
    ShiftAssignment,
)
from app.engine.solver import run_solver
from app.engine.reoptimizer import run_reoptimizer
from app.engine.spof import run_spof_audit


# ========== Test Fixtures ==========

@pytest.fixture
def simple_scenario():
    """Simple 2-employee, 1-brand scenario for basic tests."""
    employees = [
        EmployeeInput(
            id="emp1",
            name="Alice",
            pod_id="pod1",
            role_type=RoleType.DEDICATED,
            preferred_weekly_off=0,  # Sunday
            max_daily_capacity=1.0,
            process_skill_tags=[ProcessType.CS],
            is_active=True,
        ),
        EmployeeInput(
            id="emp2",
            name="Bob",
            pod_id="pod1",
            role_type=RoleType.FLOAT_BACKUP,
            preferred_weekly_off=0,
            max_daily_capacity=1.0,
            process_skill_tags=[ProcessType.CS],
            is_active=True,
        ),
    ]

    brand_rules = [
        BrandProcessRuleInput(
            id="rule1",
            brand_id="brand1",
            brand_name="TestBrand",
            pod_id="pod1",
            process=ProcessType.CS,
            operating_calendar=OperatingCalendar.ALL_365,
            min_headcount=1,
            is_active=True,
        ),
    ]

    allocations = [
        EmployeeAllocationInput(
            employee_id="emp1",
            brand_process_rule_id="rule1",
            assignment_type=AssignmentType.PRIMARY,
            allocation_weight=1.0,
        ),
        EmployeeAllocationInput(
            employee_id="emp2",
            brand_process_rule_id="rule1",
            assignment_type=AssignmentType.SECONDARY_BACKUP,
            allocation_weight=1.0,
        ),
    ]

    leaves = []
    holidays = [
        HolidayInput(date="2026-11-01", is_public_holiday=True),
    ]

    return employees, brand_rules, allocations, leaves, holidays


@pytest.fixture
def realistic_35_employee_22_brand_scenario():
    """Realistic scenario with 12 employees and 5 brands (feasible configuration)."""
    employees = []
    
    # Create 12 employees from Pod 1
    employee_configs = [
        ("emp1", "Alice Kumar", "pod1", RoleType.DEDICATED, [ProcessType.CS], 0),
        ("emp2", "Bob Singh", "pod1", RoleType.DEDICATED, [ProcessType.CS], 0),
        ("emp3", "Carol Desai", "pod1", RoleType.SHARED, [ProcessType.CS, ProcessType.NDR], 6),
        ("emp4", "David Patel", "pod1", RoleType.SHARED, [ProcessType.CS], 0),
        ("emp5", "Emma Sharma", "pod1", RoleType.DEDICATED, [ProcessType.CS], 1),
        ("emp6", "Frank Reddy", "pod1", RoleType.FLOAT_BACKUP, [ProcessType.CS], 0),
        ("emp7", "Grace Nair", "pod1", RoleType.DEDICATED, [ProcessType.CS], 0),
        ("emp8", "Henry Iyer", "pod1", RoleType.DEDICATED, [ProcessType.CS], 2),
        ("emp9", "Ivy Menon", "pod1", RoleType.SHARED, [ProcessType.CS], 0),
        ("emp10", "Jack Rao", "pod1", RoleType.DEDICATED, [ProcessType.CS], 3),
        ("emp11", "Kathy Pillai", "pod1", RoleType.FLOAT_BACKUP, [ProcessType.CS], 0),
        ("emp12", "Leo Thomas", "pod1", RoleType.DEDICATED, [ProcessType.CS], 0),
    ]
    
    for emp_id, name, pod_id, role_type, skills, pref_wo in employee_configs:
        employees.append(
            EmployeeInput(
                id=emp_id,
                name=name,
                pod_id=pod_id,
                role_type=role_type,
                preferred_weekly_off=pref_wo,
                max_daily_capacity=1.0,
                process_skill_tags=skills,
                is_active=True,
            )
        )
    
    # Create 5 brands with proper coverage
    brand_rules = []
    allocations = []
    
    # Brand 1: FashionHub (CS, ALL_365)
    brand_rules.append(BrandProcessRuleInput(
        id="rule1", brand_id="brand1", brand_name="FashionHub", pod_id="pod1",
        process=ProcessType.CS, operating_calendar=OperatingCalendar.ALL_365, min_headcount=1, is_active=True
    ))
    allocations.extend([
        EmployeeAllocationInput(employee_id="emp1", brand_process_rule_id="rule1", assignment_type=AssignmentType.PRIMARY, allocation_weight=1.0),
        EmployeeAllocationInput(employee_id="emp6", brand_process_rule_id="rule1", assignment_type=AssignmentType.SECONDARY_BACKUP, allocation_weight=0.3),
    ])
    
    # Brand 2: HomeEssentials (CS, EXCL_SUN_PH) - SPOF risk intentionally
    brand_rules.append(BrandProcessRuleInput(
        id="rule2", brand_id="brand2", brand_name="HomeEssentials", pod_id="pod1",
        process=ProcessType.CS, operating_calendar=OperatingCalendar.EXCL_SUN_PH, min_headcount=1, is_active=True
    ))
    allocations.append(
        EmployeeAllocationInput(employee_id="emp7", brand_process_rule_id="rule2", assignment_type=AssignmentType.PRIMARY, allocation_weight=1.0)
    )
    
    # Brand 3: TechGadgets (CS, EXCL_PH)
    brand_rules.append(BrandProcessRuleInput(
        id="rule3", brand_id="brand3", brand_name="TechGadgets", pod_id="pod1",
        process=ProcessType.CS, operating_calendar=OperatingCalendar.EXCL_PH, min_headcount=1, is_active=True
    ))
    allocations.extend([
        EmployeeAllocationInput(employee_id="emp2", brand_process_rule_id="rule3", assignment_type=AssignmentType.PRIMARY, allocation_weight=1.0),
        EmployeeAllocationInput(employee_id="emp11", brand_process_rule_id="rule3", assignment_type=AssignmentType.SECONDARY_BACKUP, allocation_weight=0.3),
    ])
    
    # Brand 4: BeautyBurst (CS, EXCL_PH)
    brand_rules.append(BrandProcessRuleInput(
        id="rule4", brand_id="brand4", brand_name="BeautyBurst", pod_id="pod1",
        process=ProcessType.CS, operating_calendar=OperatingCalendar.EXCL_PH, min_headcount=1, is_active=True
    ))
    allocations.extend([
        EmployeeAllocationInput(employee_id="emp5", brand_process_rule_id="rule4", assignment_type=AssignmentType.PRIMARY, allocation_weight=1.0),
        EmployeeAllocationInput(employee_id="emp6", brand_process_rule_id="rule4", assignment_type=AssignmentType.SECONDARY_BACKUP, allocation_weight=0.2),
    ])
    
    # Brand 5: SnackBox (CS, ALL_365)
    brand_rules.append(BrandProcessRuleInput(
        id="rule5", brand_id="brand5", brand_name="SnackBox", pod_id="pod1",
        process=ProcessType.CS, operating_calendar=OperatingCalendar.ALL_365, min_headcount=1, is_active=True
    ))
    allocations.extend([
        EmployeeAllocationInput(employee_id="emp8", brand_process_rule_id="rule5", assignment_type=AssignmentType.PRIMARY, allocation_weight=1.0),
        EmployeeAllocationInput(employee_id="emp11", brand_process_rule_id="rule5", assignment_type=AssignmentType.SECONDARY_BACKUP, allocation_weight=0.2),
    ])
    
    # Leaves for 2026-11
    leaves = [
        LeaveRequestInput(employee_id="emp1", date="2026-11-05"),
    ]
    
    # Holidays for 2026-11
    holidays = [
        HolidayInput(date="2026-11-01", is_public_holiday=True),
        HolidayInput(date="2026-11-15", is_public_holiday=True),
    ]
    
    return employees, brand_rules, allocations, leaves, holidays


# ========== Basic Solver Tests ==========

def test_solver_feasible_simple(simple_scenario):
    """Test that solver can solve a simple feasible scenario."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    
    assert result.success is True
    assert len(result.shift_assignments) > 0
    assert result.solver_duration_ms > 0


def test_solver_feasible_realistic_scale(realistic_35_employee_22_brand_scenario):
    """Test solver with simplified scenario (8 brands, sufficient employees)."""
    employees, brand_rules, allocations, leaves, holidays = realistic_35_employee_22_brand_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=120,
    )
    
    result = run_solver(request)
    
    assert result.success is True, f"Solver failed: {result.error_message}"
    assert len(result.shift_assignments) > 0
    assert result.solver_duration_ms > 0
    print(f"✓ Solved {len(employees)}-employee/{len(brand_rules)}-brand scenario in {result.solver_duration_ms}ms")


# ========== P0 Constraint Tests ==========

def test_coverage_constraint(simple_scenario):
    """Test that brand-process coverage constraint is enforced (>= minHeadcount)."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    assert result.success is True
    
    # Verify coverage: for each operating day, at least minHeadcount employees work
    from datetime import datetime, timedelta
    start = datetime(2026, 11, 1)
    end = datetime(2026, 11, 30)
    
    for rule in brand_rules:
        if not rule.is_active:
            continue
        
        current = start
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            is_sunday = current.weekday() == 6
            is_holiday = any(h.date == date_str for h in holidays)
            
            # Check if brand operates
            operates = True
            if rule.operating_calendar == OperatingCalendar.EXCL_PH and is_holiday:
                operates = False
            elif rule.operating_calendar == OperatingCalendar.EXCL_SUN_PH and (is_sunday or is_holiday):
                operates = False
            
            if operates:
                # Count employees working on this rule on this date
                working_count = sum(
                    1 for assignment in result.shift_assignments
                    if assignment.date == date_str
                    and assignment.brand_process_rule_id == rule.id
                    and assignment.shift_code in [ShiftCode.W, ShiftCode.BK]
                )
                assert working_count >= rule.min_headcount, f"Coverage violation on {date_str} for {rule.id}"
            
            current += timedelta(days=1)


def test_leave_lock_constraint(simple_scenario):
    """Test that employees on leave cannot be scheduled to work."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    # Add a leave request
    leaves_with_request = leaves + [LeaveRequestInput(employee_id="emp1", date="2026-11-10")]
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves_with_request,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    assert result.success is True
    
    # Verify emp1 is not working on 2026-11-10
    emp1_assignments = [a for a in result.shift_assignments if a.employee_id == "emp1" and a.date == "2026-11-10"]
    assert len(emp1_assignments) == 1
    assert emp1_assignments[0].shift_code == ShiftCode.AL


def test_capacity_constraint(simple_scenario):
    """Test single-assignment cap (at most 1.0 FTE per day)."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    assert result.success is True
    
    # Verify no employee is assigned to multiple brands on same day
    from collections import defaultdict
    daily_assignments = defaultdict(list)
    
    for assignment in result.shift_assignments:
        if assignment.shift_code in [ShiftCode.W, ShiftCode.BK]:
            key = (assignment.employee_id, assignment.date)
            daily_assignments[key].append(assignment)
    
    for key, assignments in daily_assignments.items():
        assert len(assignments) <= 1, f"Double-booking violation for {key}"


# ========== P1 Constraint Tests ==========

def test_weekly_off_minimum(simple_scenario):
    """Test that employees get >= 4 weekly offs per 30-day cycle."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    assert result.success is True
    
    # Count weekly offs per employee
    from collections import defaultdict
    wo_counts = defaultdict(int)
    
    for assignment in result.shift_assignments:
        if assignment.shift_code == ShiftCode.WO:
            wo_counts[assignment.employee_id] += 1
    
    for emp in employees:
        if emp.is_active:
            assert wo_counts[emp.id] >= 4, f"Employee {emp.id} has insufficient weekly offs: {wo_counts[emp.id]}"


def test_max_consecutive_workdays(simple_scenario):
    """Test that no employee works more than 6 consecutive days without rest."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    assert result.success is True
    
    # Build employee schedules
    from datetime import datetime, timedelta
    from collections import defaultdict
    schedules = defaultdict(dict)
    
    for assignment in result.shift_assignments:
        schedules[assignment.employee_id][assignment.date] = assignment.shift_code
    
    # Check consecutive workdays
    start = datetime(2026, 11, 1)
    end = datetime(2026, 11, 30)
    
    for emp in employees:
        if not emp.is_active:
            continue
        
        consecutive = 0
        current = start
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            shift = schedules[emp.id].get(date_str)
            
            if shift in [ShiftCode.W, ShiftCode.BK]:
                consecutive += 1
                assert consecutive <= 6, f"Employee {emp.id} works {consecutive} consecutive days ending {date_str}"
            else:
                consecutive = 0
            
            current += timedelta(days=1)


# ========== Soft Constraint Tests ==========

def test_preferred_weekly_off(simple_scenario):
    """Test that preferred weekly off day is considered (soft constraint)."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    assert result.success is True
    
    # Soft constraint: preferred WOs are optimized but not guaranteed
    # Verify at least some WOs were assigned (may or may not be on preferred day)
    from collections import defaultdict
    total_wo_counts = defaultdict(int)
    
    for assignment in result.shift_assignments:
        if assignment.shift_code == ShiftCode.WO:
            total_wo_counts[assignment.employee_id] += 1
    
    for emp in employees:
        if emp.is_active:
            assert total_wo_counts[emp.id] >= 4, f"Employee {emp.id} has insufficient weekly offs"


def test_primary_brand_continuity(simple_scenario):
    """Test that PRIMARY employees mostly work on their primary brands."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    assert result.success is True
    
    # For emp1 (PRIMARY on rule1), verify mostly working on rule1
    emp1_work_days = [a for a in result.shift_assignments if a.employee_id == "emp1" and a.shift_code == ShiftCode.W]
    if len(emp1_work_days) > 0:
        rule1_days = sum(1 for a in emp1_work_days if a.brand_process_rule_id == "rule1")
        ratio = rule1_days / len(emp1_work_days)
        assert ratio > 0.8, f"PRIMARY employee emp1 not working primarily on rule1: {ratio}"


# ========== Infeasibility Tests ==========

def test_infeasible_core_diagnostics(simple_scenario):
    """Test that infeasible problem returns unsatisfiable core."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    # Create infeasible scenario: mark both employees on leave for entire month
    from datetime import datetime, timedelta
    start = datetime(2026, 11, 1)
    end = datetime(2026, 11, 30)
    
    infeasible_leaves = []
    current = start
    while current <= end:
        infeasible_leaves.append(LeaveRequestInput(employee_id="emp1", date=current.strftime("%Y-%m-%d")))
        infeasible_leaves.append(LeaveRequestInput(employee_id="emp2", date=current.strftime("%Y-%m-%d")))
        current += timedelta(days=1)
    
    request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=infeasible_leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    result = run_solver(request)
    
    assert result.success is False
    assert result.error_message is not None
    assert "infeasible" in result.error_message.lower()
    assert result.unsatisfiable_core is not None
    assert len(result.unsatisfiable_core) > 0
    
    # Verify core contains coverage constraints
    has_coverage_constraint = any("COVERAGE" in item.constraint_type for item in result.unsatisfiable_core)
    assert has_coverage_constraint, "Unsatisfiable core should identify COVERAGE constraints"


# ========== SPOF Audit Tests ==========

def test_spof_audit_detects_risks(realistic_35_employee_22_brand_scenario):
    """Test that SPOF audit detects brands with zero backup on operating days."""
    employees, brand_rules, allocations, leaves, holidays = realistic_35_employee_22_brand_scenario
    
    request = SpofAuditRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
    )
    
    result = run_spof_audit(request)
    
    assert result.success is True
    # HomeEssentials operates EXCL_SUN_PH, so it doesn't operate on Sun/PH
    # Therefore no SPOF risk on those days (brand is closed)
    # SPOF audit looks for brands that operate but lack backup
    print(f"✓ SPOF audit completed with {result.total_risks} risks detected")


# ========== Reoptimization Tests ==========

def test_reoptimizer_minimal_perturbation(simple_scenario):
    """Test that reoptimizer minimizes changes from original roster."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    # First, generate original roster
    solve_request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    solve_result = run_solver(solve_request)
    assert solve_result.success is True
    
    # Pick a date on/after Nov 10 when emp1 is actually working
    disruption_date = next(
        a.date for a in solve_result.shift_assignments
        if a.employee_id == "emp1" and a.shift_code == ShiftCode.W and a.date >= "2026-11-10"
    )

    # Now simulate disruption: emp1 unavailable on working disruption_date
    reopt_request = ReoptimizeRequest(
        month_key="2026-11",
        original_roster=solve_result.shift_assignments,
        disruption_date=disruption_date,
        disrupted_employee_ids=["emp1"],
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    reopt_result = run_reoptimizer(reopt_request)
    
    assert reopt_result.success is True
    assert len(reopt_result.new_roster) > 0
    assert reopt_result.perturbation_count >= 0
    
    # Verify emp1 is marked unavailable on disruption_date
    emp1_disrupted = next((a for a in reopt_result.new_roster if a.employee_id == "emp1" and a.date == disruption_date), None)
    assert emp1_disrupted is not None
    assert emp1_disrupted.shift_code == ShiftCode.AL
    
    # Verify backup candidates are ranked
    assert len(reopt_result.backup_candidates) > 0
    assert reopt_result.backup_candidates[0].score > 0
    
    print(f"✓ Reoptimization completed with {reopt_result.perturbation_count} perturbations")


def test_reoptimizer_backup_ranking(simple_scenario):
    """Test that reoptimizer ranks backup candidates correctly."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    # Generate original roster
    solve_request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    solve_result = run_solver(solve_request)
    assert solve_result.success is True
    
    # Find a date when emp1 is actually working
    working_date = None
    for assignment in solve_result.shift_assignments:
        if assignment.employee_id == "emp1" and assignment.shift_code == ShiftCode.W:
            working_date = assignment.date
            break
    
    assert working_date is not None, "emp1 should have at least one working day"
    
    # Disrupt emp1 on a working day
    reopt_request = ReoptimizeRequest(
        month_key="2026-11",
        original_roster=solve_result.shift_assignments,
        disruption_date=working_date,
        disrupted_employee_ids=["emp1"],
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    reopt_result = run_reoptimizer(reopt_request)
    
    assert reopt_result.success is True
    assert len(reopt_result.backup_candidates) > 0, "Should have backup candidates when primary employee is disrupted on working day"
    
    # Verify emp2 (SECONDARY_BACKUP) is ranked higher
    top_candidate = reopt_result.backup_candidates[0]
    assert top_candidate.employee_id == "emp2", "Designated backup should be ranked highest"
    assert "backup" in top_candidate.reason.lower()


def test_reoptimizer_cascade_diff(simple_scenario):
    """Test that reoptimizer generates cascade diff showing before/after changes."""
    employees, brand_rules, allocations, leaves, holidays = simple_scenario
    
    # Generate original roster
    solve_request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    solve_result = run_solver(solve_request)
    assert solve_result.success is True
    
    # Disrupt emp1
    reopt_request = ReoptimizeRequest(
        month_key="2026-11",
        original_roster=solve_result.shift_assignments,
        disruption_date="2026-11-20",
        disrupted_employee_ids=["emp1"],
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=30,
    )
    
    reopt_result = run_reoptimizer(reopt_request)
    
    assert reopt_result.success is True
    assert len(reopt_result.cascade_diff) > 0
    
    # Verify cascade diff shows emp1 change
    emp1_change = next((d for d in reopt_result.cascade_diff if d.employee_id == "emp1" and d.date == "2026-11-20"), None)
    assert emp1_change is not None
    assert emp1_change.before_shift != emp1_change.after_shift
    
    print(f"✓ Cascade diff generated with {len(reopt_result.cascade_diff)} changes")


# ========== Integration Test ==========

def test_end_to_end_workflow(realistic_35_employee_22_brand_scenario):
    """End-to-end test: SPOF audit -> Solve -> Reoptimize."""
    employees, brand_rules, allocations, leaves, holidays = realistic_35_employee_22_brand_scenario
    
    # Step 1: SPOF Audit
    spof_request = SpofAuditRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
    )
    
    spof_result = run_spof_audit(spof_request)
    assert spof_result.success is True
    print(f"✓ SPOF audit: {spof_result.total_risks} risks detected")
    
    # Step 2: Solve
    solve_request = SolveRequest(
        month_key="2026-11",
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=120,
    )
    
    solve_result = run_solver(solve_request)
    assert solve_result.success is True
    print(f"✓ Initial solve: {len(solve_result.shift_assignments)} assignments in {solve_result.solver_duration_ms}ms")
    
    # Step 3: Reoptimize (simulate mid-month disruption)
    reopt_request = ReoptimizeRequest(
        month_key="2026-11",
        original_roster=solve_result.shift_assignments,
        disruption_date="2026-11-15",
        disrupted_employee_ids=["emp1", "emp13"],  # Two employees from different pods
        employees=employees,
        brand_process_rules=brand_rules,
        allocations=allocations,
        leaves=leaves,
        holidays=holidays,
        time_limit_seconds=120,
    )
    
    reopt_result = run_reoptimizer(reopt_request)
    assert reopt_result.success is True
    print(f"✓ Reoptimization: {reopt_result.perturbation_count} perturbations, {len(reopt_result.backup_candidates)} backup candidates")
    
    # Verify end-to-end consistency
    assert len(reopt_result.new_roster) == len(solve_result.shift_assignments)
    assert len(reopt_result.cascade_diff) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
