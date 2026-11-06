import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  FileSpreadsheet,
  Search,
  Eye,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  Filter,
  BarChart3,
  RefreshCw,
  Info,
  AlertCircle,
  TrendingUp,
  Layers,
  Activity,
  Award,
  Users,
} from 'lucide-react';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { reportRepository, buildStandardDateRange } from '../data/reportRepository';
import { ReportItem, ReportCategory, ReportPeriod, ReportInterval } from '../domain/types';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';

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

export const ReportsDashboardPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  // Main catalog state
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'CSV' | 'XLSX' | null>(null);

  // Report Detail Filter state
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('YEAR_TO_DATE');
  const [selectedInterval, setSelectedInterval] = useState<ReportInterval>('month');
  const [customFrom, setCustomFrom] = useState('2026-01-01');
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [minRatings, setMinRatings] = useState<number>(0);
  const [selectedSubTab, setSelectedSubTab] = useState<'top-rated-workers' | 'repeat-customers'>('top-rated-workers');

  const canViewReports = hasPermission(user?.permissions, PERMISSIONS.REPORTS_VIEW);
  // Any user authorized to view operational reports can generate exports (CSV & Excel)
  const canExport = Boolean(canViewReports || hasPermission(user?.permissions, PERMISSIONS.EXPORTS_GENERATE));

  // Catalog Query (Always 12 PRD reports)
  const { data: reports, isLoading: isCatalogLoading, error: catalogError, refetch: refetchCatalog } = useQuery({
    queryKey: ['reports', 'catalog', selectedCategory, searchTerm],
    queryFn: () => reportRepository.getReports(selectedCategory, searchTerm),
    enabled: canViewReports,
  });

  // Active Report Detail Query
  const dateRange = buildStandardDateRange({
    period: selectedPeriod,
    from: selectedPeriod === 'CUSTOM' ? customFrom : undefined,
    to: selectedPeriod === 'CUSTOM' ? customTo : undefined,
  });

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
      });
    },
    enabled: Boolean(selectedReportId && canViewReports),
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

  const handleExport = async (reportId: string, format: 'CSV' | 'XLSX', currentReport?: ReportItem | null) => {
    if (!canExport || isExporting) return;
    try {
      setIsExporting(true);
      setExportingReportId(reportId);
      setExportingFormat(format);
      const criteria = {
        period: selectedPeriod,
        from: dateRange.from,
        to: dateRange.to,
        interval: selectedInterval,
        minRatings: minRatings > 0 ? minRatings : undefined,
        subTab: selectedSubTab,
      };

      const result = await reportRepository.generateExport(reportId, format, criteria);

      if (format === 'XLSX') {
        const payload = result.xlsxBuffer || result.xlsxContent;
        if (payload) {
          triggerDownload(
            payload,
            result.fileName,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
        }
      } else if (result.csvContent) {
        triggerDownload(
          result.csvContent,
          result.fileName,
          'text/csv;charset=utf-8;'
        );
      }

      const reportName = currentReport?.name || reportId;
      setActionFeedback(`${format} exported successfully for "${reportName}": ${result.fileName} (${result.rowCount} rows)`);
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err: unknown) {
      setActionFeedback(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setActionFeedback(null), 5000);
    } finally {
      setIsExporting(false);
      setExportingReportId(null);
      setExportingFormat(null);
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

  // Visual chart renderer for tailored report graphics
  const renderVisualSummary = (report: ReportItem) => {
    // 1. Worker Utilization snapshot gauge
    if (report.id === 'worker-utilization') {
      const verified = Number(report.metricsSummary.find((m) => m.label.includes('Verified'))?.value || 24);
      const active = Number(report.metricsSummary.find((m) => m.label.includes('Active'))?.value || 2);
      const pct = verified > 0 ? Math.min(100, Math.round((active / verified) * 100)) : 0;
      return (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={16} color="var(--color-brand-600)" />
              Workforce Deployment & Utilization Gauge
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand-700)' }}>
              {pct}% Active Placement Rate
            </span>
          </div>
          <div style={{ height: '16px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${pct}%`, backgroundColor: 'var(--color-success)', transition: 'width 0.4s ease' }} title={`Active Workers: ${active}`} />
            <div style={{ width: `${100 - pct}%`, backgroundColor: 'var(--color-brand-200)', transition: 'width 0.4s ease' }} title={`Standby Workers: ${verified - active}`} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-2)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
              Active Engagements: <strong>{active}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-brand-200)' }} />
              Verified Standby Capacity: <strong>{Math.max(0, verified - active)}</strong>
            </span>
            <span>Total Verified Pool: <strong>{verified}</strong></span>
          </div>
        </div>
      );
    }

    // 2. Category or Area Demand Distribution (Horizontal Bars)
    if (report.id === 'demand-by-category' || report.id === 'demand-by-area') {
      const isCat = report.id === 'demand-by-category';
      const rows = report.previewRows.slice(0, 8);
      const maxVal = Math.max(1, ...rows.map((r) => Number(r['Booking Requests'] || 0)));

      return (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="var(--color-brand-600)" />
              {isCat ? 'Category Demand Share Visual Summary' : 'Top Geographic Demand Clusters Visual Summary'}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Relative Demand Distribution
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((row, idx) => {
              const label = String(row[isCat ? 'Service Category' : 'Geographic Service Area'] || `Item ${idx + 1}`);
              const val = Number(row['Booking Requests'] || 0);
              const share = String(row[isCat ? 'Share of Total %' : 'Share of Demand %'] || '0.0%');
              const barPct = Math.round((val / maxVal) * 100);

              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                  <div style={{ width: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {label}
                  </div>
                  <div style={{ flex: 1, height: '10px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${barPct}%`,
                        height: '100%',
                        backgroundColor: idx === 0 ? 'var(--color-brand-600)' : 'var(--color-brand-400)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                  <div style={{ width: '80px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                    {val} reqs ({share})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 3. Conversion / Rate Ratio Visuals
    if (report.id === 'cancellation-rate' || report.id === 'replacement-rate' || report.id === 'interview-conversion') {
      const isCancel = report.id === 'cancellation-rate';
      const isRep = report.id === 'replacement-rate';
      const targetLabel = isCancel ? 'Target: ≤ 15.0%' : isRep ? 'Target: ≤ 10.0%' : 'Benchmark: ≥ 60.0%';
      const rateStr = String(
        report.metricsSummary.find((m) => m.label.includes('Rate') || m.label.includes('Ratio'))?.value || '0.0%'
      );
      const rateNum = parseFloat(rateStr) || 0;
      const isHealthy = isCancel ? rateNum <= 15 : isRep ? rateNum <= 10 : rateNum >= 60;

      return (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="var(--color-brand-600)" />
              Operational Benchmark Comparison
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isHealthy ? 'var(--color-success-subtle)' : 'var(--color-warning-subtle)',
                color: isHealthy ? 'var(--color-success)' : 'var(--color-warning-text)',
              }}
            >
              {isHealthy ? 'Within Operational SLA' : 'Requires Optimization'} ({targetLabel})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: isHealthy ? 'var(--color-success)' : 'var(--color-warning-text)' }}>
              {rateStr}
            </div>
            <div style={{ flex: 1, height: '12px', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, rateNum)}%`,
                  height: '100%',
                  backgroundColor: isHealthy ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    // 4. Series bar visual for period reports
    if (report.previewRows.length > 0 && (report.previewColumns.includes('Period') || report.previewColumns.includes('Reporting Period') || report.previewColumns.includes('Date Bucket'))) {
      const periodCol = report.previewColumns.find((c) => c.includes('Period') || c.includes('Date')) || 'Period';
      const valCol = report.previewColumns.find((c) => !c.includes('Period') && !c.includes('Date') && !c.includes('%') && !c.includes('Class') && !c.includes('ID') && !c.includes('Name')) || report.previewColumns[1];
      const rows = report.previewRows.slice(-10);
      const maxVal = Math.max(1, ...rows.map((r) => {
        const num = parseFloat(String(r[valCol]).replace(/[₹,★]/g, ''));
        return isNaN(num) ? 0 : num;
      }));

      return (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart3 size={16} color="var(--color-brand-600)" />
              Periodic Telemetry Trend Visual ({valCol})
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              Last {rows.length} reporting intervals
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '110px', paddingTop: '15px' }}>
            {rows.map((r, i) => {
              const label = String(r[periodCol] || '').slice(-7);
              const raw = parseFloat(String(r[valCol]).replace(/[₹,★]/g, '')) || 0;
              const barHeight = Math.max(8, Math.round((raw / maxVal) * 85));

              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                    {typeof r[valCol] === 'string' && r[valCol].includes('₹') ? r[valCol] : raw}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${barHeight}px`,
                      backgroundColor: 'var(--color-brand-600)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                    title={`${label}: ${r[valCol]}`}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 5. Top-Rated Workers badge display
    if (report.id === 'top-rated-workers-repeat-customers' && report.activeSubTab === 'top-rated-workers') {
      return (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={24} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)' }}>
                Consumer Excellence Ranking Hierarchy
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Ranked by authoritative visible customer ratings, total verified rating count, and worker identifier.
              </div>
            </div>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-brand-700)', backgroundColor: 'var(--color-brand-50)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
            All-Time Verified Pool
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Action Notification Banner */}
      {actionFeedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: actionFeedback.includes('failed') ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
            border: `1px solid ${actionFeedback.includes('failed') ? 'var(--color-error-border)' : 'var(--color-success-border)'}`,
            borderRadius: 'var(--radius-md)',
            color: actionFeedback.includes('failed') ? 'var(--color-error-text)' : 'var(--color-success-text)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {actionFeedback.includes('failed') ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* VIEW MODE: SINGLE REPORT WORKSPACE */}
      {selectedReportId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Top Return Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button
                onClick={() => setSelectedReportId(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
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
                <ArrowLeft size={16} /> Back to Reports
              </button>
              <span style={{ color: 'var(--color-border)', fontSize: '18px' }}>|</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
            </div>

            {/* Action Bar (Refresh, CSV, Excel) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <button
                onClick={() => refetchDetail()}
                disabled={isDetailFetching}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Refresh report data"
              >
                <RefreshCw size={13} className={isDetailFetching ? 'animate-spin' : ''} /> Refresh
              </button>
              {canExport && (
                <>
                  <button
                    onClick={() => handleExport(selectedReportId, 'CSV', activeReport)}
                    disabled={isExporting || isDetailLoading}
                    aria-label="Export CSV"
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-brand-600)',
                      color: '#ffffff',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: isExporting || isDetailLoading ? 'not-allowed' : 'pointer',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: 'var(--shadow-sm)',
                      opacity: isExporting || isDetailLoading ? 0.7 : 1,
                    }}
                  >
                    {isExporting && exportingReportId === selectedReportId && exportingFormat === 'CSV' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Generating CSV...
                      </>
                    ) : (
                      <>
                        <Download size={14} /> Export CSV
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleExport(selectedReportId, 'XLSX', activeReport)}
                    disabled={isExporting || isDetailLoading}
                    aria-label="Export Excel"
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#107C41', // Official Excel Green
                      color: '#ffffff',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 700,
                      cursor: isExporting || isDetailLoading ? 'not-allowed' : 'pointer',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: 'var(--shadow-sm)',
                      opacity: isExporting || isDetailLoading ? 0.7 : 1,
                    }}
                  >
                    {isExporting && exportingReportId === selectedReportId && exportingFormat === 'XLSX' ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Generating Excel...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={14} /> Export Excel (.xlsx)
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-Tabs for FR-RPT-012 */}
          {activeReport?.subTabs && activeReport.subTabs.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--color-border)', paddingBottom: '8px' }}>
              {activeReport.subTabs.map((tab) => {
                const isActive = selectedSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedSubTab(tab.id as 'top-rated-workers' | 'repeat-customers')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--color-brand-600)' : 'var(--color-bg-subtle)',
                      color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {tab.id === 'top-rated-workers' ? <Award size={15} /> : <Users size={15} />}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* PRD Specification Banner */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-brand-50)',
              border: '1px solid var(--color-brand-200)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-brand-800)' }}>
              <Info size={14} /> AUTHORITATIVE SPECIFICATION & METRIC DEFINITION
            </div>
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-navy)', lineHeight: 1.5 }}>
              {activeReport?.description}
            </p>
            {activeReport?.notes && activeReport.notes.length > 0 && (
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {activeReport.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Interactive Filter Toolbar */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {(['LAST_30_DAYS', 'LAST_90_DAYS', 'YEAR_TO_DATE', 'CUSTOM'] as ReportPeriod[]).map((period) => (
                      <button
                        key={period}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                      <Calendar size={13} color="var(--color-text-muted)" />
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        style={{ padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '11px' }}
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        style={{ padding: '3px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '11px' }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  {activeReport?.cadence?.includes('Snapshot')
                    ? '⚡ Point-in-Time Snapshot (Live Active Roster)'
                    : '★ All-Time Cumulative Quality Ranking'}
                </span>
              )}

              {activeReport?.supportedFilters?.interval && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Cadence:</span>
                  {(['month', 'week', 'day'] as ReportInterval[]).map((intv) => (
                    <button
                      key={intv}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Min Ratings:</span>
                  <select
                    value={minRatings}
                    onChange={(e) => setMinRatings(Number(e.target.value))}
                    style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '11px', backgroundColor: 'var(--color-surface)' }}
                  >
                    <option value={0}>All Ratings</option>
                    <option value={1}>≥ 1 Review</option>
                    <option value={3}>≥ 3 Reviews</option>
                    <option value={5}>≥ 5 Reviews</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Cadence: <strong style={{ color: 'var(--color-text-secondary)' }}>{activeReport?.cadence}</strong>
            </div>
          </div>

          {/* Loading State */}
          {isDetailLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
              <LoadingSpinner />
            </div>
          ) : detailError ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)' }}>
              <AlertCircle size={28} color="var(--color-error)" style={{ margin: '0 auto var(--space-2)' }} />
              <h3 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-md)' }}>
                Failed to Load Backend Report Telemetry
              </h3>
              <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-xs)' }}>
                {detailError instanceof Error ? detailError.message : 'Unknown network error'}
              </p>
              <button
                onClick={() => refetchDetail()}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-brand-600)', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}
              >
                Retry Request
              </button>
            </div>
          ) : activeReport ? (
            <>
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                {activeReport.metricsSummary.map((metric, idx) => (
                  <div
                    key={idx}
                    data-testid="kpi-card"
                    style={{
                      padding: 'var(--space-4)',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {metric.label}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-navy)' }}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Visual Graphic Summary */}
              {renderVisualSummary(activeReport)}

              {/* Comprehensive Dataset Table */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-navy)' }}>
                    Tabular Dataset ({activeReport.previewRows.length} Records)
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Authoritative Backend Data
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-bg-app)', borderBottom: '1px solid var(--color-border)' }}>
                        {activeReport.previewColumns.map((col, idx) => (
                          <th key={idx} style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '11px' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeReport.previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={activeReport.previewColumns.length} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            No telemetry records recorded for the selected period / criteria.
                          </td>
                        </tr>
                      ) : (
                        activeReport.previewRows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            style={{
                              borderBottom: '1px solid var(--color-border-subtle)',
                              backgroundColor: rIdx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg-subtle)',
                            }}
                          >
                            {activeReport.previewColumns.map((col, cIdx) => (
                              <td key={cIdx} style={{ padding: '10px 14px', color: 'var(--color-text-primary)', fontWeight: cIdx === 0 ? 600 : 400 }}>
                                {row[col] !== undefined ? String(row[col]) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        /* CATALOGUE LANDING WORKSPACE (12 PRD REPORTS) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
                  12 PRD Reports
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Operational & Business Reports • Marketplace intelligence, workforce telemetry, and financial realizations defined in SevaNest PRD Section 14.
              </p>
            </div>
          </div>

          {/* Category Tabs & Search Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count = cat === 'ALL'
                  ? 12
                  : cat === 'Growth'
                  ? 1
                  : cat === 'Workforce'
                  ? 2
                  : cat === 'Marketplace'
                  ? 3
                  : cat === 'Operations'
                  ? 3
                  : cat === 'Finance'
                  ? 1
                  : cat === 'Support'
                  ? 1
                  : 1;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    aria-label={cat === 'ALL' ? 'All Reports' : cat}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-brand-600)' : 'var(--color-surface)',
                      color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{cat === 'ALL' ? 'All Reports' : cat}</span>
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
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0 12px',
                maxWidth: '500px',
              }}
            >
              <Search size={15} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search reports by title, requirement code, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  border: 'none',
                  outline: 'none',
                  fontSize: 'var(--font-size-xs)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-primary)',
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Reports Catalog Table */}
          {isCatalogLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
              <LoadingSpinner />
            </div>
          ) : catalogError ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', backgroundColor: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-lg)' }}>
              <AlertCircle size={28} color="var(--color-error)" style={{ margin: '0 auto var(--space-2)' }} />
              <h3 style={{ margin: '0 0 var(--space-1)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-md)' }}>
                Failed to Load Reports Catalog
              </h3>
              <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-error-text)', fontSize: 'var(--font-size-xs)' }}>
                {catalogError instanceof Error ? catalogError.message : 'Unknown network error'}
              </p>
              <button
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
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '120px' }}>Requirement</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Report Name & PRD Definition</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '130px' }}>Category</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '190px' }}>Cadence / Scope</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-secondary)', width: '330px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports && reports.length > 0 ? (
                      reports.map((report, idx) => (
                        <tr
                          key={report.id}
                          style={{
                            borderBottom: '1px solid var(--color-border-subtle)',
                            backgroundColor: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg-subtle)',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {/* Requirement Code */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '11px',
                                color: 'var(--color-brand-700)',
                                backgroundColor: 'var(--color-brand-50)',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-brand-200)',
                                display: 'inline-block',
                              }}
                            >
                              {report.requirement}
                            </span>
                          </td>

                          {/* Report Name & Description */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: '3px' }}>
                              {report.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4, maxWidth: '620px' }}>
                              {report.description}
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 9px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor:
                                  report.category === 'Finance'
                                    ? '#ECFDF5'
                                    : report.category === 'Marketplace'
                                    ? '#EFF6FF'
                                    : report.category === 'Workforce'
                                    ? '#F5F3FF'
                                    : report.category === 'Operations'
                                    ? '#FFFBEB'
                                    : report.category === 'Support'
                                    ? '#FEF2F2'
                                    : '#F0FDF4',
                                color:
                                  report.category === 'Finance'
                                    ? '#065F46'
                                    : report.category === 'Marketplace'
                                    ? '#1E40AF'
                                    : report.category === 'Workforce'
                                    ? '#5B21B6'
                                    : report.category === 'Operations'
                                    ? '#92400E'
                                    : report.category === 'Support'
                                    ? '#991B1B'
                                    : '#166534',
                                border: '1px solid rgba(0, 0, 0, 0.05)',
                                display: 'inline-block',
                              }}
                            >
                              {report.category}
                            </span>
                          </td>

                          {/* Cadence / Scope */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'top', color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 500 }}>
                            {report.cadence}
                          </td>

                          {/* Actions: View Report, Export CSV, Export Excel */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                              <button
                                onClick={() => setSelectedReportId(report.id)}
                                aria-label={`View Report: ${report.name}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '6px 11px',
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
                                <>
                                  <button
                                    onClick={() => handleExport(report.id, 'CSV', report)}
                                    disabled={isExporting}
                                    title="Export CSV"
                                    aria-label={`Export CSV: ${report.name}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 10px',
                                      borderRadius: 'var(--radius-md)',
                                      backgroundColor: 'var(--color-surface)',
                                      color: 'var(--color-text-primary)',
                                      border: '1px solid var(--color-border)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: isExporting ? 'not-allowed' : 'pointer',
                                      opacity: isExporting ? 0.6 : 1,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isExporting && exportingReportId === report.id && exportingFormat === 'CSV' ? (
                                      <RefreshCw size={12} className="animate-spin" />
                                    ) : (
                                      <Download size={12} />
                                    )}
                                    Export CSV
                                  </button>
                                  <button
                                    onClick={() => handleExport(report.id, 'XLSX', report)}
                                    disabled={isExporting}
                                    title="Export Excel (.xlsx)"
                                    aria-label={`Export Excel: ${report.name}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 10px',
                                      borderRadius: 'var(--radius-md)',
                                      backgroundColor: '#F0FDF4',
                                      color: '#15803D',
                                      border: '1px solid #86EFAC',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: isExporting ? 'not-allowed' : 'pointer',
                                      opacity: isExporting ? 0.6 : 1,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isExporting && exportingReportId === report.id && exportingFormat === 'XLSX' ? (
                                      <RefreshCw size={12} className="animate-spin" />
                                    ) : (
                                      <FileSpreadsheet size={12} />
                                    )}
                                    Export Excel
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
