import ExcelJS from 'exceljs';
import type { Workbook as ExcelWorkbook } from 'exceljs';
import { ReportDetailDataset, ReportFilterCriteria, ReportItem } from '../domain/types';

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
  'FR-RPT-012-combined': 'Top_Rated_Workers_and_Repeat_Customers',
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
    lookupKey =
      subTab === 'repeat-customers'
        ? 'FR-RPT-012-repeat-customers'
        : subTab === 'top-rated-workers'
        ? 'FR-RPT-012-top-rated-workers'
        : 'FR-RPT-012-combined';
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
  value: string | number | Date;
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

  // Percentage string ending with % (e.g. "66.7%" or "5.88%")
  if (s.endsWith('%')) {
    const num = parseFloat(s.replace(/[%\s]/g, ''));
    if (!isNaN(num)) {
      const decimalsMatch = s.match(/\.(\d+)%/);
      const precision = decimalsMatch && decimalsMatch[1].length >= 2 ? '0.00%' : '0.0%';
      return { value: num / 100, numFmt: precision, alignment: 'right' };
    }
  }

  // Star ratings (e.g. "5.0 ★")
  if (s.includes('★')) {
    return { value: s, alignment: 'center' };
  }

  // Phone / mobile / contact numbers MUST remain formatted text cells (preserve country code, spaces, and leading zeros)
  if (hLower.includes('mobile') || hLower.includes('phone') || hLower.includes('contact')) {
    return { value: s, numFmt: '@', alignment: 'left' };
  }

  // Integer count (e.g. "20", "120") but avoid IDs or code columns
  if (/^-?\d+$/.test(s) && !hLower.includes('id') && !hLower.includes('code')) {
    const num = Number(s);
    if (!isNaN(num)) {
      return { value: num, numFmt: '#,##0', alignment: 'right' };
    }
  }

  // Decimal number
  if (/^-?\d+\.\d+$/.test(s) && !hLower.includes('id') && !hLower.includes('code')) {
    const num = parseFloat(s);
    if (!isNaN(num)) {
      return { value: num, numFmt: '#,##0.00', alignment: 'right' };
    }
  }

  // Dates (YYYY-MM-DD -> genuine Excel Date cell so Excel formats and sorts chronologically; YYYY-MM stays centered text)
  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoDateMatch) {
    const utcDate = new Date(Date.UTC(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3])));
    if (!Number.isNaN(utcDate.getTime())) {
      return { value: utcDate, numFmt: 'yyyy-mm-dd', alignment: 'center' };
    }
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
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
  rows: Array<Record<string, string | number>>,
  detailDataset?: ReportDetailDataset
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

  const renderSection = (cols: string[], dataRows: Array<Record<string, string | number>>): string[] => {
    const headerLine = cols.map(escapeCell).join(',');
    const rowLines = dataRows.map((row) =>
      cols.map((col) => escapeCell(row[col] ?? '')).join(',')
    );
    return [headerLine, ...rowLines];
  };

  const lines = [...renderSection(columns, rows)];

  if (detailDataset && detailDataset.rows.length > 0 && detailDataset.columns.length > 0) {
    lines.push('');
    lines.push(escapeCell(`Detailed Backend Records: ${detailDataset.title}`));
    lines.push(...renderSection(detailDataset.columns, detailDataset.rows));
  }

  return BOM + lines.join('\r\n');
}

function populateWorksheetDataTable(
  worksheet: ReturnType<ExcelWorkbook['addWorksheet']>,
  columns: string[],
  rows: Array<Record<string, string | number>>,
  seedWidths: number[] = []
): void {
  const colWidths = columns.map((c, idx) => Math.max(c.length, seedWidths[idx] ?? 12));
  const dataTableStartRow = worksheet.rowCount + 1;

  const headerRow = worksheet.addRow(columns);
  headerRow.height = 26;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
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

  if (rows.length === 0) {
    const emptyRow = worksheet.addRow(['No records found for the selected reporting period and filters.']);
    emptyRow.height = 20;
    emptyRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  } else {
    rows.forEach((rowObj, rowIdx) => {
      const rowValues = columns.map((col) => rowObj[col]);
      const dataRow = worksheet.addRow(rowValues);
      dataRow.height = 20;

      const rowBgColor = rowIdx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';

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

        const valLength = Math.max(
          String(rowObj[col] ?? '').length,
          parsed.numFmt === 'yyyy-mm-dd' ? 12 : 0
        );
        if (valLength > colWidths[colIdx]) {
          colWidths[colIdx] = valLength;
        }
      });
    });

    worksheet.autoFilter = {
      from: { row: dataTableStartRow, column: 1 },
      to: { row: dataTableStartRow + rows.length, column: columns.length },
    };

    worksheet.views = [
      {
        state: 'frozen',
        xSplit: 0,
        ySplit: dataTableStartRow,
        showGridLines: true,
      },
    ];
  }

  columns.forEach((col, idx) => {
    const colNum = idx + 1;
    const hLower = col.toLowerCase();
    const minWidth = (hLower.includes('mobile') || hLower.includes('phone')) ? 18 : 16;
    // Leave room (+5) for header text, Excel AutoFilter dropdown button, and formatted numbers/dates
    const width = Math.min(54, Math.max(minWidth, colWidths[idx] + 5));
    worksheet.getColumn(colNum).width = width;
  });
}

