import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import {
  ReportItem,
  ReportCategory,
  ReportFilterCriteria,
  ReportMetricSummary,
  ExportResult,
  IReportRepository,
} from '../domain/types';
import {
  generateProfessionalExcel,
  generateCleanCsv,
  getReportCanonicalFilename,
} from '../utils/reportExportGenerator';
import { enrichReportWithBackendRecords } from './reportDetailEnricher';

export interface ReportMetaDefinition {
  slug: string;
  requirement: string;
  name: string;
  category: Exclude<ReportCategory, 'ALL'>;
  cadence: string;
  defaultDescription: string;
  supportedFilters: {
    dateRange: boolean;
    interval: boolean;
    minRatings: boolean;
  };
}

export const REPORT_DEFINITIONS: Record<string, ReportMetaDefinition> = {
  'new-customers': {
    slug: 'new-customers',
    requirement: 'FR-RPT-001',
    name: 'New Customers by Period',
    category: 'Growth',
    cadence: 'Periodic (Daily / Weekly / Monthly)',
    defaultDescription: 'Customer accounts created per day/week/month (registers on first OTP verification).',
    supportedFilters: { dateRange: true, interval: true, minRatings: false },
  },
  'worker-registrations': {
    slug: 'worker-registrations',
    requirement: 'FR-RPT-002',
    name: 'Worker Registrations & Verification Conversion',
    category: 'Workforce',
    cadence: 'Periodic (Daily / Weekly / Monthly)',
    defaultDescription: 'Worker profiles created in the period, and how many are fully verified today.',
    supportedFilters: { dateRange: true, interval: true, minRatings: false },
  },
  'booking-funnel': {
    slug: 'booking-funnel',
    requirement: 'FR-RPT-003',
    name: 'Booking Requests vs Confirmed Bookings',
    category: 'Marketplace',
    cadence: 'Periodic (Daily / Weekly / Monthly)',
    defaultDescription: 'Booking requests created in the period, and how many reached confirmed status.',
    supportedFilters: { dateRange: true, interval: true, minRatings: false },
  },
  'demand-by-category': {
    slug: 'demand-by-category',
    requirement: 'FR-RPT-004',
    name: 'Category-Wise Demand Distribution',
    category: 'Marketplace',
    cadence: 'Monthly / Cohort Demand',
    defaultDescription: 'Booking requests created in the period, grouped across all configured service categories.',
    supportedFilters: { dateRange: true, interval: false, minRatings: false },
  },
  'demand-by-area': {
    slug: 'demand-by-area',
    requirement: 'FR-RPT-005',
    name: 'Area-Wise Demand Distribution',
    category: 'Marketplace',
    cadence: 'Geographic Cohort (Paginated)',
    defaultDescription: 'Booking requests created in the period, grouped by service area clusters (busiest first).',
    supportedFilters: { dateRange: true, interval: false, minRatings: false },
  },
  'worker-utilization': {
    slug: 'worker-utilization',
    requirement: 'FR-RPT-006',
    name: 'Domestic Worker Utilization Snapshot',
    category: 'Workforce',
    cadence: 'Point-in-Time Snapshot',
    defaultDescription: 'Share of fully verified, active, submitted workers holding an active booking right now.',
    supportedFilters: { dateRange: false, interval: false, minRatings: false },
  },
  'interview-conversion': {
    slug: 'interview-conversion',
    requirement: 'FR-RPT-007',
    name: 'Interview-to-Confirmation Conversion',
    category: 'Operations',
    cadence: 'Cohort Conversion Ratio',
    defaultDescription: 'Of bookings that completed an interview/trial, the share that reached confirmed.',
    supportedFilters: { dateRange: true, interval: false, minRatings: false },
  },
  'cancellation-rate': {
    slug: 'cancellation-rate',
    requirement: 'FR-RPT-008',
    name: 'Booking Cancellation Rate',
    category: 'Operations',
    cadence: 'Cohort Cancellation Ratio',
    defaultDescription: 'Bookings created in the period that are cancelled now, divided by all bookings created.',
    supportedFilters: { dateRange: true, interval: false, minRatings: false },
  },
  'replacement-rate': {
    slug: 'replacement-rate',
    requirement: 'FR-RPT-009',
    name: 'Worker Replacement Rate',
    category: 'Operations',
    cadence: 'Active Placements Cohort',
    defaultDescription: 'Replacement requests raised for bookings created in the period that reached active status.',
    supportedFilters: { dateRange: true, interval: false, minRatings: false },
  },
  'payment-collections': {
    slug: 'payment-collections',
    requirement: 'FR-RPT-010',
    name: 'Payment Collections & Fee Realization',
    category: 'Finance',
    cadence: 'Financial Period Ledger',
    defaultDescription: 'Gross collections, fee codes, count, and refunds recorded in the period (INR).',
    supportedFilters: { dateRange: true, interval: true, minRatings: false },
  },
  'support-tickets': {
    slug: 'support-tickets',
    requirement: 'FR-RPT-011',
    name: 'Support Ticket Volume & Resolution Time',
    category: 'Support',
    cadence: 'Service Quality Metric',
    defaultDescription: 'Tickets created in the period by status, and average turnaround time to closure.',
    supportedFilters: { dateRange: true, interval: true, minRatings: false },
  },
  'top-rated-workers-repeat-customers': {
    slug: 'top-rated-workers-repeat-customers',
    requirement: 'FR-RPT-012',
    name: 'Top-Rated Workers & Repeat Customers',
    category: 'Retention',
    cadence: 'Quality & Retention Cohort (Paginated)',
    defaultDescription: 'Workers ranked by average consumer rating, and customer cohorts creating repeat bookings in the period (PRD Section 14).',
    supportedFilters: { dateRange: true, interval: false, minRatings: true },
  },
  'top-rated-workers': {
    slug: 'top-rated-workers',
    requirement: 'FR-RPT-012',
    name: 'Top-Rated Domestic Workers',
    category: 'Retention',
    cadence: 'All-Time Ranked (Paginated)',
    defaultDescription: 'Domestic workers ranked by average consumer rating, count of ratings, and verified status.',
    supportedFilters: { dateRange: false, interval: false, minRatings: true },
  },
  'repeat-customers': {
    slug: 'repeat-customers',
    requirement: 'FR-RPT-012',
    name: 'Repeat Customers & Retention',
    category: 'Retention',
    cadence: 'Customer Cohort (Paginated)',
    defaultDescription: 'Customers who created more than one booking in the period (most bookings first).',
    supportedFilters: { dateRange: true, interval: false, minRatings: false },
  },
};

