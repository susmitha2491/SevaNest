import { Workbook } from 'exceljs';
import { ReportItem, ReportFilterCriteria } from '../domain/types';

export const CANONICAL_REPORT_NAMES: Record<string, string> = {
  'FR-RPT-001': 'New_Customer_Acquisition',
  'FR-RPT-002': 'Worker_Registration_Dropoff',
  'FR-RPT-003': 'Booking_Requests_vs_Confirmed',
  'FR-RPT-004': 'Category_Wise_Demand',
  'FR-RPT-005': 'Area_Wise_Demand',
  'FR-RPT-006': 'Worker_Utilization_Snapshot',
  'FR-RPT-007': 'Interview_Confirmation_Conversion',
  'FR-RPT-008': 'Booking_Cancellation_Rate',
  'FR-RPT-009': 'Worker_Replacement_Rate',
  'FR-RPT-010': 'Payment_Collections_Realization',
  'FR-RPT-011': 'Support_Ticket_Volume_Resolution',
  'FR-RPT-012-top-rated-workers': 'Top_Rated_Domestic_Workers',
  'FR-RPT-012-repeat-customers': 'Repeat_Customer_Retention',
};

/**
 * Returns a canonical, meaningful filename according to PRD requirement ID and selected sub-tab
 * e.g. FR-RPT-001_New_Customer_Acquisition.xlsx
 */
export function getReportCanonicalFilename(
  report: { requirement?: string; name: string; id?: string },
  format: 'xlsx' | 'csv',
  subTab?: string
): string {
  const req = report.requirement || 'FR-RPT';
  let lookupKey = req;

  if (req === 'FR-RPT-012' || report.id === 'top-rated-workers-repeat-customers') {
    lookupKey = subTab === 'repeat-customers'
      ? 'FR-RPT-012-repeat-customers'
      : 'FR-RPT-012-top-rated-workers';
  }

  let baseName = CANONICAL_REPORT_NAMES[lookupKey];
  if (!baseName) {
    baseName = report.name
      .replace(/&/g, 'and')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  return `${req}_${baseName}.${format}`;
}

/**
 * Parses raw cell value into typed value, Excel number format, and alignment
 */
export function parseCellValue(
  header: string,
  rawVal: unknown
): {
  value: string | number;
  numFmt?: string;
  alignment: 'left' | 'center' | 'right';
  isMonospace?: boolean;
} {
  if (rawVal === null || rawVal === undefined || rawVal === '') {
    return { value: '', alignment: 'left' };
  }

  const hLower = header.toLowerCase();

  // If already a number
  if (typeof rawVal === 'number') {
    if (header.includes('₹') || /amount|gross|refunded|collections|fee|price/i.test(hLower)) {
      return { value: rawVal, numFmt: '₹#,##0.00', alignment: 'right' };
    }
    if (header.includes('%') || /rate|conversion|share|utilization/i.test(hLower)) {
      const v = rawVal > 1 && rawVal <= 100 ? rawVal / 100 : rawVal;
      return { value: v, numFmt: '0.0%', alignment: 'right' };
    }
    return {
      value: rawVal,
      numFmt: Number.isInteger(rawVal) ? '#,##0' : '#,##0.00',
      alignment: 'right',
    };
  }

  const s = String(rawVal).trim();

  // Currency string starting with ₹ (e.g. "₹1,500.00")
  if (s.startsWith('₹')) {
    const num = parseFloat(s.replace(/[₹,\s]/g, ''));
    if (!isNaN(num)) {
      return { value: num, numFmt: '₹#,##0.00', alignment: 'right' };
    }
  }

  // Percentage string ending with % (e.g. "66.7%")
  if (s.endsWith('%')) {
    const num = parseFloat(s.replace(/[%\s]/g, ''));
    if (!isNaN(num)) {
      return { value: num / 100, numFmt: '0.0%', alignment: 'right' };
    }
  }

  // Star ratings (e.g. "5.0 ★")
  if (s.includes('★')) {
    return { value: s, alignment: 'center' };
  }

  // Integer count (e.g. "20", "120") but avoid IDs or code columns
  if (/^-?\d+$/.test(s) && !hLower.includes('id') && !hLower.includes('code') && !hLower.includes('phone')) {
    const num = Number(s);
    if (!isNaN(num)) {
      return { value: num, numFmt: '#,##0', alignment: 'right' };
    }
  }

  // Decimal number
  if (/^-?\d+\.\d+$/.test(s) && !hLower.includes('id') && !hLower.includes('code') && !hLower.includes('phone')) {
    const num = parseFloat(s);
    if (!isNaN(num)) {
      return { value: num, numFmt: '#,##0.00', alignment: 'right' };
    }
  }

  // Dates (YYYY-MM-DD)
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) {
    return { value: s, alignment: 'center' };
  }

  // Reference IDs and UUIDs
  if (hLower.includes('id') || hLower.includes('reference') || hLower.includes('uuid')) {
    return { value: s, alignment: 'left', isMonospace: true };
  }

  return { value: s, alignment: 'left' };
}

/**
 * Generates RFC 4180 compliant CSV string with UTF-8 BOM
 */