function addMergedBannerRow(
  worksheet: ReturnType<ExcelWorkbook['addWorksheet']>,
  text: string,
  spanCols: number,
  height: number,
  font: { name: string; size: number; bold?: boolean; italic?: boolean; color: { argb: string } }
): void {
  const row = worksheet.addRow([text]);
  row.height = height;
  const cell = row.getCell(1);
  cell.font = font;
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  if (spanCols > 1) {
    worksheet.mergeCells(row.number, 1, row.number, spanCols);
  }
}

/**
 * Generates genuine, fully styled Excel (.xlsx) file using ExcelJS
 */
export async function generateProfessionalExcel(
  report: ReportItem,
  criteria?: ReportFilterCriteria
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SevaNest Admin Portal';
  workbook.lastModifiedBy = 'SevaNest Admin Portal';
  workbook.created = new Date();
  workbook.modified = new Date();

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
  const seedWidths: number[] = columns.map((c) => Math.max(c.length, 12));
  const bannerSpanCols = Math.max(columns.length, 4);

  // --- 1. TITLE BLOCK ---
  addMergedBannerRow(worksheet, 'SevaNest Admin Portal — Enterprise Analytics & Reporting', bannerSpanCols, 24, {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  });

  addMergedBannerRow(worksheet, `[${report.requirement || 'FR-RPT'}] ${report.name}`, bannerSpanCols, 20, {
    name: 'Calibri',
    size: 12,
    bold: true,
    color: { argb: 'FF0F172A' },
  });

  addMergedBannerRow(worksheet, report.description || 'Authoritative PRD Section 14 Operational Telemetry', bannerSpanCols, 28, {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF475569' },
  });

  const generatedTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const metaText = `Category: ${report.category}  |  Operational Cadence: ${report.cadence}  |  Generated: ${generatedTimestamp}`;
  addMergedBannerRow(worksheet, metaText, bannerSpanCols, 18, {
    name: 'Calibri',
    size: 9,
    color: { argb: 'FF64748B' },
  });

  const periodText =
    report.from && report.to
      ? `${report.from} to ${report.to}`
      : report.supportedFilters?.dateRange === false
      ? (report.cadence?.includes('Snapshot') ? 'Point-in-Time Snapshot' : 'All-Time')
      : criteria?.from && criteria?.to
      ? `${criteria.from} to ${criteria.to}`
      : 'All-Time';
  const activeInterval = report.interval || (report.supportedFilters?.interval ? criteria?.interval : undefined);
  const intervalText = activeInterval ? `  |  Interval: ${activeInterval.toUpperCase()}` : '';
  const minRatingsText =
    report.supportedFilters?.minRatings && criteria?.minRatings
      ? `  |  Min Reviews: ≥ ${criteria.minRatings}`
      : '';
  const filterText = `Reporting Period: ${periodText}${intervalText}${minRatingsText}`;
  addMergedBannerRow(worksheet, filterText, bannerSpanCols, 18, {
    name: 'Calibri',
    size: 9,
    bold: true,
    color: { argb: 'FF334155' },
  });

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
      const parsedKpi = parseCellValue(metric.label, metric.value);
      const valCell = kpiRow.getCell(2);
      valCell.value = parsedKpi.value;
      if (parsedKpi.numFmt) {
        valCell.numFmt = parsedKpi.numFmt;
      }
      valCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      valCell.alignment = { horizontal: parsedKpi.alignment };

      if (metric.label.length > seedWidths[0]) seedWidths[0] = metric.label.length;
      const valLen = String(metric.value ?? '').length;
      if (seedWidths.length > 1 && valLen > seedWidths[1]) {
        seedWidths[1] = valLen;
      }
    }

    worksheet.addRow([]);
  }

  // --- 3. DATA TABLE ---
  populateWorksheetDataTable(worksheet, columns, rows, seedWidths);

  // --- 4. SUPPLEMENTARY SHEETS (e.g. Support periodic volume or FR-RPT-012 combined cohort) ---
  if (report.extraSheets && report.extraSheets.length > 0) {
    for (const extra of report.extraSheets) {
      const sheetName = extra.sheetName.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
      const extraSheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
      const extraSpan = Math.max(extra.columns.length, 4);
      addMergedBannerRow(extraSheet, `[${report.requirement || 'FR-RPT'}] ${report.name} — ${extra.sheetName}`, extraSpan, 22, {
        name: 'Calibri',
        size: 12,
        bold: true,
        color: { argb: 'FF1E3A8A' },
      });
      addMergedBannerRow(extraSheet, filterText, extraSpan, 18, {
        name: 'Calibri',
        size: 9,
        bold: true,
        color: { argb: 'FF334155' },
      });
      extraSheet.addRow([]);
      populateWorksheetDataTable(extraSheet, extra.columns, extra.rows);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
