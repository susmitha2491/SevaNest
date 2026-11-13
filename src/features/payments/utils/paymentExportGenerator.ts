import ExcelJS from 'exceljs';
import { PaymentTransaction } from '../domain/types';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

export interface PaymentExportContext {
  search?: string;
  status?: string;
  feeType?: string;
  filterDescription?: string;
  exportedBy?: string;
}

export function getPaymentsExportFilename(format: 'xlsx' | 'csv'): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  return `SevaNest_Payments_Report_${dateStr}.${format}`;
}

const formatFeeLabel = (feeType: string): string => {
  switch (feeType) {
    case 'BOOKING_FEE':
      return 'Booking / Matching Fee';
    case 'PLACEMENT_FEE':
      return 'Placement Commission';
    case 'REPLACEMENT_PLAN':
      return 'Replacement Guarantee Plan';
    case 'SUBSCRIPTION':
      return 'Subscription / Membership';
    default:
      return feeType.replace(/_/g, ' ');
  }
};

const formatStatusLabel = (status: string): string => {
  switch (status) {
    case 'SUCCEEDED':
    case 'PAID':
      return 'Paid';
    case 'REFUND_PENDING':
      return 'Refund Pending';
    case 'REFUNDED':
      return 'Refunded';
    case 'PARTIALLY_REFUNDED':
      return 'Partially Refunded';
    case 'REFUND_FAILED':
      return 'Refund Failed';
    case 'FAILED':
    case 'PAYMENT_FAILED':
      return 'Payment Failed';
    case 'PENDING':
      return 'Pending';
    case 'CREATED':
      return 'Created';
    default:
      return status.replace(/_/g, ' ');
  }
};

/**
 * Builds an enterprise-grade Excel workbook (.xlsx) with styled title block,
 * financial totals, and typed columns for payment transactions.
 */
