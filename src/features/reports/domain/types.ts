export type ReportCategory =
  | 'ALL'
  | 'Growth'
  | 'Workforce'
  | 'Trust & Safety'
  | 'Marketplace'
  | 'Operations'
  | 'Support'
  | 'Finance';

export type ReportPeriod = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'YEAR_TO_DATE';

export interface ReportMetricSummary {
  label: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
}

export interface ReportItem {
  id: string;
  name: string;
  category: Exclude<ReportCategory, 'ALL'>;
  description: string;
  lastRun: string;
  metricsSummary: ReportMetricSummary[];
  previewColumns: string[];
  previewRows: Array<Record<string, string | number>>;
}

export interface ReportFilterCriteria {
  period?: ReportPeriod;
  clusterArea?: string;
  serviceCategory?: string;
  search?: string;
}

export interface ExportResult {
  fileName: string;
  csvContent?: string;
  format: 'CSV' | 'PDF';
  rowCount: number;
  generatedAt: string;
}

export interface IReportRepository {
  getReports(category?: ReportCategory, search?: string): Promise<ReportItem[]>;
  getReportById(id: string, criteria?: ReportFilterCriteria): Promise<ReportItem | null>;
  generateExport(reportId: string, format: 'CSV' | 'PDF', criteria?: ReportFilterCriteria): Promise<ExportResult>;
}
