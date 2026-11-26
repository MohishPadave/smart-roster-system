/**
 * Roster generation endpoint
 * GET: Returns current roster for a month
 * POST: Generates new roster using solver
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { loadSolverData, callSolve, callSpofAudit } from '@/lib/solver-client';
import { ShiftCode, AuditLogEntry } from '@/types/roster';

export const maxDuration = 60;

const GenerateRequestSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  timeLimitSeconds: z.number().int().min(10).max(1800).optional(),
});

/**
 * GET: Retrieve existing roster for a month
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get('monthKey');

    if (!monthKey) {
      return NextResponse.json(
        { error: 'monthKey query parameter is required' },
        { status: 400 }
      );
    }

    const rosterVersion = await prisma.rosterVersion.findUnique({
      where: { monthKey },
      include: {
        shiftEntries: {
          include: {
            employee: { include: { pod: true } },
            brandProcessRule: { include: { brand: true } },
          },
        },
      },
    });

    if (!rosterVersion) {
      return NextResponse.json(
        { error: `No roster found for monthKey: ${monthKey}` },
        { status: 404 }
      );
    }

    // Load related entities
    const pods = await prisma.pod.findMany({ include: { podLead: true } });
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: { pod: true },
    });
    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      include: { pod: true },
    });
    const processRules = await prisma.brandProcessRule.findMany({
      where: { isActive: true },
      include: { brand: true },
    });
    const allocations = await prisma.employeeAllocation.findMany();

    const [year, month] = monthKey.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));

    const leaves = await prisma.leaveRequest.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { employee: true },
    });
    const holidays = await prisma.holidayCalendar.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });

    return NextResponse.json({
      rosterVersion: {
        id: rosterVersion.id,
        monthKey: rosterVersion.monthKey,
        status: rosterVersion.status,
        objectiveScore: rosterVersion.objectiveScore,
        solverDurationMs: rosterVersion.solverDurationMs,
        auditLogs: rosterVersion.auditLogs || [],
        shiftEntries: rosterVersion.shiftEntries,
        createdAt: rosterVersion.createdAt,
        updatedAt: rosterVersion.updatedAt,
      },
      pods,
      employees,
      brands,
      processRules,
      allocations,
      leaves,
      holidays,
    });
  } catch (error) {
    console.error('GET /api/roster/generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Generate new roster using solver
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { monthKey, timeLimitSeconds } = GenerateRequestSchema.parse(body);

    // Load all data
    const solverData = await loadSolverData(monthKey);

    // Run SPOF audit first
    const spofAudit = await callSpofAudit({
      month_key: monthKey,
      employees: solverData.employees,
      brand_process_rules: solverData.brandProcessRules,
      allocations: solverData.allocations,
      leaves: solverData.leaves,
      holidays: solverData.holidays,
    });

    // Run solver
    const solveResponse = await callSolve({
      month_key: monthKey,
      employees: solverData.employees,
      brand_process_rules: solverData.brandProcessRules,
      allocations: solverData.allocations,
      leaves: solverData.leaves,
      holidays: solverData.holidays,
      time_limit_seconds: timeLimitSeconds || 300,
    });

    if (!solveResponse.success) {
      // Solver failed - return diagnostics
      return NextResponse.json(
        {
          success: false,
          error: solveResponse.error_message,
          unsatisfiable_core: solveResponse.unsatisfiable_core,
          spof_audit: spofAudit,
        },
        { status: 422 }
      );
    }

    // Solver succeeded - persist roster
    const auditLog: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      actor: 'SYSTEM',
      action: 'GENERATE',
      details: `Generated roster using solver (objective: ${solveResponse.objective_score}, duration: ${solveResponse.solver_duration_ms}ms)`,
      affectedEntities: [monthKey],
    };

    // Upsert RosterVersion
    const rosterVersion = await prisma.rosterVersion.upsert({
      where: { monthKey },
      create: {
        monthKey,
        status: 'DRAFT',
        objectiveScore: solveResponse.objective_score,
        solverDurationMs: solveResponse.solver_duration_ms,
        auditLogs: [auditLog] as unknown as Prisma.InputJsonValue,
      },
      update: {
        objectiveScore: solveResponse.objective_score,
        solverDurationMs: solveResponse.solver_duration_ms,
        auditLogs: [auditLog] as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Delete old shift entries and insert new ones
    await prisma.shiftEntry.deleteMany({
      where: { rosterVersionId: rosterVersion.id },
    });

    await prisma.shiftEntry.createMany({
      data: solveResponse.shift_assignments.map((assignment) => ({
        rosterVersionId: rosterVersion.id,
        employeeId: assignment.employee_id,
        date: assignment.date,
        shiftCode: assignment.shift_code as ShiftCode,
        brandProcessRuleId: assignment.brand_process_rule_id,
        notes: assignment.notes,
        isLocked: false,
      })),
    });

    // Return success response
    return NextResponse.json({
      success: true,
      rosterVersionId: rosterVersion.id,
      monthKey,
      objectiveScore: solveResponse.objective_score,
      solverDurationMs: solveResponse.solver_duration_ms,
      totalShifts: solveResponse.shift_assignments.length,
      spofAudit,
    });
  } catch (error) {
    console.error('POST /api/roster/generate error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
