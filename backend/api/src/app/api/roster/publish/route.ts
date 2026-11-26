/**
 * Roster publish/unlock endpoint
 * Toggles roster status between DRAFT and PUBLISHED
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { validateRosterEdits } from '@/lib/validator';
import { AuditLogEntry, RosterStatus } from '@/types/roster';

const PublishRequestSchema = z.object({
  rosterVersionId: z.string(),
  action: z.enum(['PUBLISH', 'UNLOCK']),
  actorName: z.string(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rosterVersionId, action, actorName, notes } = PublishRequestSchema.parse(body);

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

    if (action === 'PUBLISH') {
      // Validate before publishing
      const validation = await validateRosterEdits(rosterVersionId, []);

      const p0p1Violations =
        validation.violations.filter((v) => v.severity === 'P0' || v.severity === 'P1')
          .length + validation.coverageGaps.length;

      if (p0p1Violations > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot publish roster with P0/P1 violations',
            validation,
          },
          { status: 422 }
        );
      }

      // Publish roster
      const existingLogs = (rosterVersion.auditLogs as unknown as AuditLogEntry[]) || [];
      const newLog: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        actor: actorName,
        action: 'PUBLISH',
        details: notes || 'Roster published for pod lead sign-off',
        affectedEntities: [rosterVersion.monthKey],
      };

      await prisma.rosterVersion.update({
        where: { id: rosterVersionId },
        data: {
          status: 'PUBLISHED' as RosterStatus,
          auditLogs: [...existingLogs, newLog] as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Roster published successfully',
        rosterVersionId,
        status: 'PUBLISHED',
      });
    } else if (action === 'UNLOCK') {
      // Unlock (unpublish) roster
      const existingLogs = (rosterVersion.auditLogs as unknown as AuditLogEntry[]) || [];
      const newLog: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        actor: actorName,
        action: 'UNLOCK',
        details: notes || 'Roster unlocked for edits',
        affectedEntities: [rosterVersion.monthKey],
      };

      await prisma.rosterVersion.update({
        where: { id: rosterVersionId },
        data: {
          status: 'DRAFT' as RosterStatus,
          auditLogs: [...existingLogs, newLog] as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Roster unlocked successfully',
        rosterVersionId,
        status: 'DRAFT',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('POST /api/roster/publish error:', error);

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