export function resolveReportSlug(id: string): string {
  const trimmed = id.trim().toLowerCase();
  if (trimmed.includes('/')) return trimmed.split('/').pop() || trimmed;
  if (trimmed === 'rep-01') return 'new-customers';
  if (trimmed === 'rep-02') return 'worker-registrations';
  if (trimmed === 'rep-03') return 'booking-funnel';
  if (trimmed === 'rep-04') return 'demand-by-category';
  if (trimmed === 'rep-05') return 'demand-by-area';
  if (trimmed === 'rep-06') return 'worker-utilization';
  if (trimmed === 'rep-07') return 'interview-conversion';
  if (trimmed === 'rep-08') return 'cancellation-rate';
  if (trimmed === 'rep-09') return 'replacement-rate';
  if (trimmed === 'rep-10') return 'payment-collections';
  if (trimmed === 'rep-11') return 'support-tickets';
  if (trimmed === 'rep-12' || trimmed === 'fr-rpt-012') return 'top-rated-workers-repeat-customers';
  return trimmed;
}

export function formatReportTitle(slug: string): string {
  const meta = REPORT_DEFINITIONS[slug];
  if (meta) return meta.name;
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getTodayISTDateString(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function buildStandardDateRange(criteria?: ReportFilterCriteria): { from: string; to: string } {
  const now = new Date();
  const todayIST = getTodayISTDateString(now);
  const to = criteria?.to || todayIST;

  if (criteria?.from) {
    return { from: criteria.from, to };
  }

  const offsetDate = (days: number) => getTodayISTDateString(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));

  if (criteria?.period === 'LAST_7_DAYS') {
    return { from: offsetDate(7), to };
  }

  if (criteria?.period === 'LAST_30_DAYS') {
    return { from: offsetDate(30), to };
  }

  if (criteria?.period === 'LAST_90_DAYS') {
    return { from: offsetDate(90), to };
  }

  return { from: `${to.slice(0, 4)}-01-01`, to };
}

export function generateExcelXml(
  sheetName: string,
  columns: string[],
  rows: Array<Record<string, string | number>>
): string {
  const sanitize = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${sanitize(sheetName)}</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="DataCell">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitize(sheetName).slice(0, 31)}">
  <Table>
`;

  const headerCells = columns
    .map((col) => `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${sanitize(col)}</Data></Cell>`)
    .join('\n');
  const headerRow = `   <Row ss:Height="24">\n${headerCells}\n   </Row>\n`;

  const dataRows = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const val = row[col];
          const isNum =
            typeof val === 'number' ||
            (typeof val === 'string' &&
              val.trim() !== '' &&
              !isNaN(Number(val)) &&
              !val.startsWith('0') &&
              !val.includes('-'));
          if (isNum) {
            return `    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${val}</Data></Cell>`;
          }
          return `    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${sanitize(val)}</Data></Cell>`;
        })
        .join('\n');
      return `   <Row ss:Height="20">\n${cells}\n   </Row>`;
    })
    .join('\n');

  const xmlFooter = `
  </Table>
 </Worksheet>
</Workbook>`;

  return xmlHeader + headerRow + dataRows + xmlFooter;
}

interface ParsedReportPayload {
  metricsSummary: ReportMetricSummary[];
  previewColumns: string[];
  previewRows: Array<Record<string, string | number>>;
  trendSeries?: Array<{ period: string; value: number; formattedValue?: string }>;
}

function formatReportMoney(minor: number, currency = 'INR'): string {
  const major = Number(minor || 0) / 100;
  return currency === 'INR' ? formatCurrencyINR(major) : `${currency} ${major.toFixed(2)}`;
}

export function parseBackendReportData(slug: string, rawData: unknown): ParsedReportPayload {
  const metricsSummary: ReportMetricSummary[] = [];
  let previewColumns: string[] = [];
  let previewRows: Array<Record<string, string | number>> = [];
  let trendSeries: Array<{ period: string; value: number; formattedValue?: string }> | undefined;

  if (!rawData) {
    return { metricsSummary, previewColumns: ['Metric', 'Value'], previewRows: [] };
  }

  switch (slug) {
    case 'new-customers': {
      if (Array.isArray(rawData)) {
        previewColumns = ['Date Bucket', 'Count'];
        previewRows = rawData.map((d: { date?: string; period?: string; count?: number }) => ({
          'Date Bucket': d.date || d.period || '',
          Count: Number(d.count || 0),
        }));
        const totalCount = previewRows.reduce((sum, r) => sum + Number(r.Count || 0), 0);
        metricsSummary.push({ label: 'Total New Customers', value: totalCount });
        break;
      }

      const data = rawData as { interval?: string; total?: number; series?: Array<{ period: string; count: number }> };
      const total = Number(data?.total ?? 0);
      metricsSummary.push({ label: 'Total New Customers', value: total });
      metricsSummary.push({ label: 'Cadence Interval', value: (data?.interval || 'month').toUpperCase() });
      metricsSummary.push({ label: 'Recorded Periods', value: data?.series?.length || 0 });

      previewColumns = ['Reporting Period', 'New Customer Accounts', 'Share of Total %'];
      if (Array.isArray(data?.series)) {
        previewRows = data.series.map((s) => {
          const count = Number(s.count || 0);
          const share = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0.0%';
          return {
            'Reporting Period': s.period,
            'New Customer Accounts': count,
            'Share of Total %': share,
          };
        });
      }
      break;
    }

    case 'worker-registrations': {
      const data = rawData as {
        interval?: string;
        registered?: number;
        verified?: number;
        verificationConversion?: number;
        series?: Array<{ period: string; registered: number; verified: number; verificationConversion: number }>;
      };
      const reg = Number(data?.registered ?? 0);
      const ver = Number(data?.verified ?? 0);
      const conv = Number(data?.verificationConversion ?? (reg > 0 ? ver / reg : 0));

      metricsSummary.push({ label: 'Total Registrations', value: reg });
      metricsSummary.push({ label: 'Fully Verified Today', value: ver });
      metricsSummary.push({ label: 'Overall Conversion', value: `${(conv * 100).toFixed(2)}%`, isPositive: conv >= 0.5 });

      previewColumns = ['Period', 'Registered Workers', 'Fully Verified Today', 'Conversion Rate %'];
      if (Array.isArray(data?.series)) {
        previewRows = data.series.map((s) => ({
          Period: s.period,
          'Registered Workers': Number(s.registered || 0),
          'Fully Verified Today': Number(s.verified || 0),
          'Conversion Rate %': `${(Number(s.verificationConversion || 0) * 100).toFixed(2)}%`,
        }));
      }
      break;
    }

    case 'booking-funnel': {
      const data = rawData as {
        interval?: string;
        requests?: number;
        confirmed?: number;
        confirmationRate?: number;
        series?: Array<{ period: string; requests: number; confirmed: number; confirmationRate: number }>;
      };
      const reqs = Number(data?.requests ?? 0);
      const conf = Number(data?.confirmed ?? 0);
      const rate = Number(data?.confirmationRate ?? (reqs > 0 ? conf / reqs : 0));

      metricsSummary.push({ label: 'Booking Requests', value: reqs });
      metricsSummary.push({ label: 'Reached Confirmed', value: conf });
      metricsSummary.push({ label: 'Net Confirmation Rate', value: `${(rate * 100).toFixed(2)}%`, isPositive: rate >= 0.2 });

      previewColumns = ['Period', 'Booking Requests Created', 'Reached Confirmed', 'Confirmation Rate %'];
      if (Array.isArray(data?.series)) {
        previewRows = data.series.map((s) => ({
          Period: s.period,
          'Booking Requests Created': Number(s.requests || 0),
          'Reached Confirmed': Number(s.confirmed || 0),
          'Confirmation Rate %': `${(Number(s.confirmationRate || 0) * 100).toFixed(2)}%`,
        }));
      }
      break;
    }

    case 'demand-by-category': {
      const data = rawData as { total?: number; categories?: Array<{ categoryId: string; code: string; name: string; requests: number }> };
      const total = Number(data?.total ?? 0);
      metricsSummary.push({ label: 'Total Demand Requests', value: total });
      metricsSummary.push({ label: 'Configured Categories', value: data?.categories?.length || 0 });

      previewColumns = ['Service Category', 'Category Code', 'Booking Requests', 'Share of Total %'];
      if (Array.isArray(data?.categories)) {
        previewRows = data.categories.map((c) => {
          const reqs = Number(c.requests || 0);
          const share = total > 0 ? `${((reqs / total) * 100).toFixed(1)}%` : '0.0%';
          return {
            'Service Category': c.name,
            'Category Code': c.code,
            'Booking Requests': reqs,
            'Share of Total %': share,
          };
        });
      }
      break;
    }

    case 'demand-by-area': {
      const areas = Array.isArray(rawData)
        ? (rawData as Array<{ areaId: string; city?: string; code?: string; name: string; requests: number }>)
        : [];
      const total = areas.reduce((sum, a) => sum + Number(a.requests || 0), 0);
      metricsSummary.push({ label: 'Total Area Requests', value: total });
      metricsSummary.push({ label: 'Active Clusters', value: areas.length });

      previewColumns = ['Geographic Service Area', 'City', 'Booking Requests', 'Share of Demand %'];
      previewRows = areas.map((a) => {
        const reqs = Number(a.requests || 0);
        const share = total > 0 ? `${((reqs / total) * 100).toFixed(1)}%` : '0.0%';
        return {
          'Geographic Service Area': a.name,
          City: a.city || a.code || '—',
          'Booking Requests': reqs,
          'Share of Demand %': share,
        };
      });
      break;
    }

    case 'worker-utilization': {
      const data = rawData as { verifiedWorkers?: number; workersWithActiveBooking?: number; utilization?: number };
      const verified = Number(data?.verifiedWorkers ?? 0);
      const active = Number(data?.workersWithActiveBooking ?? 0);
      const util = Number(data?.utilization ?? (verified > 0 ? active / verified : 0));

      metricsSummary.push({ label: 'Fully Verified Worker Pool', value: verified });
      metricsSummary.push({ label: 'Workers with Active Booking', value: active });
      metricsSummary.push({ label: 'Current Utilization Rate', value: `${(util * 100).toFixed(2)}%`, isPositive: util >= 0.5 });
      metricsSummary.push({ label: 'Available Standby Pool', value: Math.max(0, verified - active) });

      previewColumns = ['Operational Telemetry Metric', 'Current Snapshot Value'];
      previewRows = [
        { 'Operational Telemetry Metric': 'Verified Workers (Available Capacity)', 'Current Snapshot Value': verified },
        { 'Operational Telemetry Metric': 'Workers with Active Engagement', 'Current Snapshot Value': active },
        { 'Operational Telemetry Metric': 'Standby Pool Awaiting Placement', 'Current Snapshot Value': Math.max(0, verified - active) },
        { 'Operational Telemetry Metric': 'Workforce Utilization Ratio', 'Current Snapshot Value': `${(util * 100).toFixed(2)}%` },
      ];
      break;
    }

    case 'interview-conversion': {
      const data = rawData as { interviewsHeld?: number; confirmed?: number; conversion?: number };
      const held = Number(data?.interviewsHeld ?? 0);
      const conf = Number(data?.confirmed ?? 0);
      const conv = Number(data?.conversion ?? (held > 0 ? conf / held : 0));

      metricsSummary.push({ label: 'Interviews & Trials Held', value: held });
      metricsSummary.push({ label: 'Confirmed Placements', value: conf });
      metricsSummary.push({ label: 'Conversion Ratio', value: `${(conv * 100).toFixed(2)}%`, isPositive: conv >= 0.6 });

      previewColumns = ['Metric Indicator', 'Cohort Measurement'];
      previewRows = [
        { 'Metric Indicator': 'Interviews & Candidate Trials Completed', 'Cohort Measurement': held },
        { 'Metric Indicator': 'Job Confirmations Accepted', 'Cohort Measurement': conf },
        { 'Metric Indicator': 'Placement Realization Ratio', 'Cohort Measurement': `${(conv * 100).toFixed(2)}%` },
      ];
      break;
    }

    case 'cancellation-rate': {
      const data = rawData as { totalBookings?: number; cancelled?: number; cancellationRate?: number };
      const total = Number(data?.totalBookings ?? 0);
      const cancelled = Number(data?.cancelled ?? 0);
      const rate = Number(data?.cancellationRate ?? (total > 0 ? cancelled / total : 0));

      metricsSummary.push({ label: 'Total Created Bookings', value: total });
      metricsSummary.push({ label: 'Cancelled Bookings', value: cancelled });
      metricsSummary.push({ label: 'Cancellation Rate', value: `${(rate * 100).toFixed(2)}%`, isPositive: rate <= 0.15 });

      previewColumns = ['Booking Cohort Metric', 'Observed Value'];
      previewRows = [
        { 'Booking Cohort Metric': 'Total Booking Volume in Period', 'Observed Value': total },
        { 'Booking Cohort Metric': 'Cancelled Bookings Count', 'Observed Value': cancelled },
        { 'Booking Cohort Metric': 'Cancellation Proportion %', 'Observed Value': `${(rate * 100).toFixed(2)}%` },
      ];
      break;
    }

    case 'replacement-rate': {
      const data = rawData as { activeBookings?: number; replacementRequests?: number; replacementRate?: number };
      const active = Number(data?.activeBookings ?? 0);
      const replacements = Number(data?.replacementRequests ?? 0);
      const rate = Number(data?.replacementRate ?? (active > 0 ? replacements / active : 0));

      metricsSummary.push({ label: 'Active Placements Cohort', value: active });
      metricsSummary.push({ label: 'Replacement Requests Raised', value: replacements });
      metricsSummary.push({ label: 'Replacement Incident Rate', value: `${(rate * 100).toFixed(2)}%`, isPositive: rate <= 0.1 });

      previewColumns = ['Placement Lifecycle Metric', 'Observed Measurement'];
      previewRows = [
        { 'Placement Lifecycle Metric': 'Active Placements in Scope', 'Observed Measurement': active },
        { 'Placement Lifecycle Metric': 'Customer Replacement Requests', 'Observed Measurement': replacements },
        { 'Placement Lifecycle Metric': 'Replacement Request Ratio %', 'Observed Measurement': `${(rate * 100).toFixed(2)}%` },
      ];
      break;
    }

    case 'payment-collections': {
      type FeeTotalEntry = { feeCode?: string; currency?: string; payments?: number; grossMinor?: number; refundedMinor?: number };
      type CollectionSeriesEntry = {
        period: string;
        feeCode?: string;
        feeType?: string;
        currency?: string;
        payments?: number;
        count?: number;
        grossMinor?: number;
        refundedMinor?: number;
      };
      const data = rawData as {
        interval?: string;
        totalsByFeeType?: FeeTotalEntry[] | Record<string, FeeTotalEntry>;
        series?: CollectionSeriesEntry[];
      };

      let totalGrossMinor = 0;
      let totalRefundedMinor = 0;
      let totalPayments = 0;
      let primaryCurrency = 'INR';

      const feeTotals = Array.isArray(data?.totalsByFeeType)
        ? data.totalsByFeeType
        : data?.totalsByFeeType
        ? Object.values(data.totalsByFeeType)
        : [];

      for (const stats of feeTotals) {
        if (stats.currency) primaryCurrency = stats.currency;
        totalGrossMinor += Number(stats.grossMinor || 0);
        totalRefundedMinor += Number(stats.refundedMinor || 0);
        totalPayments += Number(stats.payments || 0);
      }

      previewColumns = ['Period', 'Fee Classification', 'Payments Count', 'Gross Collections (₹)', 'Refunded Amount (₹)'];
      const periodGrossMap = new Map<string, number>();

      if (Array.isArray(data?.series)) {
        previewRows = data.series.map((s) => {
          const grossMinor = Number(s.grossMinor || 0);
          const refundedMinor = Number(s.refundedMinor || 0);
          const paymentsCount = Number(s.payments ?? s.count ?? 0);
          const curr = s.currency || primaryCurrency;
          periodGrossMap.set(s.period, (periodGrossMap.get(s.period) ?? 0) + grossMinor);
          return {
            Period: s.period,
            'Fee Classification': s.feeCode || s.feeType || '—',
            'Payments Count': paymentsCount,
            'Gross Collections (₹)': formatReportMoney(grossMinor, curr),
            'Refunded Amount (₹)': formatReportMoney(refundedMinor, curr),
          };
        });
      }

      // Derive totals cleanly from series only if totalsByFeeType was omitted
      if (feeTotals.length === 0 && Array.isArray(data?.series)) {
        for (const s of data.series) {
          totalGrossMinor += Number(s.grossMinor || 0);
          totalRefundedMinor += Number(s.refundedMinor || 0);
          totalPayments += Number(s.payments ?? s.count ?? 0);
        }
      }

      metricsSummary.push({ label: 'Gross Settled Collections', value: formatReportMoney(totalGrossMinor, primaryCurrency) });
      metricsSummary.push({ label: 'Refunded Realizations', value: formatReportMoney(totalRefundedMinor, primaryCurrency) });
      metricsSummary.push({ label: 'Total Payments Recorded', value: totalPayments });

      if (periodGrossMap.size > 0) {
        trendSeries = Array.from(periodGrossMap.entries()).map(([period, minor]) => ({
          period,
          value: minor / 100,
          formattedValue: formatReportMoney(minor, primaryCurrency),
        }));
      }
      break;
    }

    case 'support-tickets': {
      const data = rawData as {
        created?: number;
        closed?: number;
        averageResolutionSeconds?: number | null;
        byStatus?: Array<{ status: string; count: number }>;
        series?: Array<{ period: string; count: number }>;
      };

      const created = Number(data?.created ?? 0);
      const closed = Number(data?.closed ?? 0);
      const avgSec =
        data?.averageResolutionSeconds !== null && data?.averageResolutionSeconds !== undefined
          ? Number(data.averageResolutionSeconds)
          : null;
      const avgHours = avgSec !== null && avgSec > 0 ? `${(avgSec / 3600).toFixed(1)} hrs` : 'N/A';

      metricsSummary.push({ label: 'Tickets Logged', value: created });
      metricsSummary.push({ label: 'Closed & Resolved', value: closed });
      metricsSummary.push({ label: 'Avg Resolution Turnaround', value: avgHours });

      previewColumns = ['Ticket Status', 'Ticket Count', 'Share of Volume %'];
      if (Array.isArray(data?.byStatus)) {
        previewRows = data.byStatus.map((b) => {
          const count = Number(b.count || 0);
          const share = created > 0 ? `${((count / created) * 100).toFixed(1)}%` : '0.0%';
          return {
            'Ticket Status': b.status,
            'Ticket Count': count,
            'Share of Volume %': share,
          };
        });
      }

      if (Array.isArray(data?.series)) {
        trendSeries = data.series.map((s) => ({
          period: s.period,
          value: Number(s.count || 0),
          formattedValue: String(Number(s.count || 0)),
        }));
      }
      break;
    }

    case 'top-rated-workers': {
      const workers = Array.isArray(rawData)
        ? (rawData as Array<{ workerId: string; name: string; ratingCount: number; averageRating: number }>)
        : [];
      metricsSummary.push({ label: 'Ranked Workers', value: workers.length });
      metricsSummary.push({ label: 'Top Rating', value: workers.length > 0 ? `${Number(workers[0].averageRating).toFixed(1)} ★` : 'N/A' });
      const totalRatings = workers.reduce((s, w) => s + Number(w.ratingCount || 0), 0);
      metricsSummary.push({ label: 'Consumer Reviews Evaluated', value: totalRatings });

      previewColumns = ['Worker Name', 'Worker Reference ID', 'Ratings Count', 'Average Rating'];
      previewRows = workers.map((w) => ({
        'Worker Name': w.name,
        'Worker Reference ID': w.workerId,
        'Ratings Count': Number(w.ratingCount || 0),
        'Average Rating': `${Number(w.averageRating || 0).toFixed(1)} ★`,
      }));
      break;
    }

    case 'repeat-customers': {
      const customers = Array.isArray(rawData)
        ? (rawData as Array<{ customerUserId: string; name: string; bookings: number }>)
        : [];
      metricsSummary.push({ label: 'Repeat Customers', value: customers.length });
      metricsSummary.push({ label: 'Top Repeat Customer', value: customers.length > 0 ? `${customers[0].name} (${customers[0].bookings})` : 'N/A' });
      const totalBookings = customers.reduce((s, c) => s + Number(c.bookings || 0), 0);
      metricsSummary.push({ label: 'Total Repeat Bookings', value: totalBookings });

      previewColumns = ['Customer Name', 'Customer User ID', 'Bookings Count'];
      previewRows = customers.map((c) => ({
        'Customer Name': c.name,
        'Customer User ID': c.customerUserId,
        'Bookings Count': Number(c.bookings || 0),
      }));
      break;
    }

    default: {
      previewColumns = ['Metric', 'Value'];
      if (typeof rawData === 'object' && rawData !== null) {
        for (const [k, v] of Object.entries(rawData as Record<string, unknown>)) {
          if (typeof v !== 'object') {
            previewRows.push({ Metric: formatReportTitle(k), Value: String(v) });
            metricsSummary.push({ label: formatReportTitle(k), value: String(v) });
          }
        }
      }
      break;
    }
  }

  return { metricsSummary, previewColumns, previewRows, trendSeries };
}

async function executeReportExport(
  repo: IReportRepository,
  reportId: string,
  format: 'CSV' | 'XLSX' | 'PDF' = 'CSV',
  criteria?: ReportFilterCriteria
): Promise<ExportResult> {
  const slug = resolveReportSlug(reportId);
  const activeSubTab = criteria?.subTab;

  // Combined FR-RPT-012 export when triggered without an explicit subTab (e.g. from Reports Catalogue)
  if ((slug === 'top-rated-workers-repeat-customers' || slug === 'fr-rpt-012') && !activeSubTab) {
    const [workersRep, repeatRep] = await Promise.all([
      repo.getReportById('top-rated-workers-repeat-customers', { ...criteria, subTab: 'top-rated-workers' }),
      repo.getReportById('top-rated-workers-repeat-customers', { ...criteria, subTab: 'repeat-customers' }),
    ]);
    const workerRows = workersRep?.previewRows || [];
    const repeatRows = repeatRep?.previewRows || [];
    const totalRowCount = workerRows.length + repeatRows.length;

    if (format === 'XLSX' && workersRep) {
      const combinedReport: ReportItem = {
        ...workersRep,
        cadence: REPORT_DEFINITIONS['top-rated-workers-repeat-customers'].cadence,
        from: repeatRep?.from ?? workersRep.from,
        to: repeatRep?.to ?? workersRep.to,
        notes: Array.from(new Set([...(workersRep.notes || []), ...(repeatRep?.notes || [])])),
        metricsSummary: [...workersRep.metricsSummary, ...(repeatRep?.metricsSummary || [])],
        extraSheets: repeatRep
          ? [
              {
                sheetName: 'Repeat Customers',
                columns: repeatRep.previewColumns,
                rows: repeatRows,
              },
            ]
          : undefined,
      };
      const fileName = getReportCanonicalFilename(combinedReport, 'xlsx');
      const xlsxBuffer = await generateProfessionalExcel(combinedReport, criteria);
      return {
        fileName,
        xlsxBuffer,
        format: 'XLSX',
        rowCount: totalRowCount,
        generatedAt: new Date().toISOString(),
      };
    }

    const csvColumns = ['Section', 'Name', 'Reference ID', 'Count', 'Metric'];
    const csvRows: Array<Record<string, string | number>> = [
      ...workerRows.map((r) => ({
        Section: 'Top-Rated Workers',
        Name: r['Worker Name'] ?? '',
        'Reference ID': r['Worker Reference ID'] ?? '',
        Count: r['Ratings Count'] ?? 0,
        Metric: r['Average Rating'] ?? '',
      })),
      ...repeatRows.map((r) => ({
        Section: 'Repeat Customers',
        Name: r['Customer Name'] ?? '',
        'Reference ID': r['Customer User ID'] ?? '',
        Count: r['Bookings Count'] ?? r['Completed Bookings'] ?? 0,
        Metric: r['Retention Tier'] ?? 'Repeat Customer Bookings',
      })),
    ];
    const metaRef = workersRep || repeatRep || REPORT_DEFINITIONS['top-rated-workers-repeat-customers'];
    const fileName = getReportCanonicalFilename(
      { requirement: metaRef.requirement, name: metaRef.name, id: 'top-rated-workers-repeat-customers' },
      'csv'
    );
    return {
      fileName,
      csvContent: generateCleanCsv(csvColumns, csvRows),
      format: 'CSV',
      rowCount: totalRowCount,
      generatedAt: new Date().toISOString(),
    };
  }

  let rep = await repo.getReportById(reportId, criteria);
  const rows = rep?.previewRows || [];
  const columns = rep?.previewColumns || (rows.length > 0 ? Object.keys(rows[0]) : ['Metric', 'Value']);
  const effectiveSubTab = activeSubTab || rep?.activeSubTab;

  const combinedSheets = [
    ...(rep?.extraSheets || []),
  ];

  // Include supplementary periodic series sheet for support-tickets Excel export when present
  if (format === 'XLSX' && rep && rep.id === 'support-tickets' && rep.trendSeries && rep.trendSeries.length > 0) {
    combinedSheets.push({
      sheetName: 'Periodic Volume',
      columns: ['Reporting Period', 'Tickets Created'],
      rows: rep.trendSeries.map((pt) => ({
        'Reporting Period': pt.period,
        'Tickets Created': pt.value,
      })),
    });
  }

  // Include record-level worksheet for Excel when backend operational records were retrieved
  if (format === 'XLSX' && rep?.detailDataset) {
    combinedSheets.push({
      sheetName: rep.detailDataset.title,
      columns: rep.detailDataset.columns,
      rows: rep.detailDataset.rows,
    });
  }

  if (rep && combinedSheets.length > 0) {
    rep = { ...rep, extraSheets: combinedSheets };
  }

  const totalXlsxRows = rows.length + (rep?.extraSheets?.reduce((sum, s) => sum + s.rows.length, 0) ?? 0);

  if (format === 'XLSX') {
    const fileName = rep
      ? getReportCanonicalFilename(rep, 'xlsx', effectiveSubTab)
      : `FR-RPT_${reportId}.xlsx`;
    const xlsxBuffer = rep
      ? await generateProfessionalExcel(rep, criteria)
      : new Uint8Array();

    return {
      fileName,
      xlsxBuffer,
      format: 'XLSX',
      rowCount: totalXlsxRows,
      generatedAt: new Date().toISOString(),
    };
  }

  const fileName = rep
    ? getReportCanonicalFilename(rep, 'csv', effectiveSubTab)
    : `FR-RPT_${reportId}.csv`;
  const csvContent = generateCleanCsv(columns, rows, rep?.detailDataset);
  const totalCsvRows = rows.length + (rep?.detailDataset?.rows.length ?? 0);

  return {
    fileName,
    csvContent,
    format: 'CSV',
    rowCount: totalCsvRows,
    generatedAt: new Date().toISOString(),
  };
}

export class RealReportRepository implements IReportRepository {
  async getReports(category?: ReportCategory, search?: string): Promise<ReportItem[]> {
    try {
      const res = await httpClient.get<unknown>('/admin/reports');
      const catalog = Array.isArray(res.data)
        ? (res.data as Record<string, unknown>[])
        : res.data && typeof res.data === 'object' && 'data' in res.data && Array.isArray((res.data as { data: unknown }).data)
        ? (res.data as { data: Record<string, unknown>[] }).data
        : [];

      // Group by requirement to unify FR-RPT-012 into a single report matching PRD Section 14
      const itemsMap = new Map<string, ReportItem>();

      for (const raw of catalog) {
        const slug = String(raw.report || raw.code || raw.id || 'report');
        const req = String(raw.requirement || 'FR-RPT-000');

        if (req === 'FR-RPT-012') {
          if (!itemsMap.has('FR-RPT-012')) {
            const meta = REPORT_DEFINITIONS['top-rated-workers-repeat-customers'];
            itemsMap.set('FR-RPT-012', {
              id: 'top-rated-workers-repeat-customers',
              requirement: 'FR-RPT-012',
              name: meta.name,
              category: meta.category,
              description: meta.defaultDescription,
              cadence: meta.cadence,
              notes: [
                'Combines top-rated worker ranking and repeat customer retention defined in PRD Section 14 bullet 12.',
                'Top-rated workers: all-time totals ranked by average rating and rating count.',
                'Repeat customers: customer cohorts who created more than one booking in the selected date range.',
              ],
              metricsSummary: [{ label: 'PRD Requirement', value: 'FR-RPT-012' }],
              previewColumns: ['Metric', 'Value'],
              previewRows: [],
              supportedFilters: meta.supportedFilters,
              subTabs: [
                { id: 'top-rated-workers', label: 'Top-Rated Domestic Workers', slug: 'top-rated-workers' },
                { id: 'repeat-customers', label: 'Repeat Customer Retention', slug: 'repeat-customers' },
              ],
              activeSubTab: 'top-rated-workers',
            });
          }
          continue;
        }

        const meta = REPORT_DEFINITIONS[slug] || {
          slug,
          requirement: req,
          name: formatReportTitle(slug),
          category: 'Operations',
          cadence: 'Live Telemetry',
          defaultDescription: String(raw.definition || ''),
          supportedFilters: { dateRange: true, interval: false, minRatings: false },
        };

        const notes = Array.isArray(raw.notes) ? (raw.notes as string[]) : [];

        itemsMap.set(slug, {
          id: slug,
          requirement: meta.requirement,
          name: meta.name,
          category: meta.category,
          description: String(raw.definition || meta.defaultDescription),
          cadence: meta.cadence,
          notes,
          metricsSummary: [{ label: 'PRD Requirement', value: meta.requirement }],
          previewColumns: ['Metric', 'Value'],
          previewRows: [],
          supportedFilters: meta.supportedFilters,
        });
      }

      let items: ReportItem[] = Array.from(itemsMap.values());

      if (category && category !== 'ALL') {
        items = items.filter((r) => r.category === category);
      }
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        items = items.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q) ||
            r.requirement.toLowerCase().includes(q)
        );
      }

      return items;
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getReportById(id: string, criteria?: ReportFilterCriteria): Promise<ReportItem | null> {
    try {
      const rawSlug = resolveReportSlug(id);
      let actualEndpointSlug = rawSlug;
      let isUnified12 = false;
      let activeSubTab = criteria?.subTab || 'top-rated-workers';

      if (rawSlug === 'top-rated-workers-repeat-customers' || rawSlug === 'fr-rpt-012') {
        isUnified12 = true;
        actualEndpointSlug = activeSubTab === 'repeat-customers' ? 'repeat-customers' : 'top-rated-workers';
      }

      const meta = REPORT_DEFINITIONS[actualEndpointSlug] || REPORT_DEFINITIONS[rawSlug] || {
        slug: actualEndpointSlug,
        requirement: 'FR-RPT-000',
        name: formatReportTitle(actualEndpointSlug),
        category: 'Operations',
        cadence: 'Live Telemetry',
        defaultDescription: 'Authoritative telemetry report calculated by backend services.',
        supportedFilters: { dateRange: true, interval: false, minRatings: false },
      };

      const dateRange = buildStandardDateRange(criteria);
      const params: Record<string, unknown> = {};

      if (meta.supportedFilters.dateRange) {
        params.from = dateRange.from;
        params.to = dateRange.to;
      }
      if (meta.supportedFilters.interval) {
        params.interval = criteria?.interval || 'month';
      }
      if (meta.supportedFilters.minRatings && criteria?.minRatings !== undefined) {
        params.minRatings = criteria.minRatings;
      }
      const isPaginatedReport =
        actualEndpointSlug === 'demand-by-area' ||
        actualEndpointSlug === 'top-rated-workers' ||
        actualEndpointSlug === 'repeat-customers';
      if (criteria?.page) params.page = criteria.page;
      if (criteria?.limit || isPaginatedReport) {
        params.limit = criteria?.limit ?? 100;
      }

      const endpoint = `/admin/reports/${encodeURIComponent(actualEndpointSlug)}`;
      const res = await httpClient.get<Record<string, unknown>>(endpoint, { params });
      const envelope = res.data;
      let rawData = envelope?.data !== undefined ? envelope.data : envelope;

      // Aggregate remaining pages on paginated reports when caller didn't request a single page
      const metaObj = (envelope?.meta && typeof envelope.meta === 'object'
        ? (envelope.meta as { total?: number; limit?: number })
        : undefined);
      if (
        isPaginatedReport &&
        !criteria?.page &&
        Array.isArray(rawData) &&
        metaObj?.total &&
        metaObj.total > rawData.length
      ) {
        const pageSize = Number(params.limit || metaObj.limit || 100);
        const totalPages = Math.ceil(metaObj.total / pageSize);
        const allRows = [...rawData];
        for (let p = 2; p <= totalPages; p += 1) {
          const nextRes = await httpClient.get<Record<string, unknown>>(endpoint, {
            params: { ...params, page: p, limit: pageSize },
          });
          const nextRows = nextRes.data?.data;
          if (Array.isArray(nextRows)) {
            allRows.push(...nextRows);
          }
        }
        rawData = allRows;
      }

      const definition = typeof envelope?.definition === 'string'
        ? envelope.definition
        : meta.defaultDescription;
      const notes = Array.isArray(envelope?.notes) ? (envelope.notes as string[]) : [];

      const parsed = parseBackendReportData(actualEndpointSlug, rawData);

      const baseReport: ReportItem = isUnified12
        ? {
            id: 'top-rated-workers-repeat-customers',
            requirement: 'FR-RPT-012',
            name: REPORT_DEFINITIONS['top-rated-workers-repeat-customers'].name,
            category: REPORT_DEFINITIONS['top-rated-workers-repeat-customers'].category,
            description: definition || REPORT_DEFINITIONS['top-rated-workers-repeat-customers'].defaultDescription,
            cadence: REPORT_DEFINITIONS['top-rated-workers-repeat-customers'].cadence,
            notes,
            metricsSummary: parsed.metricsSummary.length > 0 ? parsed.metricsSummary : [{ label: 'Status', value: 'Live' }],
            previewColumns: parsed.previewColumns,
            previewRows: parsed.previewRows,
            from: (envelope?.from as string) || (params.from as string) || null,
            to: (envelope?.to as string) || (params.to as string) || null,
            interval: (params.interval as 'day' | 'week' | 'month') || undefined,
            supportedFilters: actualEndpointSlug === 'top-rated-workers'
              ? { dateRange: false, interval: false, minRatings: true }
              : { dateRange: true, interval: false, minRatings: false },
            trendSeries: parsed.trendSeries,
            subTabs: [
              { id: 'top-rated-workers', label: 'Top-Rated Domestic Workers', slug: 'top-rated-workers' },
              { id: 'repeat-customers', label: 'Repeat Customer Retention', slug: 'repeat-customers' },
            ],
            activeSubTab,
          }
        : {
            id: actualEndpointSlug,
            requirement: meta.requirement,
            name: meta.name,
            category: meta.category,
            description: definition,
            cadence: meta.cadence,
            notes,
            metricsSummary: parsed.metricsSummary.length > 0 ? parsed.metricsSummary : [{ label: 'Status', value: 'Live' }],
            previewColumns: parsed.previewColumns,
            previewRows: parsed.previewRows,
            from: (envelope?.from as string) || (params.from as string) || null,
            to: (envelope?.to as string) || (params.to as string) || null,
            interval: (params.interval as 'day' | 'week' | 'month') || undefined,
            supportedFilters: meta.supportedFilters,
            trendSeries: parsed.trendSeries,
          };

      if (criteria?.includeDetailedRecords) {
        return await enrichReportWithBackendRecords(actualEndpointSlug, baseReport, baseReport.from, baseReport.to);
      }

      return baseReport;
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async generateExport(
    reportId: string,
    format: 'CSV' | 'XLSX' | 'PDF' = 'CSV',
    criteria?: ReportFilterCriteria
  ): Promise<ExportResult> {
    try {
      return await executeReportExport(this, reportId, format, criteria);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export class MockReportRepository implements IReportRepository {
  private reports: ReportItem[] = [
    {
      id: 'new-customers',
      requirement: 'FR-RPT-001',
      name: 'New Customer Acquisition by Period & Locality',
      category: 'Growth',
      description: 'Customer accounts created per day/week/month (registers on first OTP verification).',
      cadence: 'Periodic (Daily / Weekly / Monthly)',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Total New Customers', value: 12 }],
      previewColumns: ['Date Bucket', 'Count'],
      previewRows: [
        { 'Date Bucket': '2026-10-01', Count: 5 },
        { 'Date Bucket': '2026-10-15', Count: 7 },
      ],
      supportedFilters: { dateRange: true, interval: true, minRatings: false },
    },
    {
      id: 'worker-registrations',
      requirement: 'FR-RPT-002',
      name: 'Worker Registration & Onboarding Drop-off Funnel',
      category: 'Workforce',
      description: 'Worker profiles created in the period, and how many are fully verified today.',
      cadence: 'Periodic (Daily / Weekly / Monthly)',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Total Registrations', value: 35 }],
      previewColumns: ['Period', 'Registered Workers', 'Fully Verified Today', 'Conversion Rate %'],
      previewRows: [{ Period: '2026-10', 'Registered Workers': 35, 'Fully Verified Today': 24, 'Conversion Rate %': '68.6%' }],
      supportedFilters: { dateRange: true, interval: true, minRatings: false },
    },
    {
      id: 'booking-funnel',
      requirement: 'FR-RPT-003',
      name: 'Booking Requests vs Confirmed Bookings',
      category: 'Marketplace',
      description: 'Booking requests created in the period, and how many reached confirmed status.',
      cadence: 'Periodic (Daily / Weekly / Monthly)',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Booking Requests', value: 48 }],
      previewColumns: ['Period', 'Booking Requests Created', 'Reached Confirmed', 'Confirmation Rate %'],
      previewRows: [{ Period: '2026-10', 'Booking Requests Created': 48, 'Reached Confirmed': 32, 'Confirmation Rate %': '66.7%' }],
      supportedFilters: { dateRange: true, interval: true, minRatings: false },
    },
    {
      id: 'demand-by-category',
      requirement: 'FR-RPT-004',
      name: 'Category-Wise Demand Distribution',
      category: 'Marketplace',
      description: 'Booking requests created in the period, grouped across all configured service categories.',
      cadence: 'Monthly / Cohort Demand',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Total Demand Requests', value: 48 }],
      previewColumns: ['Service Category', 'Category Code', 'Booking Requests', 'Share of Total %'],
      previewRows: [{ 'Service Category': 'House Maid', 'Category Code': 'HOUSE_MAID', 'Booking Requests': 28, 'Share of Total %': '58.3%' }],
      supportedFilters: { dateRange: true, interval: false, minRatings: false },
    },
    {
      id: 'demand-by-area',
      requirement: 'FR-RPT-005',
      name: 'Area-Wise Demand Distribution',
      category: 'Marketplace',
      description: 'Booking requests created in the period, grouped by service area clusters (busiest first).',
      cadence: 'Geographic Cohort (Paginated)',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Total Area Requests', value: 48 }],
      previewColumns: ['Geographic Service Area', 'City', 'Booking Requests', 'Share of Demand %'],
      previewRows: [{ 'Geographic Service Area': 'Madhapur', City: 'Hyderabad', 'Booking Requests': 22, 'Share of Demand %': '45.8%' }],
      supportedFilters: { dateRange: true, interval: false, minRatings: false },
    },
    {
      id: 'worker-utilization',
      requirement: 'FR-RPT-006',
      name: 'Domestic Worker Utilization Snapshot',
      category: 'Workforce',
      description: 'Share of fully verified, active, submitted workers holding an active booking right now.',
      cadence: 'Point-in-Time Snapshot',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Fully Verified Worker Pool', value: 24 }],
      previewColumns: ['Operational Telemetry Metric', 'Current Snapshot Value'],
      previewRows: [{ 'Operational Telemetry Metric': 'Workforce Utilization Ratio', 'Current Snapshot Value': '8.33%' }],
      supportedFilters: { dateRange: false, interval: false, minRatings: false },
    },
    {
      id: 'interview-conversion',
      requirement: 'FR-RPT-007',
      name: 'Interview-to-Confirmation Conversion',
      category: 'Operations',
      description: 'Of bookings that completed an interview/trial, the share that reached confirmed.',
      cadence: 'Cohort Conversion Ratio',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Interviews & Trials Held', value: 30 }],
      previewColumns: ['Metric Indicator', 'Cohort Measurement'],
      previewRows: [{ 'Metric Indicator': 'Placement Realization Ratio', 'Cohort Measurement': '73.33%' }],
      supportedFilters: { dateRange: true, interval: false, minRatings: false },
    },
    {
      id: 'cancellation-rate',
      requirement: 'FR-RPT-008',
      name: 'Booking Cancellation Rate',
      category: 'Operations',
      description: 'Bookings created in the period that are cancelled now, divided by all bookings created.',
      cadence: 'Cohort Cancellation Ratio',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Total Created Bookings', value: 48 }],
      previewColumns: ['Booking Cohort Metric', 'Observed Value'],
      previewRows: [{ 'Booking Cohort Metric': 'Cancellation Proportion %', 'Observed Value': '6.25%' }],
      supportedFilters: { dateRange: true, interval: false, minRatings: false },
    },
    {
      id: 'replacement-rate',
      requirement: 'FR-RPT-009',
      name: 'Worker Replacement Rate',
      category: 'Operations',
      description: 'Replacement requests raised for bookings created in the period that reached active status.',
      cadence: 'Active Placements Cohort',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Active Placements Cohort', value: 20 }],
      previewColumns: ['Placement Lifecycle Metric', 'Observed Measurement'],
      previewRows: [{ 'Placement Lifecycle Metric': 'Replacement Request Ratio %', 'Observed Measurement': '5.00%' }],
      supportedFilters: { dateRange: true, interval: false, minRatings: false },
    },
    {
      id: 'payment-collections',
      requirement: 'FR-RPT-010',
      name: 'Payment Collections & Fee Realization',
      category: 'Finance',
      description: 'Gross collections, fee codes, count, and refunds recorded in the period (INR).',
      cadence: 'Financial Period Ledger',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Gross Settled Collections', value: '₹4,000' }],
      previewColumns: ['Period', 'Fee Classification', 'Payments Count', 'Gross Collections (₹)', 'Refunded Amount (₹)'],
      previewRows: [{ Period: '2026-10', 'Fee Classification': 'BOOKING_FEE', 'Payments Count': 8, 'Gross Collections (₹)': '₹4,000', 'Refunded Amount (₹)': '₹0' }],
      supportedFilters: { dateRange: true, interval: true, minRatings: false },
    },
    {
      id: 'support-tickets',
      requirement: 'FR-RPT-011',
      name: 'Support Ticket Volume & Resolution Time',
      category: 'Support',
      description: 'Tickets created in the period by status, and average turnaround time to closure.',
      cadence: 'Service Quality Metric',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Tickets Logged', value: 14 }],
      previewColumns: ['Ticket Status', 'Ticket Count', 'Share of Volume %'],
      previewRows: [{ 'Ticket Status': 'RESOLVED', 'Ticket Count': 12, 'Share of Volume %': '85.7%' }],
      supportedFilters: { dateRange: true, interval: true, minRatings: false },
    },
    {
      id: 'top-rated-workers-repeat-customers',
      requirement: 'FR-RPT-012',
      name: 'Top-Rated Workers & Repeat Customers',
      category: 'Retention',
      description: 'Workers ranked by average consumer rating, and customer cohorts creating repeat bookings in the period (PRD Section 14).',
      cadence: 'Quality & Retention Cohort (Paginated)',
      notes: ['Mock baseline evaluation for unit tests.'],
      metricsSummary: [{ label: 'Ranked Workers', value: 3 }],
      previewColumns: ['Worker Name', 'Worker Reference ID', 'Ratings Count', 'Average Rating'],
      previewRows: [{ 'Worker Name': 'Shabana Begum', 'Worker Reference ID': 'W-001', 'Ratings Count': 1, 'Average Rating': '5.0 ★' }],
      supportedFilters: { dateRange: true, interval: false, minRatings: true },
      subTabs: [
        { id: 'top-rated-workers', label: 'Top-Rated Domestic Workers', slug: 'top-rated-workers' },
        { id: 'repeat-customers', label: 'Repeat Customer Retention', slug: 'repeat-customers' },
      ],
      activeSubTab: 'top-rated-workers',
    },
  ];

  async getReports(category?: ReportCategory, search?: string): Promise<ReportItem[]> {
    let result = this.reports;
    if (category && category !== 'ALL') {
      result = result.filter((r) => r.category === category);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.requirement.toLowerCase().includes(q)
      );
    }
    return result;
  }

  async getReportById(id: string, criteria?: ReportFilterCriteria): Promise<ReportItem | null> {
    const slug = resolveReportSlug(id);
    const rep = this.reports.find((r) => r.id === slug || r.requirement.toLowerCase() === slug.toLowerCase()) || this.reports[0];

    if (slug === 'top-rated-workers-repeat-customers' && criteria?.subTab === 'repeat-customers') {
      return {
        ...rep,
        activeSubTab: 'repeat-customers',
        previewColumns: ['Customer Name', 'Customer User ID', 'Completed Bookings', 'Retention Tier'],
        previewRows: [
          { 'Customer Name': 'Rohan Rao', 'Customer User ID': 'C-1092', 'Completed Bookings': 3, 'Retention Tier': 'Repeat Booker' },
        ],
        metricsSummary: [
          { label: 'Repeat Customers', value: 1 },
          { label: 'Total Repeat Bookings', value: 3 },
        ],
      };
    }

    return rep;
  }

  async generateExport(
    reportId: string,
    format: 'CSV' | 'XLSX' | 'PDF' = 'CSV',
    criteria?: ReportFilterCriteria
  ): Promise<ExportResult> {
    return executeReportExport(this, reportId, format, criteria);
  }
}

export { RealReportRepository as ReportRepositoryImpl };

export const createReportRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IReportRepository => {
  return useMock ? new MockReportRepository() : new RealReportRepository();
};

export const reportRepository: IReportRepository = createReportRepository();
