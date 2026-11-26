/**
 * Holiday Calendar CRUD Endpoint
 * GET: list all holidays
 * POST: create a new holiday
 * PATCH: update a holiday
 * DELETE: delete a holiday
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  name: z.string().min(1, 'Holiday name is required'),
  isPublicHoliday: z.boolean().default(true),
});

const UpdateHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().min(1).optional(),
  isPublicHoliday: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    let whereClause = {};
    if (year) {
      const yearNum = parseInt(year, 10);
      if (isNaN(yearNum)) {
        return NextResponse.json(
          { error: 'Invalid year parameter' },
          { status: 400 }
        );
      }
      const startDate = new Date(yearNum, 0, 1);
      const endDate = new Date(yearNum, 11, 31);
      whereClause = { date: { gte: startDate, lte: endDate } };
    }

    const holidays = await prisma.holidayCalendar.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ holidays });
  } catch (error) {
    console.error('GET /api/entities/holidays error:', error);
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
    const validation = CreateHolidaySchema.safeParse(body);

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

    // Parse date
    const dateObj = new Date(data.date + 'T00:00:00.000Z');

    // Check for duplicate date
    const existing = await prisma.holidayCalendar.findUnique({
      where: { date: dateObj },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Holiday for this date already exists' },
        { status: 409 }
      );
    }

    const holiday = await prisma.holidayCalendar.create({
      data: {
        date: dateObj,
        name: data.name,
        isPublicHoliday: data.isPublicHoliday,
      },
    });

    return NextResponse.json({ holiday }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entities/holidays error:', error);
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
        { error: 'Holiday ID is required' },
        { status: 400 }
      );
    }

    const validation = UpdateHolidaySchema.safeParse(updates);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if holiday exists
    const existing = await prisma.holidayCalendar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Holiday not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (validation.data.date) {
      const newDateObj = new Date(validation.data.date + 'T00:00:00.000Z');
      
      // Check if new date conflicts with another holiday
      if (newDateObj.getTime() !== existing.date.getTime()) {
        const conflict = await prisma.holidayCalendar.findUnique({
          where: { date: newDateObj },
        });
        if (conflict) {
          return NextResponse.json(
            { error: 'Holiday for this date already exists' },
            { status: 409 }
          );
        }
      }
      updateData.date = newDateObj;
    }
    if (validation.data.name !== undefined) {
      updateData.name = validation.data.name;
    }
    if (validation.data.isPublicHoliday !== undefined) {
      updateData.isPublicHoliday = validation.data.isPublicHoliday;
    }

    const holiday = await prisma.holidayCalendar.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ holiday });
  } catch (error) {
    console.error('PATCH /api/entities/holidays error:', error);
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
        { error: 'Holiday ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.holidayCalendar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Holiday not found' },
        { status: 404 }
      );
    }

    await prisma.holidayCalendar.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    console.error('DELETE /api/entities/holidays error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
