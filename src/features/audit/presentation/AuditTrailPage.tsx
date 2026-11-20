import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Eye, ChevronLeft, ChevronRight, Info, RefreshCw } from 'lucide-react';
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

  const { data: auditData, isLoading, isFetching, refetch } = useQuery({
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
    { key: 'ALL', label: 'All Administrative Actions' },
    { key: 'verification', label: 'KYC & Verifications (All)' },
    { key: 'verification.approve', label: 'Verification Approved' },
    { key: 'verification.reject', label: 'Verification Rejected' },
    { key: 'worker', label: 'Worker Operations (All)' },
    { key: 'worker.sensitive_view', label: 'Worker PII / Sensitive View' },
    { key: 'worker.document_inspect', label: 'Worker Document Inspected' },
    { key: 'ticket', label: 'Support Tickets (All)' },
    { key: 'ticket.close', label: 'Support Ticket Closed' },
    { key: 'attendance', label: 'Attendance Records (All)' },
    { key: 'attendance.correct', label: 'Attendance Corrected' },
    { key: 'payment', label: 'Payments & Financial Operations' },
    { key: 'auth', label: 'Auth & Session Logins' },
    { key: 'security', label: 'Security & Access Control' },
    { key: 'user', label: 'User & Staff Management' },
    // Mock / legacy compatibility options
    { key: 'CONFIG_PUBLISH_FEES', label: 'Fee Schedule Published' },
    { key: 'CONFIG_UPDATE_ROLE', label: 'Role Privileges Updated' },
    { key: 'REFUND_PROCESSED', label: 'Refund Processed' },
    { key: 'WORKER_SUSPEND', label: 'Worker Suspended' },
    { key: 'CUSTOMER_SUSPEND', label: 'Customer Suspended' },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              border: '1px solid var(--color-border)',
              cursor: isFetching ? 'not-allowed' : 'pointer',
              opacity: isFetching ? 0.7 : 1,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <RefreshCw
              size={14}
              color="var(--color-primary)"
              className={isFetching ? 'animate-spin' : ''}
            />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
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
                    <td style={{ padding: 'var(--space-4)', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid var(--color-border)',
                          fontWeight: 700,
                          color: 'var(--color-brand-600)',
                          fontFamily: 'ui-monospace, monospace',
                          fontSize: '11px',
                        }}
                        title={log.id}
                      >
                        {log.id.length > 20 ? `${log.id.slice(0, 8)}…${log.id.slice(-6)}` : log.id}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-4)', minWidth: '190px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                        {log.actorName}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            fontFamily: 'ui-monospace, monospace',
                            backgroundColor:
                              log.actorRole === 'SUPER_ADMIN'
                                ? '#eff6ff'
                                : log.actorRole === 'OPERATIONS_ADMIN'
                                ? '#f0fdfa'
                                : log.actorRole?.includes('VERIFICATION')
                                ? '#faf5ff'
                                : log.actorRole?.includes('SUPPORT')
                                ? '#fffbeb'
                                : '#f1f5f9',
                            color:
                              log.actorRole === 'SUPER_ADMIN'
                                ? '#1e40af'
                                : log.actorRole === 'OPERATIONS_ADMIN'
                                ? '#0f766e'
                                : log.actorRole?.includes('VERIFICATION')
                                ? '#6b21a8'
                                : log.actorRole?.includes('SUPPORT')
                                ? '#92400e'
                                : '#334155',
                            border: '1px solid rgba(0,0,0,0.08)',
                          }}
                        >
                          {log.actorRole || 'SYSTEM'}
                        </span>
                        {log.actorEmail && (
                          <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                            {log.actorEmail}
                          </span>
                        )}
                        {log.ipAddress && (
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                            {log.ipAddress}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', minWidth: '170px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            fontFamily: 'monospace',
                          }}
                        >
                          {log.actionType}
                        </span>
                        {log.outcome && (
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              backgroundColor:
                                log.outcome === 'APPROVED' || log.outcome === 'SUCCESS' || log.outcome === 'UNBLACKLISTED'
                                  ? '#dcfce7'
                                  : log.outcome === 'DENIED' || log.outcome === 'BLOCKED' || log.outcome === 'BLACKLISTED'
                                  ? '#fee2e2'
                                  : log.outcome === 'REJECTED' || log.outcome === 'MUTATED'
                                  ? '#fef3c7'
                                  : '#e0f2fe',
                              color:
                                log.outcome === 'APPROVED' || log.outcome === 'SUCCESS' || log.outcome === 'UNBLACKLISTED'
                                  ? '#15803d'
                                  : log.outcome === 'DENIED' || log.outcome === 'BLOCKED' || log.outcome === 'BLACKLISTED'
                                  ? '#b91c1c'
                                  : log.outcome === 'REJECTED' || log.outcome === 'MUTATED'
                                  ? '#b45309'
                                  : '#0369a1',
                            }}
                          >
                            {log.outcome}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', minWidth: '150px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {log.targetEntityDisplay || log.targetEntityType || 'System'}
                      </div>
                      <div style={{ fontFamily: 'monospace', color: 'var(--color-text-tertiary)', marginTop: '2px' }} title={log.targetRecordId}>
                        {log.targetRecordId && log.targetRecordId.length > 22
                          ? `${log.targetRecordId.slice(0, 10)}…${log.targetRecordId.slice(-6)}`
                          : (log.targetRecordId || 'N/A')}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                      {log.summary}
                    </td>
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                      <span title={log.recordedAtUtc ? `UTC: ${log.recordedAtUtc}` : undefined}>
                        {log.timestamp}
                      </span>
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

export default AuditTrailPage;
