import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, CheckCircle2, Info } from 'lucide-react';
import { ReportItem } from '../domain/types';
import { reportRepository } from '../data/reportRepository';
import { env } from '../../../core/config/env';

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

  if (!isOpen || !report) return null;

  const handleExport = async (format: 'CSV' | 'PDF') => {
    try {
      const result = await reportRepository.generateExport(report.id, format);

      if (format === 'CSV' && result.csvContent) {
        // Trigger browser file download if available in environment
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

      setExportFeedback(`Audited ${format} exported: ${result.fileName} (${result.rowCount} rows)`);
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
            <h2 id="report-preview-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {report.name}
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {report.description}
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
          {/* Mock Dataset Disclaimer */}
          {env.VITE_USE_MOCK_AUTH && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-status-info-bg)',
                border: '1px solid var(--color-status-info-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-status-info-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Info size={16} />
              <span>
                <strong>Simulated Analytics Snapshot:</strong> All metrics, conversions, and dataset rows are sample frontend mock data.
              </span>
            </div>
          )}

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
              {report.metricsSummary.map((m) => (
                <div
                  key={m.label}
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
                    {report.previewColumns.map((col) => (
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
                  {report.previewRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {report.previewColumns.map((col) => (
                        <td
                          key={col}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {row[col] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
            Exported records include full timestamped metadata.
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            {canExport && (
              <>
                <button
                  onClick={() => handleExport('CSV')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileSpreadsheet size={14} /> Export CSV
                </button>
                <button
                  onClick={() => handleExport('PDF')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'var(--color-brand-600)',
                    color: '#ffffff',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <FileText size={14} /> Export PDF
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
