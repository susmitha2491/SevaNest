import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  ShieldCheck,
  Search,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { verificationRepository } from '../data/verificationRepository';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

export interface VerificationDocumentReviewViewProps {
  selectedDossierId: string | null;
  onSelectDossier: (dossierId: string) => void;
  onClearSelectedDossier?: () => void;
}

export const VerificationDocumentReviewView: React.FC<VerificationDocumentReviewViewProps> = ({
  selectedDossierId,
  onSelectDossier,
  onClearSelectedDossier,
}) => {
  const [lookupId, setLookupId] = useState('');

  // Query pending & in-review queue applications for quick document review selection
  const { data: queueData, isLoading, isError, error } = useQuery({
    queryKey: ['verification', 'doc-review-picker'],
    queryFn: () =>
      verificationRepository.getVerificationQueue({
        status: 'PENDING_REVIEW',
        page: 1,
        pageSize: 15,
      }),
  });

  // Query selected dossier details if selectedDossierId is present
  const { data: activeDossier } = useQuery({
    queryKey: ['verification', 'dossier-summary', selectedDossierId],
    queryFn: () => (selectedDossierId ? verificationRepository.getDossierById(selectedDossierId) : null),
    enabled: !!selectedDossierId,
  });

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    onSelectDossier(lookupId.trim());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Sensitive Document Protocols & Security Banner */}
      <div
        style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--color-bg-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ShieldCheck size={20} color="var(--color-primary)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
            Document Review Workstation & Trust Operations Standards
          </h2>
        </div>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
          Strict PII and document handling protocols are enforced across all verification reviews:
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-2)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>1. Temporary Signed URLs:</strong> Documents are never
            accessed via public links. The review canvas requests short-lived time-bounded signed URLs.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>2. Identity PII Masking:</strong> Aadhaar and government
            identifiers are masked (<code>XXXX-XXXX-1234</code>) in all displays.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>3. Unmasked Mobile Number:</strong> The worker mobile
            number is kept unmasked exclusively for Verification Executive telephonic vetting workflows.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>4. Audited Document Access:</strong> Every document
            inspection event produces an immutable audit record containing staff ID, worker ID, and timestamp.
          </div>
        </div>
      </div>

      {/* Active Selected Dossier Summary Card (if selected) */}
      {selectedDossierId && (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--color-primary)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <FileText size={20} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Active Review Dossier: {activeDossier?.workerName || selectedDossierId}
                </h3>
                {activeDossier && <StatusBadge status={activeDossier.status} />}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Worker ID: <code style={{ color: 'var(--color-primary)' }}>{selectedDossierId}</code> •
                Mobile (Unmasked): <strong>{activeDossier?.phone || activeDossier?.phoneMasked || 'Provided in review'}</strong> •
                Category: <strong>{activeDossier?.category || 'Household Staff'}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {onClearSelectedDossier && (
                <button
                  type="button"
                  onClick={onClearSelectedDossier}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Change Worker
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectDossier(selectedDossierId)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Eye size={14} />
                <span>Open Guided Split-Screen Reviewer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lookup Bar */}
      <form
        onSubmit={handleLookupSubmit}
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Search size={16} color="var(--color-text-tertiary)" />
        <input
          type="text"
          placeholder="Direct Worker ID or Dossier ID lookup (e.g. W-10482)..."
          value={lookupId}
          onChange={(e) => setLookupId(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
          }}
          aria-label="Lookup worker ID for document review"
        />
        <button
          type="submit"
          disabled={!lookupId.trim()}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: lookupId.trim() ? 'var(--color-primary)' : 'var(--color-bg-disabled)',
            color: lookupId.trim() ? '#ffffff' : 'var(--color-text-disabled)',
            border: 'none',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            cursor: lookupId.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Inspect Dossier
        </button>
      </form>

      {/* Applications Awaiting Document Review Quick-Picker */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Applications Awaiting Document Review ({queueData?.totalCount || 0})
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Click "Start Document Review" to inspect submitted identity & address proofs
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner message="Loading pending review applications..." />
          </div>
        ) : isError ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-error)' }}>
            Failed to load applications: {(error as Error)?.message || 'Service unavailable'}
          </div>
        ) : !queueData?.items.length ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <CheckCircle2 size={36} color="var(--color-brand-600)" style={{ marginBottom: '8px' }} />
            <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>All applications have been reviewed</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Worker Name & ID</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Category</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Submission Time</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Pending Checks</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queueData.items.map((item) => {
                  const targetWorkerId = item.workerId || item.id;
                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Start Document Review for ${item.workerName}`}
                      className="clickable-table-row"
                      onClick={(e) => {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        onSelectDossier(targetWorkerId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          const target = e.target as { closest?: (selector: string) => unknown };
                          if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                            return;
                          }
                          e.preventDefault();
                          onSelectDossier(targetWorkerId);
                        }
                      }}
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.workerName}</div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--color-brand-600)', fontSize: '11px' }}>
                          {item.workerId}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div>{item.category}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{item.locality}</div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                        {formatDateTimeIST(item.submissionTime)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(item.pendingChecks || []).map((t: string) => (
                            <span
                              key={t}
                              style={{
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-warning-bg, #fef3c7)',
                                color: 'var(--color-warning-text, #92400e)',
                                fontSize: '10px',
                                fontWeight: 600,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => onSelectDossier(targetWorkerId)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={12} />
                          <span>Start Document Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
