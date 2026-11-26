/**
 * Pods CRUD Endpoint
 * GET: list all pods
 * POST: create a new pod
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreatePodSchema = z.object({
  name: z.string().min(1, 'Pod name is required'),
  podLeadId: z.string().optional().nullable(),
});

const UpdatePodSchema = z.object({
  name: z.string().min(1, 'Pod name is required').optional(),
  podLeadId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const pods = await prisma.pod.findMany({
      include: {
        podLead: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { employees: true, brands: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ pods });
  } catch (error) {
    console.error('GET /api/entities/pods error:', error);
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
    const validation = CreatePodSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { name, podLeadId } = validation.data;

    // Check for duplicate name
    const existing = await prisma.pod.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: 'Pod with this name already exists' },
        { status: 409 }
      );
    }

    // If podLeadId provided, verify employee exists
    if (podLeadId) {
      const employee = await prisma.employee.findUnique({ where: { id: podLeadId } });
      if (!employee) {
        return NextResponse.json(
          { error: 'Pod lead employee not found' },
          { status: 404 }
        );
      }
    }

    const pod = await prisma.pod.create({
      data: { name, podLeadId: podLeadId || null },
      include: {
        podLead: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ pod }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entities/pods error:', error);
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
        { error: 'Pod ID is required' },
        { status: 400 }
      );
    }

    const validation = UpdatePodSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if pod exists
    const existing = await prisma.pod.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Pod not found' },
        { status: 404 }
      );
    }

    // Check for name conflict if renaming
    if (validation.data.name && validation.data.name !== existing.name) {
      const conflict = await prisma.pod.findUnique({ where: { name: validation.data.name } });
      if (conflict) {
        return NextResponse.json(
          { error: 'Pod with this name already exists' },
          { status: 409 }
        );
      }
    }

    // If podLeadId provided, verify employee exists
    if (validation.data.podLeadId) {
      const employee = await prisma.employee.findUnique({ where: { id: validation.data.podLeadId } });
      if (!employee) {
        return NextResponse.json(
          { error: 'Pod lead employee not found' },
          { status: 404 }
        );
      }
    }

    const pod = await prisma.pod.update({
      where: { id },
      data: validation.data,
      include: {
        podLead: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ pod });
  } catch (error) {
    console.error('PATCH /api/entities/pods error:', error);
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
        { error: 'Pod ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.pod.findUnique({
      where: { id },
      include: {
        _count: { select: { employees: true, brands: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pod not found' },
        { status: 404 }
      );
    }

    // Check for cascading deletions
    if (existing._count.employees > 0 || existing._count.brands > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete pod with existing employees or brands',
          details: `Pod has ${existing._count.employees} employees and ${existing._count.brands} brands`,
        },
        { status: 409 }
      );
    }

    await prisma.pod.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Pod deleted' });
  } catch (error) {
    console.error('DELETE /api/entities/pods error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
