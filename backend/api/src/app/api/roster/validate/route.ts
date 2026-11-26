/**
 * Roster validation endpoint
 * Validates manual edits and optionally commits them
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { validateRosterEdits } from '@/lib/validator';
import { ShiftCode, AuditLogEntry } from '@/types/roster';

const ShiftEditSchema = z.object({
  employeeId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftCode: z.nativeEnum(ShiftCode),
  brandProcessRuleId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const ValidateRequestSchema = z.object({
  rosterVersionId: z.string(),
  edits: z.array(ShiftEditSchema),
  commit: z.boolean().optional(),
  actorName: z.string().optional(),
  forceUnlock: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rosterVersionId, edits, commit, actorName, forceUnlock } =
      ValidateRequestSchema.parse(body);

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

    // Check if roster is locked (PUBLISHED)
    if (rosterVersion.status === 'PUBLISHED' && !forceUnlock) {
      return NextResponse.json(
        {
          error: 'Roster is PUBLISHED and locked. Use forceUnlock=true or UNLOCK it first.',
        },
        { status: 409 }
      );
    }

    // Validate edits
    const validation = await validateRosterEdits(rosterVersionId, edits);

    if (commit) {
      // If validation passed or forceUnlock is true, commit changes
      if (!validation.valid && !forceUnlock) {
        return NextResponse.json(
          {
            success: false,
            message: 'Validation failed. Use forceUnlock=true to override.',
            validation,
          },
          { status: 422 }
        );
      }

      // Apply edits
      for (const edit of edits) {
        await prisma.shiftEntry.upsert({
          where: {
            rosterVersionId_employeeId_date: {
              rosterVersionId,
              employeeId: edit.employeeId,
              date: edit.date,
            },
          },
          create: {
            rosterVersionId,
            employeeId: edit.employeeId,
            date: edit.date,
            shiftCode: edit.shiftCode,
            brandProcessRuleId: edit.brandProcessRuleId || null,
            notes: edit.notes || null,
            isLocked: false,
          },
          update: {
            shiftCode: edit.shiftCode,
            brandProcessRuleId: edit.brandProcessRuleId || null,
            notes: edit.notes || null,
            updatedAt: new Date(),
          },
        });
      }

      // Append audit log
      const existingLogs = (rosterVersion.auditLogs as unknown as AuditLogEntry[]) || [];
      const newLog: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        actor: actorName || 'UNKNOWN',
        action: 'MANUAL_EDIT',
        details: `Applied ${edits.length} manual edits (validation: ${validation.valid ? 'PASS' : 'OVERRIDE'})`,
        affectedEntities: edits.map((e) => `${e.employeeId}:${e.date}`),
      };

      await prisma.rosterVersion.update({
        where: { id: rosterVersionId },
        data: {
          auditLogs: [...existingLogs, newLog] as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Edits committed successfully',
        validation,
        appliedEdits: edits.length,
      });
    }

    // Dry-run validation only
    return NextResponse.json({
      success: validation.valid,
      message: validation.valid
        ? 'Validation passed'
        : 'Validation failed - violations detected',
      validation,
    });
  } catch (error) {
    console.error('POST /api/roster/validate error:', error);

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
