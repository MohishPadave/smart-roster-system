/**
 * Export roster to CSV and Excel formats
 */

import ExcelJS from 'exceljs';
import { prisma } from './prisma';
import { ShiftCode } from '@/types/roster';

interface RosterExportData {
  monthKey: string;
  employees: Array<{
    id: string;
    name: string;
    podName: string;
    roleType: string;
  }>;
  shifts: Map<string, ShiftCode>; // key: "employeeId:date"
  brandRuleMap: Map<string, { brandName: string; process: string }>; // key: shiftEntry id or brandProcessRuleId
}

/**
 * Load roster data for export
 */
async function loadRosterExportData(monthKey: string): Promise<RosterExportData> {
  const rosterVersion = await prisma.rosterVersion.findUnique({
    where: { monthKey },
    include: {
      shiftEntries: {
        include: {
          employee: { include: { pod: true } },
          brandProcessRule: { include: { brand: true } },
        },
      },
    },
  });

  if (!rosterVersion) {
    throw new Error(`RosterVersion not found for monthKey: ${monthKey}`);
  }

  const employees = Array.from(
    new Map(
      rosterVersion.shiftEntries.map((entry) => [
        entry.employee.id,
        {
          id: entry.employee.id,
          name: entry.employee.name,
          podName: entry.employee.pod.name,
          roleType: entry.employee.roleType,
        },
      ])
    ).values()
  );

  const shifts = new Map<string, ShiftCode>();
  const brandRuleMap = new Map<string, { brandName: string; process: string }>();

  for (const entry of rosterVersion.shiftEntries) {
    shifts.set(`${entry.employeeId}:${entry.date}`, entry.shiftCode as ShiftCode);
    if (entry.brandProcessRule) {
      brandRuleMap.set(entry.id, {
        brandName: entry.brandProcessRule.brand.name,
        process: entry.brandProcessRule.process,
      });
    }
  }

  return { monthKey, employees, shifts, brandRuleMap };
}

/**
 * Generate dates for the month
 */
function generateMonthDates(monthKey: string): string[] {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return dates;
}

/**
 * Export roster to CSV
 */
export async function exportRosterToCSV(monthKey: string): Promise<string> {
  const data = await loadRosterExportData(monthKey);
  const dates = generateMonthDates(monthKey);

  // CSV Header
  const header = ['Employee', 'Pod', 'Role', ...dates].join(',');
  const rows = [header];

  // Data Rows
  for (const employee of data.employees) {
    const row = [employee.name, employee.podName, employee.roleType];
    for (const date of dates) {
      const shift = data.shifts.get(`${employee.id}:${date}`) || ShiftCode.WO;
      row.push(shift);
    }
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Export roster to Excel (.xlsx)
 */
export async function exportRosterToExcel(monthKey: string): Promise<Buffer> {
  const data = await loadRosterExportData(monthKey);
  const dates = generateMonthDates(monthKey);

  const workbook = new ExcelJS.Workbook();

  // ========== Summary Sheet ==========
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  const totalEmployees = data.employees.length;
  const totalShifts = data.shifts.size;
  const workingShifts = Array.from(data.shifts.values()).filter(
    (s) => s === ShiftCode.W
  ).length;
  const woShifts = Array.from(data.shifts.values()).filter((s) => s === ShiftCode.WO).length;
  const leaveShifts = Array.from(data.shifts.values()).filter(
    (s) => s === ShiftCode.AL || s === ShiftCode.CO
  ).length;

  summarySheet.addRows([
    { metric: 'Month', value: monthKey },
    { metric: 'Total Employees', value: totalEmployees },
    { metric: 'Total Shifts', value: totalShifts },
    { metric: 'Working Shifts (W)', value: workingShifts },
    { metric: 'Weekly Offs (WO)', value: woShifts },
    { metric: 'Leave Shifts (AL/CO)', value: leaveShifts },
  ]);

  // Style header
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  };

  // ========== Roster Matrix Sheet ==========
  const rosterSheet = workbook.addWorksheet('Roster');

  // Header Row
  const headerRow = ['Employee', 'Pod', 'Role', ...dates];
  rosterSheet.addRow(headerRow);

  // Style header
  rosterSheet.getRow(1).font = { bold: true };
  rosterSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  rosterSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Data Rows
  for (const employee of data.employees) {
    const row = [employee.name, employee.podName, employee.roleType];
    for (const date of dates) {
      const shift = data.shifts.get(`${employee.id}:${date}`) || ShiftCode.WO;
      row.push(shift);
    }
    rosterSheet.addRow(row);
  }

  // Set column widths
  rosterSheet.getColumn(1).width = 25; // Employee
  rosterSheet.getColumn(2).width = 15; // Pod
  rosterSheet.getColumn(3).width = 15; // Role
  for (let i = 4; i <= headerRow.length; i++) {
    rosterSheet.getColumn(i).width = 8; // Date columns
  }

  // Conditional formatting for shift codes
  for (let rowIndex = 2; rowIndex <= data.employees.length + 1; rowIndex++) {
    for (let colIndex = 4; colIndex <= headerRow.length; colIndex++) {
      const cell = rosterSheet.getCell(rowIndex, colIndex);
      const shiftCode = cell.value as ShiftCode;

      switch (shiftCode) {
        case ShiftCode.W:
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF90EE90' }, // Light green
          };
          break;
        case ShiftCode.WO:
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFE0' }, // Light yellow
          };
          break;
        case ShiftCode.AL:
        case ShiftCode.CO:
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFA07A' }, // Light salmon
          };
          break;
        case ShiftCode.PH:
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFADD8E6' }, // Light blue
          };
          break;
        case ShiftCode.BK:
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD8BFD8' }, // Thistle (light purple)
          };
          break;
      }

      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
