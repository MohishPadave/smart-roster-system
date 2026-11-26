/**
 * Employees CRUD Endpoint
 * GET: list all employees
 * POST: create a new employee
 * PATCH: update an employee
 * DELETE: delete an employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Process, RoleType } from '@prisma/client';

const CreateEmployeeSchema = z.object({
  name: z.string().min(1, 'Employee name is required'),
  email: z.string().email('Invalid email address'),
  podId: z.string().min(1, 'Pod ID is required'),
  roleType: z.nativeEnum(RoleType),
  preferredWeeklyOff: z.number().int().min(0).max(6).default(0),
  maxDailyCapacity: z.number().min(0).max(1).default(1.0),
  processSkillTags: z.array(z.nativeEnum(Process)).default([]),
  isActive: z.boolean().default(true),
});

const UpdateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  podId: z.string().optional(),
  roleType: z.nativeEnum(RoleType).optional(),
  preferredWeeklyOff: z.number().int().min(0).max(6).optional(),
  maxDailyCapacity: z.number().min(0).max(1).optional(),
  processSkillTags: z.array(z.nativeEnum(Process)).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        pod: {
          select: { id: true, name: true },
        },
        _count: {
          select: { allocations: true, leaveRequests: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('GET /api/entities/employees error:', error);
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
    const validation = CreateEmployeeSchema.safeParse(body);

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

    // Check for duplicate email
    const existing = await prisma.employee.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json(
        { error: 'Employee with this email already exists' },
        { status: 409 }
      );
    }

    // Verify pod exists
    const pod = await prisma.pod.findUnique({ where: { id: data.podId } });
    if (!pod) {
      return NextResponse.json(
        { error: 'Pod not found' },
        { status: 404 }
      );
    }

    const employee = await prisma.employee.create({
      data,
      include: {
        pod: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entities/employees error:', error);
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
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    const validation = UpdateEmployeeSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if employee exists
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Check for email conflict if changing email
    if (validation.data.email && validation.data.email !== existing.email) {
      const conflict = await prisma.employee.findUnique({ where: { email: validation.data.email } });
      if (conflict) {
        return NextResponse.json(
          { error: 'Employee with this email already exists' },
          { status: 409 }
        );
      }
    }

    // If changing pod, verify new pod exists
    if (validation.data.podId) {
      const pod = await prisma.pod.findUnique({ where: { id: validation.data.podId } });
      if (!pod) {
        return NextResponse.json(
          { error: 'Pod not found' },
          { status: 404 }
        );
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: validation.data,
      include: {
        pod: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('PATCH /api/entities/employees error:', error);
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
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      include: {
        _count: { select: { allocations: true, leaveRequests: true, shiftEntries: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Warn if employee has existing data (but allow deletion due to Cascade)
    if (existing._count.allocations > 0 || existing._count.leaveRequests > 0 || existing._count.shiftEntries > 0) {
      console.warn(`Deleting employee ${id} with ${existing._count.allocations} allocations, ${existing._count.leaveRequests} leaves, ${existing._count.shiftEntries} shifts`);
    }

    await prisma.employee.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    console.error('DELETE /api/entities/employees error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
