/**
 * Roster disruption simulation endpoint
 * Reoptimizes roster after employee disruptions (leaves, emergencies)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  loadSolverData,
  loadCurrentRoster,
  callReoptimize,
} from '@/lib/solver-client';
import { ShiftCode, AuditLogEntry } from '@/types/roster';

const SimulateRequestSchema = z.object({
  rosterVersionId: z.string(),
  disruptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  disruptedEmployeeIds: z.array(z.string()),
  commit: z.boolean().optional(),
  actorName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rosterVersionId, disruptionDate, disruptedEmployeeIds, commit, actorName } =
      SimulateRequestSchema.parse(body);

    // Load roster version
    const rosterVersion = await prisma.rosterVersion.findUnique({
      where: { id: rosterVersionId },
    });

    if (!rosterVersion) {
      return NextResponse.json(
        { error: 'RosterVersion not found' },
        { status: 404 }
      );
    }

    // Load current roster
    const originalRoster = await loadCurrentRoster(rosterVersionId);

    // Load solver data
    const solverData = await loadSolverData(rosterVersion.monthKey);

    // Call reoptimize solver
    const reoptimizeResponse = await callReoptimize({
      month_key: rosterVersion.monthKey,
      original_roster: originalRoster,
      disruption_date: disruptionDate,
      disrupted_employee_ids: disruptedEmployeeIds,
      employees: solverData.employees,
      brand_process_rules: solverData.brandProcessRules,
      allocations: solverData.allocations,
      leaves: solverData.leaves,
      holidays: solverData.holidays,
      time_limit_seconds: 180,
    });

    if (!reoptimizeResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: reoptimizeResponse.error_message,
        },
        { status: 422 }
      );
    }

    if (commit) {
      // Apply new roster
      await prisma.shiftEntry.deleteMany({
        where: { rosterVersionId },
      });

      await prisma.shiftEntry.createMany({
        data: reoptimizeResponse.new_roster.map((assignment) => ({
          rosterVersionId,
          employeeId: assignment.employee_id,
          date: assignment.date,
          shiftCode: assignment.shift_code as ShiftCode,
          brandProcessRuleId: assignment.brand_process_rule_id,
          notes: assignment.notes,
          isLocked: false,
        })),
      });

      // Append audit log
      const existingLogs = (rosterVersion.auditLogs as unknown as AuditLogEntry[]) || [];
      const newLog: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        actor: actorName || 'SYSTEM',
        action: 'REOPTIMIZE',
        details: `Reoptimized after disruption on ${disruptionDate} (${disruptedEmployeeIds.length} employees, ${reoptimizeResponse.perturbation_count} changes)`,
        affectedEntities: disruptedEmployeeIds,
      };

      await prisma.rosterVersion.update({
        where: { id: rosterVersionId },
        data: {
          objectiveScore: reoptimizeResponse.objective_score,
          solverDurationMs: reoptimizeResponse.solver_duration_ms,
          auditLogs: [...existingLogs, newLog] as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Roster reoptimized and committed',
        backup_candidates: reoptimizeResponse.backup_candidates,
        cascade_diff: reoptimizeResponse.cascade_diff,
        perturbation_count: reoptimizeResponse.perturbation_count,
        objective_score: reoptimizeResponse.objective_score,
        solver_duration_ms: reoptimizeResponse.solver_duration_ms,
      });
    }

    // Dry-run simulation only
    return NextResponse.json({
      success: true,
      message: 'Simulation completed (dry-run)',
      backup_candidates: reoptimizeResponse.backup_candidates,
      cascade_diff: reoptimizeResponse.cascade_diff,
      perturbation_count: reoptimizeResponse.perturbation_count,
      objective_score: reoptimizeResponse.objective_score,
      solver_duration_ms: reoptimizeResponse.solver_duration_ms,
    });
  } catch (error) {
    console.error('POST /api/roster/simulate error:', error);

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
