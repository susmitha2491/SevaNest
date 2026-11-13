import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  Info,
  Layers,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import {
  reportRepository,
  buildStandardDateRange,
  getTodayISTDateString,
} from '../data/reportRepository';
import { ReportCategory, ReportInterval, ReportItem, ReportPeriod } from '../domain/types';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { SearchInput } from '../../../components/common/SearchInput';
import { CustomSelect } from '../../../components/common/CustomSelect';

function triggerDownload(
  content: string | ArrayBuffer | Uint8Array,
  fileName: string,
  mimeType: string
) {
  if (typeof window === 'undefined') return;
  if (typeof window.URL?.createObjectURL === 'function') {
    const rawData = content instanceof Uint8Array ? content.buffer : content;
    const blob = new window.Blob([rawData as unknown as string], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof window.URL?.revokeObjectURL === 'function') {
      window.URL.revokeObjectURL(url);
    }
  }
}

function isNumericHeaderOrValue(col: string, val: string | number | undefined): boolean {
  if (typeof val === 'number') return true;
  if (col.includes('%') || col.includes('₹') || /count|requests|bookings|rating|value|amount/i.test(col)) {
    return true;
  }
  return false;
}

function formatTrendPeriodLabel(rawPeriod: string, interval?: ReportInterval): string {
  if (!rawPeriod) return '';
  if (interval === 'month' && /^\d{4}-\d{2}-\d{2}$/.test(rawPeriod)) {
    return rawPeriod.slice(0, 7);
  }
  return rawPeriod;
}

function getCategoryBadgeColors(category: ReportItem['category']): { bg: string; text: string } {
  switch (category) {
    case 'Finance':
      return { bg: '#ECFDF5', text: '#065F46' };
    case 'Marketplace':
      return { bg: '#EFF6FF', text: '#1E40AF' };
    case 'Workforce':
      return { bg: '#F5F3FF', text: '#5B21B6' };
    case 'Operations':
      return { bg: '#FFFBEB', text: '#92400E' };
    case 'Support':
      return { bg: '#FEF2F2', text: '#991B1B' };
    default:
      return { bg: '#F0FDF4', text: '#166534' };
  }
}

interface ExportButtonProps {
  ariaLabel: string;
  disabled?: boolean;
  isExportingThis?: boolean;
  variant?: 'secondary' | 'primary';
  onExport: () => void;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  ariaLabel,
  disabled = false,
  isExportingThis = false,
  variant = 'secondary',
  onExport,
}) => {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: isPrimary ? '7px 12px' : '6px 10px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isPrimary ? 'var(--color-brand-600)' : 'var(--color-surface)',
        color: isPrimary ? '#ffffff' : 'var(--color-text-primary)',
        border: isPrimary ? 'none' : '1px solid var(--color-border)',
        fontSize: '11px',
        fontWeight: isPrimary ? 700 : 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        boxShadow: isPrimary ? 'var(--shadow-sm)' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {isExportingThis ? (
        <>
          <RefreshCw size={12} className="animate-spin" />
          <span>Exporting...</span>
        </>
      ) : (
        <>
          <Download size={12} />
          <span>Export</span>
        </>
      )}
    </button>
  );
};

interface ReportDataTableProps {
  title: string;
  subtitle: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  emptyText: string;
  searchable?: boolean;
  maxHeight?: string;
}

