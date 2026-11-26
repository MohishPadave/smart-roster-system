/**
 * Dashboard SPOF Analytics Endpoint
 * GET ?monthKey=2026-11
 * Returns executive KPIs from Prisma and calls SPOF audit via solver
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadSolverData, callSpofAudit } from '@/lib/solver-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const monthKey = searchParams.get('monthKey');

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { error: 'Invalid or missing monthKey parameter. Expected format: YYYY-MM' },
        { status: 400 }
      );
    }

    // Compute KPIs from Prisma
    const [
      totalPods,
      totalEmployees,
      activeEmployees,
      roleBreakdown,
      totalBrands,
      activeBrands,
      brandsWithDetails,
      totalProcessRules,
      totalAllocations,
      pendingLeaves,
      approvedLeaves,
      holidaysCount,
      latestRosterVersion,
    ] = await Promise.all([
      prisma.pod.count(),
      prisma.employee.count(),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.employee.groupBy({
        by: ['roleType'],
        _count: { roleType: true },
        where: { isActive: true },
      }),
      prisma.brand.count(),
      prisma.brand.count({ where: { isActive: true } }),
      prisma.brand.findMany({
        where: { isActive: true },
        include: {
          processRules: {
            where: { isActive: true },
            include: { allocations: true },
          },
        },
      }),
      prisma.brandProcessRule.count(),
      prisma.employeeAllocation.count(),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { status: 'APPROVED' } }),
      prisma.holidayCalendar.count(),
      prisma.rosterVersion.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { status: true, monthKey: true },
      }),
    ]);

    // Compute single-resource vs multi-resource brands (80/20 split)
    let singleResourceBrands = 0;
    let multiResourceBrands = 0;
    for (const brand of brandsWithDetails) {
      const primaryEmpIds = new Set(
        brand.processRules.flatMap((r) =>
          r.allocations.filter((a) => a.assignmentType === 'PRIMARY').map((a) => a.employeeId)
        )
      );
      if (brand.processRules.length > 1 || primaryEmpIds.size > 1) {
        multiResourceBrands++;
      } else {
        singleResourceBrands++;
      }
    }

    const roleBreakdownMap = roleBreakdown.reduce(
      (acc, item) => {
        acc[item.roleType] = item._count.roleType;
        return acc;
      },
      { DEDICATED: 0, SHARED: 0, FLOAT_BACKUP: 0 } as Record<string, number>
    );

    // Attempt SPOF audit via solver
    let spofAudit = null;
    let solverHealthy = false;

    try {
      const solverData = await loadSolverData(monthKey);
      const spofResponse = await callSpofAudit({
        month_key: monthKey,
        employees: solverData.employees,
        brand_process_rules: solverData.brandProcessRules,
        allocations: solverData.allocations,
        leaves: solverData.leaves,
        holidays: solverData.holidays,
      });

      if (spofResponse.success) {
        spofAudit = spofResponse.spof_items;
        solverHealthy = true;
      }
    } catch (error) {
      console.warn('Solver offline or failed for SPOF audit:', error);
      // Gracefully degrade: return KPIs without SPOF audit
    }

    return NextResponse.json({
      monthKey,
      kpis: {
        totalPods,
        totalEmployees,
        activeEmployees,
        roleBreakdown: roleBreakdownMap,
        totalBrands,
        activeBrands,
        singleResourceBrands,
        multiResourceBrands,
        totalProcessRules,
        totalAllocations,
        pendingLeaves,
        approvedLeaves,
        holidaysCount,
        latestRosterStatus: latestRosterVersion?.status || null,
      },
      solverHealthy,
      spofAudit: spofAudit || [],
    });
  } catch (error) {
    console.error('Dashboard SPOF endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
