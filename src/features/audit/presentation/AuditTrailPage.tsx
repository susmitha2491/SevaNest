import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { auditRepository } from '../data/auditRepository';
import { AuditLogItem, AuditActionType } from '../domain/types';
import { AuditDetailModal } from './AuditDetailModal';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { env } from '../../../core/config/env';

export const AuditTrailPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<AuditActionType>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const canViewAudit = hasPermission(user?.permissions, PERMISSIONS.AUDIT_VIEW);

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit', 'logs', selectedActionType, searchTerm, currentPage],
    queryFn: () =>
      auditRepository.getAuditLogs({
        actionType: selectedActionType,
        search: searchTerm,
        page: currentPage,
        pageSize: 8,
      }),
    enabled: canViewAudit,
  });

  if (!canViewAudit) {
    return (
      <NoAccessView
        moduleName="Authoritative Audit Trail"
        requiredPermission={PERMISSIONS.AUDIT_VIEW}
      />
    );
  }

  if (isLoading) return <LoadingSpinner message="Loading immutable audit logs..." />;

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
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '450px' }}>
          <Search
            size={16}
            color="var(--color-text-tertiary)"
            style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search audit trail by actor, target ID, event ID, summary..."
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
            aria-label="Search audit trail"
          />
        </div>

        <div>
          <select
            value={selectedActionType}
            onChange={(e) => {
              setSelectedActionType(e.target.value as AuditActionType);
              setCurrentPage(1);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-surface)',
            }}
            aria-label="Filter by action type"
          >
            {actionTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
              {auditData?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No audit records found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                auditData?.items.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
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