const ReportDataTable: React.FC<ReportDataTableProps> = ({
  title,
  subtitle,
  columns,
  rows,
  emptyText,
  searchable = false,
  maxHeight,
}) => {
  const [tableFilter, setTableFilter] = useState('');

  const filteredRows = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((col) => String(row[col] ?? '').toLowerCase().includes(q))
    );
  }, [rows, columns, tableFilter]);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 'var(--space-2) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-navy)' }}>
            {title} ({filteredRows.length}{tableFilter.trim() ? ` / ${rows.length}` : ''} Records)
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {subtitle}
          </span>
        </div>
        {searchable && rows.length > 0 && (
          <SearchInput
            value={tableFilter}
            onChange={(val) => setTableFilter(val)}
            placeholder="Filter records..."
            ariaLabel={`Filter ${title}`}
            containerStyle={{ width: 'min(100%, 240px)' }}
          />
        )}
      </div>

      <div style={{ overflowX: 'auto', maxHeight, overflowY: maxHeight ? 'auto' : undefined }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)' }}>
              {columns.map((col, idx) => {
                const numeric = isNumericHeaderOrValue(col, filteredRows[0]?.[col]);
                return (
                  <th
                    key={idx}
                    style={{
                      position: maxHeight ? 'sticky' : undefined,
                      top: maxHeight ? 0 : undefined,
                      backgroundColor: maxHeight ? 'var(--color-bg-app)' : undefined,
                      padding: '9px 14px',
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      fontSize: '11px',
                      textAlign: numeric ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    backgroundColor: rIdx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg-subtle)',
                  }}
                >
                  {columns.map((col, cIdx) => {
                    const numeric = isNumericHeaderOrValue(col, row[col]);
                    return (
                      <td
                        key={cIdx}
                        style={{
                          padding: '9px 14px',
                          color: 'var(--color-text-primary)',
                          fontWeight: cIdx === 0 ? 600 : 400,
                          textAlign: numeric ? 'right' : 'left',
                          fontVariantNumeric: numeric ? 'tabular-nums' : undefined,
                          whiteSpace: cIdx === 0 ? 'nowrap' : undefined,
                        }}
                      >
                        {row[col] !== undefined ? String(row[col]) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ReportsDashboardPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const todayIST = useMemo(() => getTodayISTDateString(), []);

  // Catalogue state
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);

  // Report Detail Filter state
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('YEAR_TO_DATE');
  const [selectedInterval, setSelectedInterval] = useState<ReportInterval>('month');
  const [customFrom, setCustomFrom] = useState(() => `${todayIST.slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(() => todayIST);
  const [minRatings, setMinRatings] = useState<number>(0);
  const [selectedSubTab, setSelectedSubTab] = useState<'top-rated-workers' | 'repeat-customers'>('top-rated-workers');

  const canViewReports = hasPermission(user?.permissions, PERMISSIONS.REPORTS_VIEW);
  const canExport = Boolean(canViewReports || hasPermission(user?.permissions, PERMISSIONS.EXPORTS_GENERATE));

  const {
    data: reports,
    isLoading: isCatalogLoading,
    isFetching: isCatalogFetching,
    error: catalogError,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: ['reports', 'catalog', selectedCategory, debouncedSearchTerm],
    queryFn: () => reportRepository.getReports(selectedCategory, debouncedSearchTerm),
    enabled: canViewReports,
    placeholderData: keepPreviousData,
  });

  // Track category counts from the unfiltered catalog without extra API calls
  const [catalogCounts, setCatalogCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (selectedCategory === 'ALL' && debouncedSearchTerm.trim() === '' && Array.isArray(reports)) {
      const counts: Record<string, number> = { ALL: reports.length };
      for (const r of reports) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
      setCatalogCounts(counts);
    }
  }, [reports, selectedCategory, debouncedSearchTerm]);

  const dateRange = buildStandardDateRange({
    period: selectedPeriod,
    from: selectedPeriod === 'CUSTOM' ? customFrom : undefined,
    to: selectedPeriod === 'CUSTOM' ? customTo : undefined,
  });

  const dateRangeValidationError = useMemo(() => {
    if (selectedPeriod !== 'CUSTOM') return null;
    if (!customFrom || !customTo) return 'Select both start and end dates.';
    if (customFrom > customTo) return 'Start date must be on or before end date.';
    const diffDays = Math.round(
      (Date.parse(`${customTo}T00:00:00Z`) - Date.parse(`${customFrom}T00:00:00Z`)) / 86400000
    );
    if (diffDays > 366) return 'Custom reporting range cannot exceed 366 days.';
    return null;
  }, [selectedPeriod, customFrom, customTo]);

  const {
    data: activeReport,
    isLoading: isDetailLoading,
    isFetching: isDetailFetching,
    error: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: [
      'reports',
      'detail',
      selectedReportId,
      selectedPeriod,
      selectedInterval,
      dateRange.from,
      dateRange.to,
      minRatings,
      selectedSubTab,
    ],
    queryFn: () => {
      if (!selectedReportId) return null;
      return reportRepository.getReportById(selectedReportId, {
        period: selectedPeriod,
        from: dateRange.from,
        to: dateRange.to,
        interval: selectedInterval,
        minRatings: minRatings > 0 ? minRatings : undefined,
        subTab: selectedSubTab,
        includeDetailedRecords: true,
      });
    },
    enabled: Boolean(selectedReportId && canViewReports && !dateRangeValidationError),
  });

  const categories: ReportCategory[] = [
    'ALL',
    'Growth',
    'Workforce',
    'Marketplace',
    'Operations',
    'Finance',
    'Support',
    'Retention',
  ];

  const resetDetailFilters = () => {
    setSelectedReportId(null);
    setSelectedPeriod('YEAR_TO_DATE');
    setSelectedInterval('month');
    setCustomFrom(`${todayIST.slice(0, 4)}-01-01`);
    setCustomTo(todayIST);
    setMinRatings(0);
    setSelectedSubTab('top-rated-workers');
  };

  const handleExport = async (reportId: string, currentReport?: ReportItem | null) => {
    if (!canExport || isExporting || (selectedReportId === reportId && dateRangeValidationError)) return;
    try {
      setIsExporting(true);
      setExportingReportId(reportId);
      const criteria = {
        period: selectedPeriod,
        from: dateRange.from,
        to: dateRange.to,
        interval: selectedInterval,
        minRatings: minRatings > 0 ? minRatings : undefined,
        subTab: selectedReportId ? selectedSubTab : undefined,
        includeDetailedRecords: true,
      };

      const result = await reportRepository.generateExport(reportId, 'XLSX', criteria);

      const payload = result.xlsxBuffer || result.xlsxContent;
      if (payload) {
        triggerDownload(
          payload,
          result.fileName,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      }

      const reportName = currentReport?.name || reportId;
      setActionFeedback(`Excel (.xlsx) exported successfully for "${reportName}": ${result.fileName} (${result.rowCount} rows)`);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: unknown) {
      setActionFeedback(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setIsExporting(false);
      setExportingReportId(null);
    }
  };

  if (!canViewReports) {
    return (
      <NoAccessView
        moduleName="Reports & Analytics"
        requiredPermission={PERMISSIONS.REPORTS_VIEW}
      />
    );
  }

  const renderVisualSummary = (report: ReportItem) => {
    if (report.id === 'worker-utilization') {
      const verified = Number(report.metricsSummary.find((m) => m.label.includes('Verified'))?.value ?? 0);
      const active = Number(report.metricsSummary.find((m) => m.label.includes('Active'))?.value ?? 0);
      const rateMetric = report.metricsSummary.find((m) => m.label.includes('Utilization Rate'))?.value;
      const pctNum = rateMetric !== undefined
        ? Number.parseFloat(String(rateMetric)) || 0
        : verified > 0
        ? (active / verified) * 100
        : 0;
      const clampedPct = Math.min(100, Math.max(0, pctNum));
      const pctDisplay = rateMetric ? String(rateMetric) : `${clampedPct.toFixed(2)}%`;

      return (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={16} color="var(--color-brand-600)" />
              Workforce Deployment & Utilization
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand-700)' }}>
              {pctDisplay} Active Placement Rate
            </span>
          </div>
          <div style={{ height: '10px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${clampedPct}%`, backgroundColor: 'var(--color-success)' }} title={`Active Workers: ${active}`} />
            <div style={{ width: `${Math.max(0, 100 - clampedPct)}%`, backgroundColor: 'var(--color-brand-200)' }} title={`Standby Workers: ${Math.max(0, verified - active)}`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: 'var(--space-2)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <span>Active Engagements: <strong>{active}</strong></span>
            <span>Verified Standby Capacity: <strong>{Math.max(0, verified - active)}</strong></span>
            <span>Total Verified Pool: <strong>{verified}</strong></span>
          </div>
        </div>
      );
    }

    if (report.id === 'demand-by-category' || report.id === 'demand-by-area') {
      const isCat = report.id === 'demand-by-category';
      const rows = report.previewRows.slice(0, 8);
      const maxVal = Math.max(1, ...rows.map((r) => Number(r['Booking Requests'] || 0)));

      return (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="var(--color-brand-600)" />
              {isCat ? 'Category Demand Distribution' : 'Top Geographic Demand Clusters'}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Top {rows.length} entries
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rows.map((row, idx) => {
              const label = String(row[isCat ? 'Service Category' : 'Geographic Service Area'] || `Item ${idx + 1}`);
              const city = !isCat && row.City && row.City !== '—' ? ` (${row.City})` : '';
              const val = Number(row['Booking Requests'] || 0);
              const share = String(row[isCat ? 'Share of Total %' : 'Share of Demand %'] || '0.0%');
              const barPct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;

              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                  <div
                    style={{
                      width: 'min(36%, 190px)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                    }}
                    title={`${label}${city}`}
                  >
                    {label}
                    {city && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{city}</span>}
                  </div>
                  <div style={{ flex: 1, height: '9px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${barPct}%`,
                        height: '100%',
                        backgroundColor: idx === 0 ? 'var(--color-brand-600)' : 'var(--color-brand-400)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                  <div style={{ width: '104px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {val} reqs ({share})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (report.id === 'cancellation-rate' || report.id === 'replacement-rate' || report.id === 'interview-conversion') {
      const rateStr = String(
        report.metricsSummary.find((m) => m.label.includes('Rate') || m.label.includes('Ratio'))?.value || '0.00%'
      );
      const rateNum = Math.min(100, Math.max(0, Number.parseFloat(rateStr) || 0));

      return (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="var(--color-brand-600)" />
              Cohort Ratio Summary
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-navy)', fontVariantNumeric: 'tabular-nums' }}>
              {rateStr}
            </div>
            <div style={{ flex: 1, height: '9px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${rateNum}%`, height: '100%', backgroundColor: 'var(--color-brand-600)' }} />
            </div>
          </div>
        </div>
      );
    }

    const explicitTrend = report.trendSeries && report.trendSeries.length > 0 ? report.trendSeries : null;
    const hasPeriodicRows =
      report.previewRows.length > 0 &&
      (report.previewColumns.includes('Period') ||
        report.previewColumns.includes('Reporting Period') ||
        report.previewColumns.includes('Date Bucket'));

    if (explicitTrend || hasPeriodicRows) {
      const periodCol = report.previewColumns.find((c) => c.includes('Period') || c.includes('Date')) || 'Period';
      const valCol =
        report.previewColumns.find((c) => c.includes('Gross Collections')) ||
        report.previewColumns.find(
          (c) => !c.includes('Period') && !c.includes('Date') && !c.includes('%') && !c.includes('Class') && !c.includes('ID') && !c.includes('Name')
        ) ||
        report.previewColumns[1];

      const seriesPoints = explicitTrend
        ? explicitTrend.slice(-10).map((pt) => ({
            label: formatTrendPeriodLabel(pt.period, selectedInterval),
            value: pt.value,
            formatted: pt.formattedValue || String(pt.value),
          }))
        : report.previewRows.slice(-10).map((r) => {
            const num = parseFloat(String(r[valCol]).replace(/[₹,★\s]/g, ''));
            return {
              label: formatTrendPeriodLabel(String(r[periodCol] || ''), selectedInterval),
              value: isNaN(num) ? 0 : num,
              formatted: String(r[valCol] ?? '0'),
            };
          });

      const maxVal = Math.max(1, ...seriesPoints.map((p) => p.value));
      const chartMetricLabel = report.id === 'support-tickets' ? 'Tickets Created' : valCol;

      return (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart3 size={16} color="var(--color-brand-600)" />
              Periodic Trend ({chartMetricLabel})
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {seriesPoints.length} reporting {seriesPoints.length === 1 ? 'period' : 'periods'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '104px', paddingTop: '12px', overflowX: 'auto' }}>
            {seriesPoints.map((pt, i) => {
              const barHeight = pt.value <= 0 ? 0 : Math.max(6, Math.round((pt.value / maxVal) * 72));
              return (
                <div key={i} style={{ flex: '1 1 56px', minWidth: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {pt.formatted}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '34px',
                      height: `${barHeight}px`,
                      backgroundColor: 'var(--color-brand-600)',
                      borderRadius: '3px 3px 0 0',
                    }}
                    title={`${pt.label}: ${pt.formatted}`}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '5px', whiteSpace: 'nowrap' }}>
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (report.id === 'top-rated-workers-repeat-customers' && report.activeSubTab === 'top-rated-workers') {
      return (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Award size={18} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)' }}>
                Consumer Excellence Ranking
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Ranked by average visible consumer rating, rating count, and worker ID.
              </div>
            </div>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-brand-700)', backgroundColor: 'var(--color-brand-50)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
            All-Time Verified Pool
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ padding: 'var(--space-4) var(--space-5)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Action Notification Banner */}
      {actionFeedback && (
        <div
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: actionFeedback.includes('failed') ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
            border: `1px solid ${actionFeedback.includes('failed') ? 'var(--color-error-border)' : 'var(--color-success-border)'}`,
            borderRadius: 'var(--radius-md)',
            color: actionFeedback.includes('failed') ? 'var(--color-error-text)' : 'var(--color-success-text)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {actionFeedback.includes('failed') ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* VIEW MODE: SINGLE REPORT WORKSPACE */}
      {selectedReportId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Top Return Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={resetDetailFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <ArrowLeft size={14} /> Back to Reports
              </button>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-brand-700)',
                  backgroundColor: 'var(--color-brand-50)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {activeReport?.requirement || 'FR-RPT'}
              </span>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                {activeReport?.name || 'Report Telemetry'}
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {activeReport?.category || 'Operational'}
              </span>
            </div>

            {/* Action Bar (Refresh + Single Export Menu Control) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => refetchDetail()}
                disabled={isDetailFetching || Boolean(dateRangeValidationError)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: isDetailFetching ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Refresh report data"
              >
                <RefreshCw size={13} className={isDetailFetching ? 'animate-spin' : ''} /> Refresh
              </button>
              {canExport && (
                <ExportButton
                  ariaLabel="Export"
                  variant="primary"
                  disabled={isExporting || isDetailLoading || Boolean(dateRangeValidationError)}
                  isExportingThis={isExporting && exportingReportId === selectedReportId}
                  onExport={() => handleExport(selectedReportId, activeReport)}
                />
              )}
            </div>
          </div>

          {/* Sub-Tabs for FR-RPT-012 */}
          {activeReport?.subTabs && activeReport.subTabs.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              {activeReport.subTabs.map((tab) => {
                const isActive = selectedSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedSubTab(tab.id as 'top-rated-workers' | 'repeat-customers')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? 'none' : '1px solid var(--color-border)',
                      backgroundColor: isActive ? 'var(--color-brand-600)' : 'var(--color-surface)',
                      color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {tab.id === 'top-rated-workers' ? <Award size={14} /> : <Users size={14} />}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* PRD Specification & Backend Scope Banner */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-brand-50)',
              border: '1px solid var(--color-brand-200)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--color-brand-800)' }}>
              <Info size={13} /> AUTHORITATIVE SPECIFICATION & METRIC DEFINITION
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-navy)', lineHeight: 1.45 }}>
              {activeReport?.description}
            </p>
            {activeReport?.notes && activeReport.notes.length > 0 && (
              <ul style={{ margin: '2px 0 0 16px', padding: 0, fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {activeReport.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Interactive Filter Toolbar */}
          <div
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={13} /> Filters:
              </span>

              {activeReport?.supportedFilters?.dateRange ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    {(['LAST_30_DAYS', 'LAST_90_DAYS', 'YEAR_TO_DATE', 'CUSTOM'] as ReportPeriod[]).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSelectedPeriod(period)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '11px',
                          fontWeight: selectedPeriod === period ? 700 : 500,
                          backgroundColor: selectedPeriod === period ? 'var(--color-navy)' : 'var(--color-bg-subtle)',
                          color: selectedPeriod === period ? '#ffffff' : 'var(--color-text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {period === 'LAST_30_DAYS'
                          ? 'Last 30d'
                          : period === 'LAST_90_DAYS'
                          ? 'Last 90d'
                          : period === 'YEAR_TO_DATE'
                          ? 'YTD'
                          : 'Custom'}
                      </button>
                    ))}
                  </div>

                  {selectedPeriod === 'CUSTOM' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                      <Calendar size={13} color="var(--color-text-muted)" />
                      <input
                        type="date"
                        aria-label="Start date"
                        value={customFrom}
                        max={todayIST}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        style={{ padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '11px' }}
                      />
                      <span>to</span>
                      <input
                        type="date"
                        aria-label="End date"
                        value={customTo}
                        max={todayIST}
                        onChange={(e) => setCustomTo(e.target.value)}
                        style={{ padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '11px' }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  {activeReport?.cadence?.includes('Snapshot')
                    ? 'Point-in-Time Snapshot (Live Active Roster)'
                    : 'All-Time Cumulative Quality Ranking'}
                </span>
              )}

              {activeReport?.supportedFilters?.interval && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Cadence:</span>
                  {(['month', 'week', 'day'] as ReportInterval[]).map((intv) => (
                    <button
                      key={intv}
                      type="button"
                      onClick={() => setSelectedInterval(intv)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: selectedInterval === intv ? 700 : 500,
                        backgroundColor: selectedInterval === intv ? 'var(--color-brand-600)' : 'transparent',
                        color: selectedInterval === intv ? '#ffffff' : 'var(--color-text-secondary)',
                        border: selectedInterval === intv ? 'none' : '1px solid var(--color-border)',
                        cursor: 'pointer',
                      }}
                    >
                      {intv.charAt(0).toUpperCase() + intv.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {activeReport?.supportedFilters?.minRatings && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Min Ratings:</span>
                  <CustomSelect
                    value={String(minRatings)}
                    onChange={(val) => setMinRatings(Number(val))}
                    options={[
                      { value: '0', label: 'All Ratings' },
                      { value: '1', label: '≥ 1 Review' },
                      { value: '3', label: '≥ 3 Reviews' },
                      { value: '5', label: '≥ 5 Reviews' },
                    ]}
                    ariaLabel="Filter by minimum ratings count"
                    minWidth="120px"
                  />
                </div>
              )}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {activeReport?.from && activeReport?.to ? (
                <>Period: <strong style={{ color: 'var(--color-text-secondary)' }}>{activeReport.from} to {activeReport.to}</strong></>
              ) : (
                <>Cadence: <strong style={{ color: 'var(--color-text-secondary)' }}>{activeReport?.cadence}</strong></>
              )}
            </div>
          </div>

          {dateRangeValidationError && (
            <div
              role="alert"
              style={{
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-error-bg)',
                border: '1px solid var(--color-error-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-error-text)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {dateRangeValidationError}
            </div>
          )}

          {isDetailLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
              <LoadingSpinner />
            </div>
          ) : detailError ? (
            <div style={{ padding: 'var(--space-5)', textAlign: 'center', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)' }}>
              <AlertCircle size={26} color="var(--color-error)" style={{ margin: '0 auto var(--space-2)' }} />
              <h3 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-md)' }}>
                Failed to Load Backend Report Telemetry
              </h3>
              <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-xs)' }}>
                {detailError instanceof Error ? detailError.message : 'Unknown network error'}
              </p>
              <button
                type="button"
                onClick={() => refetchDetail()}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}
              >
                Retry Request
              </button>
            </div>
          ) : activeReport ? (
            <>
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 'var(--space-3)' }}>
                {activeReport.metricsSummary.map((metric, idx) => (
                  <div
                    key={idx}
                    data-testid="kpi-card"
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                    }}
                  >
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {metric.label}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-navy)', fontVariantNumeric: 'tabular-nums' }}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Visual Summary */}
              {renderVisualSummary(activeReport)}

              {/* Primary Telemetry Dataset Table */}
              <ReportDataTable
                title="Tabular Dataset"
                subtitle="Authoritative Backend Report Telemetry"
                columns={activeReport.previewColumns}
                rows={activeReport.previewRows}
                emptyText="No telemetry records recorded for the selected period / criteria."
                searchable={activeReport.previewRows.length > 8}
              />

              {/* Individual Backend Records Table (when available from OpenAPI detail endpoints) */}
              {activeReport.detailDataset && (
                <ReportDataTable
                  title={activeReport.detailDataset.title}
                  subtitle="Detailed Records"
                  columns={activeReport.detailDataset.columns}
                  rows={activeReport.detailDataset.rows}
                  emptyText="No individual backend records found in this reporting window."
                  searchable
                  maxHeight="420px"
                />
              )}
            </>
          ) : null}
        </div>
      ) : (
        /* CATALOGUE LANDING WORKSPACE (12 PRD REPORTS) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Compact Page Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  Reports & Analytics
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-brand-100)',
                    color: 'var(--color-brand-800)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {catalogCounts?.ALL ?? reports?.length ?? 12} PRD Reports
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Operational & Business Reports • Marketplace intelligence, workforce telemetry, and financial realizations defined in SevaNest PRD Section 14.
              </p>
            </div>
            {reports && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Showing {reports.length} of {catalogCounts?.ALL ?? 12} reports
              </span>
            )}
          </div>

          {/* Compact Filter Toolbar: Category Pills + Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: '1 1 520px' }}>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const dynamicCount = catalogCounts ? catalogCounts[cat] : undefined;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    aria-label={cat === 'ALL' ? 'All Reports' : cat}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-brand-600)' : 'var(--color-surface)',
                      color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{cat === 'ALL' ? 'All Reports' : cat}</span>
                    {dynamicCount !== undefined && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-bg-subtle)',
                          color: isSelected ? '#ffffff' : 'var(--color-text-muted)',
                          fontWeight: 700,
                        }}
                      >
                        {dynamicCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <SearchInput
              value={searchTerm}
              onChange={(val) => setSearchTerm(val)}
              placeholder="Search reports by title, requirement code, or description..."
              ariaLabel="Search reports catalog"
              isLoading={isCatalogFetching && debouncedSearchTerm.trim().length > 0}
              containerStyle={{ flex: '1 1 280px', maxWidth: '420px', minWidth: 'min(100%, 240px)' }}
            />
          </div>

          {/* Reports Catalog Table */}
          {isCatalogLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
              <LoadingSpinner />
            </div>
          ) : catalogError ? (
            <div style={{ padding: 'var(--space-5)', textAlign: 'center', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)' }}>
              <AlertCircle size={26} color="var(--color-error)" style={{ margin: '0 auto var(--space-2)' }} />
              <h3 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-md)' }}>
                Failed to Load Reports Catalog
              </h3>
              <p style={{ margin: '0 0 var(--space-3)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-xs)' }}>
                {catalogError instanceof Error ? catalogError.message : 'Unknown network error'}
              </p>
              <button
                type="button"
                onClick={() => refetchCatalog()}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '112px', whiteSpace: 'nowrap' }}>Requirement</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', minWidth: '240px' }}>Report Name & PRD Definition</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '118px', whiteSpace: 'nowrap' }}>Category</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '190px' }}>Cadence / Scope</th>
                      <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '204px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports && reports.length > 0 ? (
                      reports.map((report, idx) => {
                        const catColor = getCategoryBadgeColors(report.category);
                        return (
                          <tr
                            key={report.id}
                            style={{
                              borderBottom: '1px solid var(--color-border-subtle)',
                              backgroundColor: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg-subtle)',
                            }}
                          >
                            <td style={{ padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  color: 'var(--color-brand-700)',
                                  backgroundColor: 'var(--color-brand-50)',
                                  padding: '3px 7px',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--color-brand-200)',
                                  display: 'inline-block',
                                }}
                              >
                                {report.requirement}
                              </span>
                            </td>

                            <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: '2px' }}>
                                {report.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.38, maxWidth: '640px' }}>
                                {report.description}
                              </div>
                            </td>

                            <td style={{ padding: '10px 14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '3px 9px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: catColor.bg,
                                  color: catColor.text,
                                  border: '1px solid rgba(0, 0, 0, 0.05)',
                                  display: 'inline-block',
                                }}
                              >
                                {report.category}
                              </span>
                            </td>

                            <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 500 }}>
                              {report.cadence}
                            </td>

                            <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedReportId(report.id)}
                                  aria-label={`View Report: ${report.name}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '6px 10px',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--color-brand-600)',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: 'var(--shadow-sm)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <Eye size={13} /> View Report
                                </button>
                                {canExport && (
                                  <ExportButton
                                    ariaLabel={`Export: ${report.name}`}
                                    disabled={isExporting}
                                    isExportingThis={isExporting && exportingReportId === report.id}
                                    onExport={() => handleExport(report.id, report)}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          No reports match your selected category or filter query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
