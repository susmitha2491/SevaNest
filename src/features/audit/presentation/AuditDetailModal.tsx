import React from 'react';
import { X, ShieldCheck, User, Globe, FileText, ArrowRight } from 'lucide-react';
import { AuditLogItem } from '../domain/types';

interface AuditDetailModalProps {
  auditLog: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
  auditLog,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !auditLog) return null;

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
      aria-labelledby="audit-detail-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '750px',
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
                {auditLog.id}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  fontFamily: 'monospace',
                }}
              >
                {auditLog.actionType}
              </span>
            </div>
            <h2 id="audit-detail-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {auditLog.summary}
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Target Entity: <strong>{auditLog.targetEntityType}</strong> ({auditLog.targetRecordId}) • Recorded: {auditLog.timestamp}
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

        {/* Content */}
        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Actor & Session Metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-subtle)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <User size={16} color="var(--color-brand-600)" />
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Actor Identity</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {auditLog.actorName} ({auditLog.actorStaffId})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldCheck size={16} color="var(--color-success-dark)" />
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Administrative Role</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {auditLog.actorRole}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Globe size={16} color="var(--color-text-tertiary)" />
              <div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Session IP Address</div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                  {auditLog.ipAddress}
                </div>
              </div>
            </div>
          </div>

          {/* Mandatory Operational Remarks */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-1)' }}>
              <FileText size={14} color="var(--color-brand-600)" />
              <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                Recorded Operational Justification
              </h3>
            </div>
            <div
              style={{
                backgroundColor: 'var(--color-bg-subtle)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-primary)',
                lineHeight: 1.6,
                border: '1px solid var(--color-border)',
                fontStyle: 'italic',
              }}
            >
              "{auditLog.operationalRemarks}"
            </div>
          </div>

          {/* Pre vs Post Mutation State Comparison */}
          <div>
            <h3 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
              State Snapshot Diff
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Pre-Mutation Snapshot
                </div>
                <pre
                  style={{
                    backgroundColor: 'var(--color-bg-subtle)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: '180px',
                  }}
                >
                  {JSON.stringify(auditLog.preMutationState || { status: 'INITIAL' }, null, 2)}
                </pre>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success-dark)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ArrowRight size={12} /> Post-Mutation Snapshot
                </div>
                <pre
                  style={{
                    backgroundColor: 'var(--color-success-bg)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-success-border)',
                    fontSize: '11px',
                    color: 'var(--color-success-dark)',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: '180px',
                  }}
                >
                  {JSON.stringify(auditLog.postMutationState || { status: 'COMMITTED' }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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
            Immutable write-only record — Modifications strictly prohibited.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
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
        </div>
      </div>
    </div>
  );
};
