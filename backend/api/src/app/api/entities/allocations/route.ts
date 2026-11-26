/**
 * Employee Allocations CRUD Endpoint
 * GET: list all allocations
 * POST: create a new allocation
 * PATCH: update an allocation
 * DELETE: delete an allocation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { AssignmentType } from '@prisma/client';

const CreateAllocationSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  brandProcessRuleId: z.string().min(1, 'Brand Process Rule ID is required'),
  assignmentType: z.nativeEnum(AssignmentType),
  allocationWeight: z.number().min(0).max(1).default(1.0),
});

const UpdateAllocationSchema = z.object({
  assignmentType: z.nativeEnum(AssignmentType).optional(),
  allocationWeight: z.number().min(0).max(1).optional(),
});

export async function GET() {
  try {
    const allocations = await prisma.employeeAllocation.findMany({
      include: {
        employee: {
          select: { id: true, name: true, email: true, roleType: true },
        },
        brandProcessRule: {
          include: {
            brand: {
              select: { id: true, name: true, pod: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: [{ employee: { name: 'asc' } }],
    });

    return NextResponse.json({ allocations });
  } catch (error) {
    console.error('GET /api/entities/allocations error:', error);
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
    const validation = CreateAllocationSchema.safeParse(body);

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

    // Verify brand process rule exists
    const rule = await prisma.brandProcessRule.findUnique({ where: { id: data.brandProcessRuleId } });
    if (!rule) {
      return NextResponse.json(
        { error: 'Brand process rule not found' },
        { status: 404 }
      );
    }

    // Check for duplicate allocation (employeeId + brandProcessRuleId must be unique)
    const existing = await prisma.employeeAllocation.findUnique({
      where: {
        employeeId_brandProcessRuleId: {
          employeeId: data.employeeId,
          brandProcessRuleId: data.brandProcessRuleId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Allocation for this employee and brand process rule already exists' },
        { status: 409 }
      );
    }

    const allocation = await prisma.employeeAllocation.create({
      data,
      include: {
        employee: {
          select: { id: true, name: true, email: true, roleType: true },
        },
        brandProcessRule: {
          include: {
            brand: {
              select: { id: true, name: true, pod: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json({ allocation }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entities/allocations error:', error);
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
        { error: 'Allocation ID is required' },
        { status: 400 }
      );
    }

    const validation = UpdateAllocationSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if allocation exists
    const existing = await prisma.employeeAllocation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Allocation not found' },
        { status: 404 }
      );
    }

    const allocation = await prisma.employeeAllocation.update({
      where: { id },
      data: validation.data,
      include: {
        employee: {
          select: { id: true, name: true, email: true, roleType: true },
        },
        brandProcessRule: {
          include: {
            brand: {
              select: { id: true, name: true, pod: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json({ allocation });
  } catch (error) {
    console.error('PATCH /api/entities/allocations error:', error);
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
        { error: 'Allocation ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.employeeAllocation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Allocation not found' },
        { status: 404 }
      );
    }

    await prisma.employeeAllocation.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Allocation deleted' });
  } catch (error) {
    console.error('DELETE /api/entities/allocations error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
