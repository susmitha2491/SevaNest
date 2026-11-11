import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Eye, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { auditRepository } from '../data/auditRepository';
import { AuditLogItem, AuditActionType } from '../domain/types';
import { AuditDetailModal } from './AuditDetailModal';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { env } from '../../../core/config/env';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { CustomSelect } from '../../../components/common/CustomSelect';
import { SearchInput } from '../../../components/common/SearchInput';

export const AuditTrailPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);

  const [selectedActionType, setSelectedActionType] = useState<AuditActionType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Reset page when debounced search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const canViewAudit = hasPermission(user?.permissions, PERMISSIONS.AUDIT_VIEW);

  const { data: auditData, isLoading, isFetching } = useQuery({
    queryKey: ['audit', 'logs', selectedActionType, debouncedSearchTerm, currentPage],
    queryFn: () =>
      auditRepository.getAuditLogs({
        actionType: selectedActionType,
        search: debouncedSearchTerm,
        page: currentPage,
        pageSize: 8,
      }),
    enabled: canViewAudit,
    placeholderData: keepPreviousData,
  });

  if (!canViewAudit) {
    return (
      <NoAccessView
        moduleName="Authoritative Audit Trail"
        requiredPermission={PERMISSIONS.AUDIT_VIEW}
      />
    );
  }

  const actionTypes: { key: AuditActionType; label: string }[] = [
    { key: 'ALL', label: 'All Action Types' },
    { key: 'VERIF_APPROVE_DOC', label: 'Verification Approved' },
    { key: 'VERIF_REJECT_DOC', label: 'Verification Rejected' },
    { key: 'CONFIG_PUBLISH_FEES', label: 'Fee Schedule Published' },
    { key: 'CONFIG_UPDATE_ROLE', label: 'Role Privileges Updated' },
    { key: 'REFUND_PROCESSED', label: 'Refund Processed' },
    { key: 'WORKER_SUSPEND', label: 'Worker Suspended' },
    { key: 'CUSTOMER_SUSPEND', label: 'Customer Suspended' },
    { key: 'PII_REVEAL_CONTACT', label: 'PII Contact Revealed' },
    { key: 'BOOKING_CANCEL', label: 'Booking Cancelled' },
    { key: 'DISPUTE_ESCALATE', label: 'Dispute Escalated' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Authoritative Platform Audit Trail
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Immutable, chronological oversight of administrative actions, KYC decisions, fee publishes, and PII reveal events.
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
          <span>{env.VITE_USE_MOCK_AUTH ? 'Strictly Read-Only — Simulated Immutability Log' : 'Strictly Read-Only — Immutable Platform Audit Trail'}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          padding: '16px',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <SearchInput
          value={searchTerm}
          onChange={(val) => setSearchTerm(val)}
          placeholder="Search audit trail by actor, target ID, event ID, summary..."
          ariaLabel="Search audit trail"
          isLoading={isFetching && debouncedSearchTerm.trim().length > 0}
          containerStyle={{ flex: '1 1 320px', minWidth: 'min(100%, 240px)' }}
        />

        <CustomSelect
          value={selectedActionType}
          onChange={(val) => {
            setSelectedActionType(val as AuditActionType);
            setCurrentPage(1);
          }}
          options={actionTypes.map((t) => ({ value: t.key, label: t.label }))}
          ariaLabel="Filter by action type"
          minWidth="220px"
        />
      </div>

      {/* Audit Log Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Event ID
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Actor Identity
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Action Type
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Target Record
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Summary / Delta
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Timeline
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !auditData ? (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <LoadingSpinner message="Loading immutable audit logs..." />
                  </td>
                </tr>
              ) : auditData?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No audit records found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                auditData?.items.map((log) => (
                  <tr
                    key={log.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View audit log details for event ${log.id}`}
                    className="clickable-table-row"
                    onClick={(e) => {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      setSelectedLog(log);
                      setIsDetailOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        e.preventDefault();
                        setSelectedLog(log);
                        setIsDetailOpen(true);
                      }
                    }}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td style={{ padding: 'var(--space-4)', fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                      {log.id}
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{log.actorName}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {log.actorRole} • {log.ipAddress}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                        }}
                      >
                        {log.actionType}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{log.targetEntityType}: </span>
                      {log.targetRecordId}
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                      {log.summary}
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                      {log.timestamp}
                    </td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSelectedLog(log);
                          setIsDetailOpen(true);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-surface)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye size={13} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {auditData && auditData.totalPages > 1 && (
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
              Page {auditData.page} of {auditData.totalPages} ({auditData.totalCount} audit events)
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                disabled={auditData.page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: auditData.page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={auditData.page >= auditData.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, auditData.totalPages))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: auditData.page >= auditData.totalPages ? 'not-allowed' : 'pointer',
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

      {/* Audit Detail Modal */}
      <AuditDetailModal
        auditLog={selectedLog}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedLog(null);
        }}
      />
    </div>
  );
};
