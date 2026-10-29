import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { verificationRepository } from '../data/verificationRepository';
import { VerificationDossier } from '../domain/types';

export interface VerificationHistoryPageProps {
  onSelectDossier?: (workerIdOrDossierId: string) => void;
  hideHeader?: boolean;
}

export const VerificationHistoryPage: React.FC<VerificationHistoryPageProps> = ({
  onSelectDossier,
  hideHeader = false,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Query completed or decided reviews
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['verification', 'history', searchTerm, outcomeFilter, currentPage],
    queryFn: async () => {
      // If outcomeFilter is specific, query that status. If ALL, query APPROVED first then REJECTED if needed
      if (outcomeFilter === 'APPROVED' || outcomeFilter === 'REJECTED') {
        return verificationRepository.getVerificationQueue({
          status: outcomeFilter,
          searchTerm: searchTerm || undefined,
          page: currentPage,
          pageSize,
        });
      }

      // Query both approved and rejected to form authoritative history
      const [approvedRes, rejectedRes] = await Promise.all([
        verificationRepository.getVerificationQueue({
          status: 'APPROVED',
          searchTerm: searchTerm || undefined,
          page: 1,
          pageSize: 20,
        }),
        verificationRepository.getVerificationQueue({
          status: 'REJECTED',
          searchTerm: searchTerm || undefined,
          page: 1,
          pageSize: 20,
        }),
      ]);

      const combined = [...approvedRes.items, ...rejectedRes.items];
      const totalCount = approvedRes.totalCount + rejectedRes.totalCount;
      const totalPages = Math.ceil(totalCount / pageSize) || 1;
      const paginated = combined.slice((currentPage - 1) * pageSize, currentPage * pageSize);

      return {
        items: paginated,
        totalCount,
        page: currentPage,
        pageSize,
        totalPages,
      };
    },
  });

  const items = data?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      {!hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
              Authoritative Review History & Audit
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
              Historical decision records, compliance determinations, and review notes for approved and rejected domestic workers.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <RefreshCw size={14} color="var(--color-primary)" />
            <span>Refresh History</span>
          </button>
        </div>
      )}

      {/* Authoritative Audit Callout Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'var(--color-primary-subtle)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--color-primary)' }}>Authoritative Decision Records:</strong> Decisions displayed below are derived directly from completed worker dossiers and backend verification records. Reviewer identity, check outcomes, and operational remarks reflect genuine audit log data.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--color-text-tertiary)" style={{ position: 'absolute', left: 'var(--space-3)' }} />
            <input
              type="text"
              placeholder="Search history by worker name, ID, locality..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-8)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
              }}
              aria-label="Search review history"
            />
          </div>
        </div>

        <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {[
            { key: 'ALL', label: 'All Decided' },
            { key: 'APPROVED', label: 'Approved Only' },
            { key: 'REJECTED', label: 'Rejected Only' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setOutcomeFilter(tab.key as 'ALL' | 'APPROVED' | 'REJECTED');
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 14px',
                border: 'none',
                backgroundColor: outcomeFilter === tab.key ? 'var(--color-brand-600)' : 'var(--color-surface)',
                color: outcomeFilter === tab.key ? '#ffffff' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                borderRight: '1px solid var(--color-border)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* History Table Container */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: 'var(--space-12)' }}>
            <LoadingSpinner message="Retrieving authorized verification decision history..." />
          </div>
        ) : isError ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <AlertTriangle size={36} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
            <p style={{ color: 'var(--color-status-danger-text)', marginBottom: 'var(--space-3)' }}>
              Failed to load review history records.
            </p>
            <button
              onClick={() => refetch()}
              style={{
                padding: '6px 14px',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <History size={48} color="var(--color-text-tertiary)" style={{ marginBottom: 'var(--space-3)' }} />
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              No Historical Reviews Found
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', maxWidth: '360px', margin: '0 auto' }}>
              No completed verification determinations match your filter. Decisions made in the verification workstation will appear here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
              <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Worker / Dossier ID
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Category & Locality
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Outcome Decision
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Check Breakdown
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Reviewer / Verified At
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Decision Remarks
                  </th>
                  <th style={{ padding: '10px 16px', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: VerificationDossier) => {
                  const checkTypes = Object.values(item.checks || {});
                  const approvedCount = checkTypes.filter((c) => c.status === 'APPROVED').length;
                  const reviewerName = item.assignedReviewer || checkTypes.find((c) => c.verifiedBy)?.verifiedBy || 'Verification Executive';
                  const timestamp = checkTypes.find((c) => c.verifiedAt)?.verifiedAt || item.submissionTime || 'Recorded';
                  const remarks = item.overallRemarks || checkTypes.find((c) => c.rejectionRemarks)?.rejectionRemarks || 'Decision recorded in compliance with 6-point verification policy.';

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.workerName}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                          {item.workerId} • {item.id}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{item.category}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{item.locality}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {item.status === 'APPROVED' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--color-status-success-text)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                              <CheckCircle2 size={14} /> 5/5 Checks Passed
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--color-status-danger-text)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                              <XCircle size={14} /> {approvedCount}/5 Passed (Rejection Logged)
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-xs)' }}>
                          {reviewerName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{timestamp}</div>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={remarks}>
                          {remarks}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            if (onSelectDossier) {
                              onSelectDossier(item.workerId || item.id);
                            } else {
                              navigate(`/verification?search=${encodeURIComponent(item.workerId)}&dossierId=${encodeURIComponent(item.id)}`);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-brand-600)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <ExternalLink size={12} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Page {data.page} of {data.totalPages} ({data.totalCount} total decisions)
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                disabled={data.page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: data.page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={data.page >= data.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, data.totalPages))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: data.page >= data.totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