export async function generatePaymentsExcelBlob(
  transactions: PaymentTransaction[],
  context?: PaymentExportContext
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SevaNest Operations Portal';
  workbook.lastModifiedBy = 'SevaNest Operations Portal';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Payments Ledger', {
    views: [{ showGridLines: true }],
  });

  // Title & Metadata block
  worksheet.addRow(['SevaNest Platform Financial Ledger & Collections Report']);
  worksheet.addRow(['Module: Operations Admin Financial Management & Payment Collections']);

  const nowIST = formatDateTimeIST(new Date().toISOString());
  worksheet.addRow([`Generated At: ${nowIST}`]);

  const activeStatus = context?.status && context.status !== 'ALL' ? formatStatusLabel(context.status) : 'All Statuses';
  const activeFee = context?.feeType && context.feeType !== 'ALL' ? formatFeeLabel(context.feeType) : 'All Fee Classifications';
  const activeSearch = context?.search?.trim() ? `"${context.search.trim()}"` : 'None';
  worksheet.addRow([`Filter Scope: Status: ${activeStatus} | Fee: ${activeFee} | Search: ${activeSearch}`]);

  const totalGrossSettled = transactions
    .filter((t) => t.status === 'PAID' || t.status === 'SUCCEEDED' || t.status === 'REFUNDED' || t.status === 'REFUND_PENDING')
    .reduce((acc, t) => acc + (t.amountINR || 0), 0);
  const totalRefunded = transactions
    .filter((t) => t.status === 'REFUNDED')
    .reduce((acc, t) => acc + (t.refund?.refundAmountINR || t.amountINR || 0), 0);

  worksheet.addRow([
    `Total Records: ${transactions.length} | Gross Collections: ₹${totalGrossSettled.toFixed(2)} | Refunded: ₹${totalRefunded.toFixed(2)}`,
  ]);

  // Blank row separator
  worksheet.addRow([]);

  // Title styling
  worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  worksheet.getCell('A2').font = { size: 9, italic: true, color: { argb: 'FF475569' } };
  worksheet.getCell('A3').font = { size: 9, color: { argb: 'FF475569' } };
  worksheet.getCell('A4').font = { size: 9, color: { argb: 'FF475569' } };
  worksheet.getCell('A5').font = { size: 9, bold: true, color: { argb: 'FF0F172A' } };

  // Define Columns
  worksheet.columns = [
    { key: 'id', width: 38 },
    { key: 'bookingRef', width: 18 },
    { key: 'customerName', width: 26 },
    { key: 'customerPhone', width: 18 },
    { key: 'serviceCategory', width: 18 },
    { key: 'feeType', width: 28 },
    { key: 'amountINR', width: 16 },
    { key: 'currency', width: 12 },
    { key: 'paymentMethod', width: 18 },
    { key: 'status', width: 18 },
    { key: 'createdAt', width: 22 },
    { key: 'paidAt', width: 22 },
    { key: 'refundStatus', width: 18 },
    { key: 'refundAmountINR', width: 18 },
    { key: 'gatewayRef', width: 24 },
    { key: 'receiptNumber', width: 24 },
  ];

  // Header Row (Row 7)
  const headers = [
    'Transaction ID',
    'Booking Reference',
    'Customer Name',
    'Customer Phone',
    'Service Category',
    'Fee Classification',
    'Amount (INR)',
    'Currency',
    'Payment Method',
    'Payment Status',
    'Created At (IST)',
    'Settled At (IST)',
    'Refund Status',
    'Refund Amount (INR)',
    'Gateway Reference',
    'Receipt Number',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Deep Navy
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });

  // Data Rows
  for (const txn of transactions) {
    const refundStatusText =
      txn.status === 'REFUNDED'
        ? 'Refunded'
        : txn.status === 'REFUND_PENDING'
        ? 'Refund Pending'
        : txn.status === 'REFUND_FAILED'
        ? 'Refund Failed'
        : 'None';

    const refundAmountVal =
      txn.status === 'REFUNDED'
        ? Number(txn.refund?.refundAmountINR || txn.amountINR || 0)
        : 0;

    const row = worksheet.addRow([
      txn.id,
      txn.bookingRef,
      txn.customerName,
      txn.customerPhoneMasked || '—',
      txn.serviceCategory,
      formatFeeLabel(txn.feeType),
      txn.amountINR,
      'INR',
      txn.paymentMethod || '—',
      formatStatusLabel(txn.status),
      txn.createdAt ? formatDateTimeIST(txn.createdAt) : txn.timestamp,
      txn.paidAt ? formatDateTimeIST(txn.paidAt) : '—',
      refundStatusText,
      refundAmountVal,
      txn.gatewayRef && txn.gatewayRef !== 'N/A' ? txn.gatewayRef : '—',
      txn.receiptNumber || '—',
    ]);

    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.font = { size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
        right: { style: 'thin', color: { argb: 'FFF1F5F9' } },
      };

      // Col 7 = Amount (INR), Col 14 = Refund Amount (INR)
      if (colNumber === 7 || colNumber === 14) {
        cell.numFmt = '₹#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 2 || colNumber === 8 || colNumber === 10 || colNumber === 13) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Explicit string format for identifiers to prevent scientific notation in Excel
      if (colNumber === 1 || colNumber === 2 || colNumber === 15 || colNumber === 16) {
        cell.numFmt = '@';
      }
    });
  }

  // Summary Row at bottom
  if (transactions.length > 0) {
    const summaryRow = worksheet.addRow([
      'Total',
      '',
      '',
      '',
      '',
      '',
      totalGrossSettled,
      'INR',
      '',
      '',
      '',
      '',
      '',
      totalRefunded,
      '',
      '',
    ]);
    summaryRow.height = 22;
    summaryRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 9 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
      cell.border = {
        top: { style: 'double', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
      if (colNumber === 7 || colNumber === 14) {
        cell.numFmt = '₹#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Builds a clean, professional CSV string with human-readable column headers
 * and uncorrupted numeric/text values.
 */
export function generatePaymentsCsvString(
  transactions: PaymentTransaction[],
  context?: PaymentExportContext
): string {
  const headers = [
    'Transaction ID',
    'Booking Reference',
    'Customer Name',
    'Customer Phone',
    'Service Category',
    'Fee Classification',
    'Amount (INR)',
    'Currency',
    'Payment Method',
    'Payment Status',
    'Transaction Date (IST)',
    'Settlement Date (IST)',
    'Refund Status',
    'Refund Amount (INR)',
    'Gateway Reference',
    'Receipt Number',
  ];

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows: string[] = [];

  // Metadata comments in CSV
  const nowIST = formatDateTimeIST(new Date().toISOString());
  rows.push(`# SevaNest Platform Financial Ledger & Collections Report`);
  rows.push(`# Generated At: ${nowIST}`);
  if (context?.status && context.status !== 'ALL') {
    rows.push(`# Status Filter: ${formatStatusLabel(context.status)}`);
  }
  if (context?.feeType && context.feeType !== 'ALL') {
    rows.push(`# Fee Classification: ${formatFeeLabel(context.feeType)}`);
  }
  if (context?.search?.trim()) {
    rows.push(`# Search Filter: "${context.search.trim()}"`);
  }
  rows.push(`# Total Records Exported: ${transactions.length}`);

  // Header row
  rows.push(headers.map(escapeCsv).join(','));

  // Data rows
  for (const txn of transactions) {
    const refundStatusText =
      txn.status === 'REFUNDED'
        ? 'Refunded'
        : txn.status === 'REFUND_PENDING'
        ? 'Refund Pending'
        : txn.status === 'REFUND_FAILED'
        ? 'Refund Failed'
        : 'None';

    const refundAmountVal =
      txn.status === 'REFUNDED'
        ? Number(txn.refund?.refundAmountINR || txn.amountINR || 0).toFixed(2)
        : '0.00';

    const row = [
      txn.id,
      txn.bookingRef,
      txn.customerName,
      txn.customerPhoneMasked || '—',
      txn.serviceCategory,
      formatFeeLabel(txn.feeType),
      txn.amountINR.toFixed(2),
      'INR',
      txn.paymentMethod || '—',
      formatStatusLabel(txn.status),
      txn.createdAt ? formatDateTimeIST(txn.createdAt) : txn.timestamp,
      txn.paidAt ? formatDateTimeIST(txn.paidAt) : '—',
      refundStatusText,
      refundAmountVal,
      txn.gatewayRef && txn.gatewayRef !== 'N/A' ? txn.gatewayRef : '—',
      txn.receiptNumber || '—',
    ];

    rows.push(row.map(escapeCsv).join(','));
  }

  // Prepend UTF-8 BOM so Excel opens CSV without encoding errors
  return '\uFEFF' + rows.join('\r\n');
}

