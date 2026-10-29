import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search, FileText, CheckCircle2, Eye, Info } from 'lucide-react';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { reportRepository } from '../data/reportRepository';
import { ReportItem, ReportCategory } from '../domain/types';
import { ReportPreviewModal } from './ReportPreviewModal';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';

export const ReportsDashboardPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [exportedFeedback, setExportedFeedback] = useState<string | null>(null);

  const canViewReports = hasPermission(user?.permissions, PERMISSIONS.REPORTS_VIEW);
  const canExport = hasPermission(user?.permissions, PERMISSIONS.EXPORTS_GENERATE);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', 'list', selectedCategory, searchTerm],
    queryFn: () => reportRepository.getReports(selectedCategory, searchTerm),
    enabled: canViewReports,
  });

  const categories: ReportCategory[] = [
    'ALL',
    'Growth',
    'Workforce',
    'Trust & Safety',
    'Marketplace',
    'Operations',
    'Support',
    'Finance',
  ];

  const handleQuickExport = async (reportId: string, format: 'CSV' | 'PDF') => {
    if (!canExport) return;
    try {
      const result = await reportRepository.generateExport(reportId, format);
      if (format === 'CSV' && result.csvContent) {
        if (typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
          const blob = new window.Blob([result.csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', result.fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      }
      setExportedFeedback(`Audited ${format} generated: ${result.fileName}`);
      setTimeout(() => setExportedFeedback(null), 4000);
    } catch {
      setExportedFeedback('Export failed.');
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

  if (isLoading) return <LoadingSpinner message="Loading marketplace analytics engine..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Operational & Business Reports (12 Standard Reports)
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Authoritative marketplace intelligence, funnel conversion, workforce roster utilization, and financial realization.
          </p>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-status-info-bg)',
            border: '1px solid var(--color-status-info-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-status-info-text)',
          }}
        >
          <Info size={16} />
          <span>Business Intelligence & Reporting Catalogue</span>
        </div>
      </div>

      {exportedFeedback && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-success-dark)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={16} /> {exportedFeedback}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: selectedCategory === cat ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                backgroundColor: selectedCategory === cat ? 'var(--color-brand-600)' : 'var(--color-surface)',
                color: selectedCategory === cat ? '#ffffff' : 'var(--color-text-secondary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat === 'ALL' ? 'All 12 Reports' : cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', maxWidth: '450px' }}>
          <Search
            size={16}
            color="var(--color-text-tertiary)"
            style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search reports by title, ID, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-8)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-sm)',
            }}
            aria-label="Search reports"
          />
        </div>
      </div>

      {/* Reports Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {reports?.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No business reports found matching the filter criteria.
          </div>
        ) : (
          reports?.map((report) => (
            <div
              key={report.id}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                padding: 'var(--space-5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-sm)',
                gap: 'var(--space-4)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                    {report.id}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-brand-50)',
                      color: 'var(--color-brand-700)',
                    }}
                  >
                    {report.category}
                  </span>
                </div>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {report.name}
                </h3>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', lineHeight: 1.5 }}>
                  {report.description}
                </p>
              </div>

              {/* Mini metric pills */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                {report.metricsSummary.slice(0, 2).map((m) => (
                  <div key={m.label} style={{ backgroundColor: 'var(--color-bg-subtle)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <button
                  onClick={() => {
                    setSelectedReport(report);
                    setIsPreviewOpen(true);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Eye size={13} /> Preview
                </button>

                {canExport && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      onClick={() => handleQuickExport(report.id, 'CSV')}
                      style={{
                        padding: '6px 10px',
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
                      title="Quick CSV Export"
                    >
                      <Download size={12} /> CSV
                    </button>
                    <button
                      onClick={() => handleQuickExport(report.id, 'PDF')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: 'var(--color-brand-600)',
                        color: '#ffffff',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Quick PDF Export"
                    >
                      <FileText size={12} /> PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Report Preview Modal */}
      <ReportPreviewModal
        report={selectedReport}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedReport(null);
        }}
        canExport={canExport}
      />
    </div>
  );
};
