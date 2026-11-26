/**
 * Leave Requests CRUD Endpoint
 * GET: list all leave requests
 * POST: create a new leave request
 * PATCH: update a leave request
 * DELETE: delete a leave request
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { LeaveType, LeaveStatus } from '@prisma/client';

const CreateLeaveSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  type: z.nativeEnum(LeaveType),
  status: z.nativeEnum(LeaveStatus).default(LeaveStatus.APPROVED),
  reason: z.string().optional().nullable(),
});

const UpdateLeaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.nativeEnum(LeaveType).optional(),
  status: z.nativeEnum(LeaveStatus).optional(),
  reason: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as LeaveStatus | null;

    const leaves = await prisma.leaveRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        employee: {
          select: { id: true, name: true, email: true, pod: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }],
    });

    return NextResponse.json({ leaves });
  } catch (error) {
    console.error('GET /api/entities/leaves error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = CreateLeaveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify employee exists
    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Parse date
    const dateObj = new Date(data.date + 'T00:00:00.000Z');

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        date: dateObj,
        type: data.type,
        status: data.status,
        reason: data.reason || null,
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, pod: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ leave }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entities/leaves error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Leave request ID is required' },
        { status: 400 }
      );
    }

    const validation = UpdateLeaveSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if leave request exists
    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (validation.data.date) {
      updateData.date = new Date(validation.data.date + 'T00:00:00.000Z');
    }
    if (validation.data.type !== undefined) {
      updateData.type = validation.data.type;
    }
    if (validation.data.status !== undefined) {
      updateData.status = validation.data.status;
    }
    if (validation.data.reason !== undefined) {
      updateData.reason = validation.data.reason;
    }

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: { id: true, name: true, email: true, pod: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ leave });
  } catch (error) {
    console.error('PATCH /api/entities/leaves error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Leave request ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    await prisma.leaveRequest.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Leave request deleted' });
  } catch (error) {
    console.error('DELETE /api/entities/leaves error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
