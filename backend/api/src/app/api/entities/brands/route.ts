/**
 * Brands CRUD Endpoint
 * GET: list all brands
 * POST: create a new brand
 * PATCH: update a brand
 * DELETE: delete a brand
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  podId: z.string().min(1, 'Pod ID is required'),
  accountTier: z.string().default('Standard'),
  isActive: z.boolean().default(true),
});

const UpdateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  podId: z.string().optional(),
  accountTier: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        pod: {
          select: { id: true, name: true },
        },
        _count: {
          select: { processRules: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ brands });
  } catch (error) {
    console.error('GET /api/entities/brands error:', error);
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
    const validation = CreateBrandSchema.safeParse(body);

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

    // Verify pod exists
    const pod = await prisma.pod.findUnique({ where: { id: data.podId } });
    if (!pod) {
      return NextResponse.json(
        { error: 'Pod not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name + podId combination
    const existing = await prisma.brand.findUnique({
      where: {
        name_podId: {
          name: data.name,
          podId: data.podId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Brand with this name already exists in the pod' },
        { status: 409 }
      );
    }

    const brand = await prisma.brand.create({
      data,
      include: {
        pod: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entities/brands error:', error);
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
        { error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    const validation = UpdateBrandSchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if brand exists
    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // If changing podId, verify new pod exists
    if (validation.data.podId) {
      const pod = await prisma.pod.findUnique({ where: { id: validation.data.podId } });
      if (!pod) {
        return NextResponse.json(
          { error: 'Pod not found' },
          { status: 404 }
        );
      }
    }

    // Check for name+podId conflict if renaming or moving
    const newName = validation.data.name ?? existing.name;
    const newPodId = validation.data.podId ?? existing.podId;

    if (newName !== existing.name || newPodId !== existing.podId) {
      const conflict = await prisma.brand.findUnique({
        where: {
          name_podId: {
            name: newName,
            podId: newPodId,
          },
        },
      });

      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: 'Brand with this name already exists in the pod' },
          { status: 409 }
        );
      }
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: validation.data,
      include: {
        pod: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ brand });
  } catch (error) {
    console.error('PATCH /api/entities/brands error:', error);
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
        { error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: { select: { processRules: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Warn if brand has process rules (will cascade delete)
    if (existing._count.processRules > 0) {
      console.warn(`Deleting brand ${id} with ${existing._count.processRules} process rules (cascade delete)`);
    }

    await prisma.brand.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Brand deleted' });
  } catch (error) {
    console.error('DELETE /api/entities/brands error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
