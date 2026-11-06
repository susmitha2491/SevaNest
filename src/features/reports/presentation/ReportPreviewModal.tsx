import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { ReportItem } from '../domain/types';
import { reportRepository } from '../data/reportRepository';

interface ReportPreviewModalProps {
  report: ReportItem | null;
  isOpen: boolean;
  onClose: () => void;
  canExport?: boolean;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  report,
  isOpen,
  onClose,
  canExport = true,
}) => {
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [loadedReport, setLoadedReport] = useState<ReportItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !report) {
      setLoadedReport(null);
      return;
    }

    if (report.previewRows && report.previewRows.length > 0) {
      setLoadedReport(report);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);
    reportRepository
      .getReportById(report.id)
      .then((full) => {
        if (isSubscribed && full) {
          setLoadedReport(full);
        }
      })
      .catch(() => {
        if (isSubscribed) setLoadedReport(report);
      })
      .finally(() => {
        if (isSubscribed) setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, report]);

  if (!isOpen || !report) return null;

  const currentReport = loadedReport || report;

  const handleExport = async (format: 'CSV' | 'PDF') => {
    try {
      const result = await reportRepository.generateExport(report.id, format);

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

      setExportFeedback(`Audited CSV exported: ${result.fileName} (${result.rowCount} rows)`);
      setTimeout(() => setExportFeedback(null), 4000);
    } catch {
      setExportFeedback('Export failed. Please try again.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-preview-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: 'var(--color-bg-subtle)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                {currentReport.requirement || currentReport.id}
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
                {currentReport.category}
              </span>
            </div>
            <h2 id="report-preview-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {currentReport.name}
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {currentReport.description}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
            }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {exportFeedback && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-success-bg)',
                border: '1px solid var(--color-success-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-success-dark)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{exportFeedback}</span>
            </div>
          )}

          {/* Metric KPI Cards */}
          <div>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              Key Report Indicators
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              {currentReport.metricsSummary.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--color-bg-subtle)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                    {m.value}
                  </div>
                  {m.change && (
                    <div style={{ fontSize: '11px', fontWeight: 600, color: m.isPositive ? 'var(--color-success-dark)' : 'var(--color-text-tertiary)', marginTop: '2px' }}>
                      {m.change}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tabular Dataset Preview */}
          <div>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              Tabular Dataset Preview
            </h3>
            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    {currentReport.previewColumns.map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={currentReport.previewColumns.length} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                        Loading report data...
                      </td>
                    </tr>
                  ) : currentReport.previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={currentReport.previewColumns.length} style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                        No data records available in this telemetry snapshot.
                      </td>
                    </tr>
                  ) : (
                    currentReport.previewRows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          backgroundColor: idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg-subtle)',
                        }}
                      >
                        {currentReport.previewColumns.map((col) => (
                          <td
                            key={col}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
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
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-subtle)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          {canExport && (
            <button
              onClick={() => handleExport('CSV')}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-brand-600)',
                color: '#ffffff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <FileSpreadsheet size={16} /> Export CSV
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
