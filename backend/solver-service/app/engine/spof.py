"""SPOF (Single Point of Failure) Bus-Factor Radar Audit."""

from typing import List, Dict, Set
from datetime import datetime, timedelta
from app.models import (
    SpofAuditRequest,
    SpofAuditResponse,
    SpofAuditItem,
    OperatingCalendar,
    AssignmentType,
    ProcessType,
)


def run_spof_audit(request: SpofAuditRequest) -> SpofAuditResponse:
    """
    Pre-flight Bus Factor / SPOF Radar audit.
    Flags brand-process pairs with zero backup redundancy on Sundays or public holidays.
    """
    try:
        # Parse month_key to get all dates in the month
        year, month = map(int, request.month_key.split("-"))
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)

        all_dates = []
        current = start_date
        while current <= end_date:
            all_dates.append(current)
            current += timedelta(days=1)

        # Build holiday set
        holiday_dates = {datetime.strptime(h.date, "%Y-%m-%d") for h in request.holidays if h.is_public_holiday}

        # Build leave map: employee_id -> set of leave dates
        leave_map: Dict[str, Set[datetime]] = {}
        for leave in request.leaves:
            emp_id = leave.employee_id
            leave_date = datetime.strptime(leave.date, "%Y-%m-%d")
            if emp_id not in leave_map:
                leave_map[emp_id] = set()
            leave_map[emp_id].add(leave_date)

        # Build allocation map: brand_process_rule_id -> list of (employee, assignment_type, weight)
        allocation_map: Dict[str, List[tuple]] = {}
        for alloc in request.allocations:
            rule_id = alloc.brand_process_rule_id
            if rule_id not in allocation_map:
                allocation_map[rule_id] = []
            allocation_map[rule_id].append((alloc.employee_id, alloc.assignment_type, alloc.allocation_weight))

        # Employee map for quick lookup
        employee_map = {emp.id: emp for emp in request.employees}

        spof_items: List[SpofAuditItem] = []

        # Check each brand-process rule
        for rule in request.brand_process_rules:
            if not rule.is_active:
                continue

            # Determine risk dates based on operating_calendar
            risk_dates = []
            for date in all_dates:
                is_sunday = date.weekday() == 6
                is_holiday = date in holiday_dates

                if rule.operating_calendar == OperatingCalendar.EXCL_SUN_PH:
                    # Brand operates only when it's NOT (Sunday OR Holiday)
                    # So risk is on Sundays and Holidays when brand shouldn't operate
                    # But SPOF is about coverage when brand DOES operate
                    # So we check: can brand cover days when it operates?
                    # For EXCL_SUN_PH, brand does NOT operate on Sun/PH, so no coverage needed there
                    # SPOF risk is on days when brand operates but has no backup
                    if is_sunday or is_holiday:
                        continue  # Brand doesn't operate, no coverage needed
                elif rule.operating_calendar == OperatingCalendar.EXCL_PH:
                    if is_holiday:
                        continue  # Brand doesn't operate on PH
                # ALL_365 operates every day

                # Now check if we have backup redundancy for this date
                available_employees = []
                allocations = allocation_map.get(rule.id, [])

                for emp_id, assignment_type, weight in allocations:
                    emp = employee_map.get(emp_id)
                    if not emp or not emp.is_active:
                        continue
                    # Check if employee is on leave
                    if emp_id in leave_map and date in leave_map[emp_id]:
                        continue
                    # Check if employee has required skill
                    if rule.process not in emp.process_skill_tags:
                        continue
                    available_employees.append((emp_id, assignment_type, weight))

                # Count PRIMARY and BACKUP resources
                primary_count = sum(1 for _, atype, _ in available_employees if atype == AssignmentType.PRIMARY)
                backup_count = sum(1 for _, atype, _ in available_employees if atype == AssignmentType.SECONDARY_BACKUP)

                # SPOF risk: zero backup redundancy on operating day (especially Sundays/PH or single-resource brands)
                if primary_count > 0 and backup_count == 0 and len(available_employees) <= rule.min_headcount:
                    risk_dates.append(date.strftime("%Y-%m-%d"))

            if risk_dates:
                has_sunday_or_ph = any(
                    datetime.strptime(d, "%Y-%m-%d").weekday() == 6 or datetime.strptime(d, "%Y-%m-%d") in holiday_dates
                    for d in risk_dates
                )
                risk_level = "HIGH" if (has_sunday_or_ph or len(risk_dates) >= 10) else "MEDIUM"
                description = (
                    f"Brand '{rule.brand_name}' process '{rule.process.value}' has zero backup redundancy "
                    f"(Bus Factor = 1) on {len(risk_dates)} operating dates"
                    + (" including Sundays/Holidays." if has_sunday_or_ph else ".")
                )
                spof_items.append(
                    SpofAuditItem(
                        brand_id=rule.brand_id,
                        brand_name=rule.brand_name,
                        process=rule.process,
                        risk_level=risk_level,
                        description=description,
                        affected_dates=risk_dates,
                    )
                )

        return SpofAuditResponse(
            success=True,
            month_key=request.month_key,
            spof_items=spof_items,
            total_risks=len(spof_items),
        )

    except Exception as e:
        return SpofAuditResponse(
            success=False,
            month_key=request.month_key,
            spof_items=[],
            total_risks=0,
            error_message=f"SPOF audit failed: {str(e)}",
        )
