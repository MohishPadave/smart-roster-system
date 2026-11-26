/**
 * Brand Process Rules CRUD Endpoint
 * GET: list all rules
 * POST: create a new rule
 * PATCH: update a rule
 * DELETE: delete a rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Process, OperatingCalendar } from '@prisma/client';

const CreateRuleSchema = z.object({
  brandId: z.string().min(1, 'Brand ID is required'),
  process: z.nativeEnum(Process),
  operatingCalendar: z.nativeEnum(OperatingCalendar),
  minHeadcount: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

const UpdateRuleSchema = z.object({
  process: z.nativeEnum(Process).optional(),
  operatingCalendar: z.nativeEnum(OperatingCalendar).optional(),
  minHeadcount: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const rules = await prisma.brandProcessRule.findMany({
      include: {
        brand: {
          select: { id: true, name: true, pod: { select: { id: true, name: true } } },
        },
        _count: {
          select: { allocations: true, shiftEntries: true },
        },
      },
      orderBy: [{ brand: { name: 'asc' } }, { process: 'asc' }],
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('GET /api/entities/rules error:', error);
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
    const validation = CreateRuleSchema.safeParse(body);

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

    // Verify brand exists
    const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Check for duplicate brandId + process combination
    const existing = await prisma.brandProcessRule.findUnique({
      where: {
        brandId_process: {
          brandId: data.brandId,
          process: data.process,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Process rule for this brand and process already exists' },
        { status: 409 }
      );
    }

    const rule = await prisma.brandProcessRule.create({
      data,
      include: {
        brand: {
          select: { id: true, name: true, pod: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entities/rules error:', error);
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
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const validation = UpdateRuleSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if rule exists
    const existing = await prisma.brandProcessRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Process rule not found' },
        { status: 404 }
      );
    }

    // Check for brandId+process conflict if changing process
    if (validation.data.process && validation.data.process !== existing.process) {
      const conflict = await prisma.brandProcessRule.findUnique({
        where: {
          brandId_process: {
            brandId: existing.brandId,
            process: validation.data.process,
          },
        },
      });

      if (conflict) {
        return NextResponse.json(
          { error: 'Process rule for this brand and process already exists' },
          { status: 409 }
        );
      }
    }

    const rule = await prisma.brandProcessRule.update({
      where: { id },
      data: validation.data,
      include: {
        brand: {
          select: { id: true, name: true, pod: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('PATCH /api/entities/rules error:', error);
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
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.brandProcessRule.findUnique({
      where: { id },
      include: {
        _count: { select: { allocations: true, shiftEntries: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Process rule not found' },
        { status: 404 }
      );
    }

    // Warn if rule has allocations or shift entries (will cascade delete)
    if (existing._count.allocations > 0 || existing._count.shiftEntries > 0) {
      console.warn(`Deleting rule ${id} with ${existing._count.allocations} allocations and ${existing._count.shiftEntries} shift entries (cascade delete)`);
    }

    await prisma.brandProcessRule.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Process rule deleted' });
  } catch (error) {
    console.error('DELETE /api/entities/rules error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
