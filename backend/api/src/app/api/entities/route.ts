/**
 * Entities Overview Endpoint
 * GET: returns summary counts + links, or full snapshot if ?include=all
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeAll = searchParams.get('include') === 'all';

    if (!includeAll) {
      // Return summary counts + navigation links
      const [
        podsCount,
        employeesCount,
        brandsCount,
        rulesCount,
        allocationsCount,
        leavesCount,
        holidaysCount,
      ] = await Promise.all([
        prisma.pod.count(),
        prisma.employee.count(),
        prisma.brand.count(),
        prisma.brandProcessRule.count(),
        prisma.employeeAllocation.count(),
        prisma.leaveRequest.count(),
        prisma.holidayCalendar.count(),
      ]);

      return NextResponse.json({
        summary: {
          pods: podsCount,
          employees: employeesCount,
          brands: brandsCount,
          rules: rulesCount,
          allocations: allocationsCount,
          leaves: leavesCount,
          holidays: holidaysCount,
        },
        links: {
          pods: '/api/entities/pods',
          employees: '/api/entities/employees',
          brands: '/api/entities/brands',
          rules: '/api/entities/rules',
          allocations: '/api/entities/allocations',
          leaves: '/api/entities/leaves',
          holidays: '/api/entities/holidays',
        },
      });
    }

    // Return full snapshot
    const [pods, employees, brands, rules, allocations, leaves, holidays] = await Promise.all([
      prisma.pod.findMany({
        include: {
          podLead: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.employee.findMany({
        include: {
          pod: { select: { id: true, name: true } },
        },
      }),
      prisma.brand.findMany({
        include: {
          pod: { select: { id: true, name: true } },
        },
      }),
      prisma.brandProcessRule.findMany({
        include: {
          brand: { select: { id: true, name: true } },
        },
      }),
      prisma.employeeAllocation.findMany({
        include: {
          employee: { select: { id: true, name: true } },
          brandProcessRule: {
            include: {
              brand: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.leaveRequest.findMany({
        include: {
          employee: { select: { id: true, name: true } },
        },
      }),
      prisma.holidayCalendar.findMany(),
    ]);

    return NextResponse.json({
      pods,
      employees,
      brands,
      rules,
      allocations,
      leaves,
      holidays,
    });
  } catch (error) {
    console.error('Entities overview error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
