export type ReportCategory =
  | 'ALL'
  | 'Growth'
  | 'Workforce'
  | 'Marketplace'
  | 'Operations'
  | 'Finance'
  | 'Support'
  | 'Retention';

export type ReportPeriod = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'YEAR_TO_DATE' | 'ALL_TIME' | 'CUSTOM';
export type ReportInterval = 'day' | 'week' | 'month';

export interface ReportMetricSummary {
  label: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
}

export interface ReportSupportedFilters {
  dateRange: boolean;
  interval: boolean;
  minRatings: boolean;
}

export interface ReportItem {
  id: string; // slug, e.g. 'new-customers' or 'top-rated-workers-repeat-customers'
  requirement: string; // e.g. 'FR-RPT-001'
  name: string;
  category: Exclude<ReportCategory, 'ALL'>;
  description: string;
  cadence: string; // e.g. 'Monthly / Cohort', 'Point-in-Time Snapshot', 'All-Time Ranked'
  notes?: string[];
  metricsSummary: ReportMetricSummary[];
  previewColumns: string[];
  previewRows: Array<Record<string, string | number>>;
  from?: string | null;
  to?: string | null;
  interval?: ReportInterval;
  supportedFilters?: ReportSupportedFilters;
  subTabs?: Array<{ id: string; label: string; slug: string }>;
  activeSubTab?: string;
}

export interface ReportFilterCriteria {
  from?: string;
  to?: string;
  interval?: ReportInterval;
  period?: ReportPeriod;
  minRatings?: number;
  page?: number;
  limit?: number;
  search?: string;
  category?: ReportCategory;
  subTab?: string;
}

export interface ExportResult {
  fileName: string;
  csvContent?: string;
  xlsxContent?: string;
  xlsxBuffer?: Uint8Array | ArrayBuffer;
  format: 'CSV' | 'XLSX' | 'PDF';
  rowCount: number;
  generatedAt: string;
}

export interface IReportRepository {
  getReports(category?: ReportCategory, search?: string): Promise<ReportItem[]>;
  getReportById(id: string, criteria?: ReportFilterCriteria): Promise<ReportItem | null>;
  generateExport(reportId: string, format?: 'CSV' | 'XLSX' | 'PDF', criteria?: ReportFilterCriteria): Promise<ExportResult>;
}
