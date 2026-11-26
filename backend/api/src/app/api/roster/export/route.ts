/**
 * Roster export endpoint
 * Exports roster to CSV or Excel format
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportRosterToCSV, exportRosterToExcel } from '@/lib/export';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get('monthKey');
    const format = searchParams.get('format') || 'csv';

    if (!monthKey) {
      return NextResponse.json(
        { error: 'monthKey query parameter is required' },
        { status: 400 }
      );
    }

    if (format === 'csv') {
      const csv = await exportRosterToCSV(monthKey);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="roster-${monthKey}.csv"`,
        },
      });
    } else if (format === 'xlsx') {
      const buffer = await exportRosterToExcel(monthKey);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="roster-${monthKey}.xlsx"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use "csv" or "xlsx"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('GET /api/roster/export error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