export function generateCleanCsv(
  columns: string[],
  rows: Array<Record<string, string | number>>
): string {
  const BOM = '\uFEFF';

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = columns.map(escapeCell).join(',');
  const rowLines = rows.map((row) =>
    columns.map((col) => escapeCell(row[col] ?? '')).join(',')
  );

  return BOM + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Generates genuine, fully styled Excel (.xlsx) file using ExcelJS
 */
export async function generateProfessionalExcel(
  report: ReportItem,
  criteria?: ReportFilterCriteria
): Promise<Uint8Array> {
  const workbook = new Workbook();
  workbook.creator = 'SevaNest Admin Portal';
  workbook.lastModifiedBy = 'SevaNest Admin Portal';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Excel sheet name: max 31 chars, no special forbidden chars
  const sanitizedSheetName = (report.requirement || report.name || 'Report')
    .replace(/[\\/?*[\]:]/g, '_')
    .slice(0, 31);

  const worksheet = workbook.addWorksheet(sanitizedSheetName, {
    views: [{ showGridLines: true }],
  });

  const columns = report.previewColumns && report.previewColumns.length > 0
    ? report.previewColumns
    : ['Metric', 'Value'];
  const rows = report.previewRows || [];

  // Track max lengths for auto column widths
  const colWidths: number[] = columns.map((c) => Math.max(c.length, 12));

  // --- 1. TITLE BLOCK ---
  // Row 1: Portal Header
  const r1 = worksheet.addRow(['SevaNest Admin Portal — Enterprise Analytics & Reporting']);
  r1.height = 24;
  r1.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  // Row 2: Report Title and Requirement
  const r2 = worksheet.addRow([`[${report.requirement || 'FR-RPT'}] ${report.name}`]);
  r2.height = 20;
  r2.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };

  // Row 3: PRD Description
  const r3 = worksheet.addRow([report.description || 'Authoritative PRD Section 14 Operational Telemetry']);
  r3.height = 18;
  r3.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };

  // Row 4: Operational Metadata
  const generatedTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const metaText = `Category: ${report.category}  |  Operational Cadence: ${report.cadence}  |  Generated: ${generatedTimestamp}`;
  const r4 = worksheet.addRow([metaText]);
  r4.height = 17;
  r4.getCell(1).font = { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } };

  // Row 5: Applied Filters
  const periodText = criteria?.from && criteria?.to
    ? `${criteria.from} to ${criteria.to}`
    : 'All-Time';
  const intervalText = criteria?.interval ? `  |  Interval: ${criteria.interval.toUpperCase()}` : '';
  const minRatingsText = criteria?.minRatings ? `  |  Min Reviews: ≥ ${criteria.minRatings}` : '';
  const filterText = `Reporting Period: ${periodText}${intervalText}${minRatingsText}`;
  const r5 = worksheet.addRow([filterText]);
  r5.height = 17;
  r5.getCell(1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF334155' } };

  // Row 6: Spacer
  worksheet.addRow([]);

  // --- 2. EXECUTIVE KPI SUMMARY (if present) ---
  if (report.metricsSummary && report.metricsSummary.length > 0) {
    const kpiHeader = worksheet.addRow(['Executive KPI Summary', 'Value']);
    kpiHeader.height = 20;
    kpiHeader.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    kpiHeader.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    kpiHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    kpiHeader.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    for (const metric of report.metricsSummary) {
      const kpiRow = worksheet.addRow([metric.label, metric.value]);
      kpiRow.height = 18;
      kpiRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      kpiRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      kpiRow.getCell(2).alignment = { horizontal: 'left' };

      // Update column width tracking for summary
      if (metric.label.length > colWidths[0]) colWidths[0] = metric.label.length;
    }

    // Spacer after KPIs
    worksheet.addRow([]);
  }

  // --- 3. DATA TABLE ---
  const dataTableStartRow = worksheet.rowCount + 1;

  // Header Row
  const headerRow = worksheet.addRow(columns);
  headerRow.height = 26;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Corporate Navy
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'thin', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF0F172A' } },
    };

    const headerLength = columns[colNumber - 1]?.length || 10;
    if (headerLength > colWidths[colNumber - 1]) {
      colWidths[colNumber - 1] = headerLength;
    }
  });

  // Data Rows
  if (rows.length === 0) {
    const emptyRow = worksheet.addRow(['No records found for the selected reporting period and filters.']);
    emptyRow.height = 20;
    emptyRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  } else {
    rows.forEach((rowObj, rowIdx) => {
      const rowValues = columns.map((col) => rowObj[col]);
      const dataRow = worksheet.addRow(rowValues);
      dataRow.height = 20;

      const isOdd = rowIdx % 2 === 1;
      const rowBgColor = isOdd ? 'FFF8FAFC' : 'FFFFFFFF';

      columns.forEach((col, colIdx) => {
        const colNum = colIdx + 1;
        const cell = dataRow.getCell(colNum);
        const parsed = parseCellValue(col, rowObj[col]);

        cell.value = parsed.value;
        if (parsed.numFmt) {
          cell.numFmt = parsed.numFmt;
        }

        cell.font = {
          name: parsed.isMonospace ? 'Consolas' : 'Calibri',
          size: parsed.isMonospace ? 9.5 : 10,
          color: { argb: 'FF1E293B' },
        };

        cell.alignment = {
          vertical: 'middle',
          horizontal: parsed.alignment,
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor },
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        const valLength = String(rowObj[col] ?? '').length;
        if (valLength > colWidths[colIdx]) {
          colWidths[colIdx] = valLength;
        }
      });
    });

    // --- 4. AUTO-FILTER & FREEZE PANES ---
    // Enable dropdown filter on the data table
    worksheet.autoFilter = {
      from: { row: dataTableStartRow, column: 1 },
      to: { row: dataTableStartRow + rows.length, column: columns.length },
    };

    // Freeze panes at the data table header row
    worksheet.views = [
      {
        state: 'frozen',
        xSplit: 0,
        ySplit: dataTableStartRow,
        showGridLines: true,
      },
    ];
  }

  // --- 5. COLUMN WIDTHS ---
  columns.forEach((_, idx) => {
    const colNum = idx + 1;
    // Padding of 4 characters, bounded between 14 and 45
    const width = Math.min(45, Math.max(14, colWidths[idx] + 4));
    worksheet.getColumn(colNum).width = width;
  });

  // Write to ArrayBuffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
