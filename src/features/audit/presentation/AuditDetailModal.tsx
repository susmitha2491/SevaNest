import React, { useState, useEffect, useCallback } from 'react';
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';
import {
  X,
  ShieldCheck,
  User,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Copy,
  Check,
  Lock,
  Server,
  Hash,
  Mail,
} from 'lucide-react';
import { AuditLogItem } from '../domain/types';

interface AuditDetailModalProps {
  auditLog: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Clean, copyable identifier pill with feedback and overflow prevention.
 * Prevents awkward mid-character wrapping of long UUIDs and cryptographic hashes.
 */
const CopyableIdPill: React.FC<{
  value: string;
  label?: string;
  emptyText?: string;
}> = ({ value, label, emptyText = 'Not recorded' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!value) return;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }
    },
    [value]
  );

  if (!value || value === 'N/A') {
    return (
      <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary, #94a3b8)', fontStyle: 'italic' }}>
        {emptyText}
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: '#f8fafc',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: '6px',
        padding: '3px 8px',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
      title={label ? `${label}: ${value}` : value}
    >
      <span
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-text-primary, #0f172a)',
          wordBreak: 'break-all',
          overflowWrap: 'anywhere',
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied to clipboard' : 'Copy identifier'}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: copied ? '#16a34a' : 'var(--color-text-tertiary, #94a3b8)',
          borderRadius: '4px',
          flexShrink: 0,
          transition: 'color 150ms ease',
        }}
      >
        {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
      </button>
    </div>
  );
};

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
  auditLog,
  isOpen,
  onClose,
}) => {
  useBodyScrollLock(isOpen && Boolean(auditLog));

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: { key: string }) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !auditLog) return null;

  const hasSnapshots = Boolean(
    (auditLog.preMutationState && Object.keys(auditLog.preMutationState).length > 0) ||
    (auditLog.postMutationState && Object.keys(auditLog.postMutationState).length > 0)
  );

  const hasJustification = Boolean(
    auditLog.operationalRemarks &&
    auditLog.operationalRemarks.trim() &&
    auditLog.operationalRemarks.trim() !== 'Recorded in immutable audit trail.'
  );

  const outcomeColors: Record<string, { bg: string; text: string; border: string }> = {
    SUCCESS: { bg: '#ecfdf5', text: '#065f46', border: '#10b981' },
    APPROVED: { bg: '#ecfdf5', text: '#065f46', border: '#10b981' },
    DENIED: { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' },
    BLOCKED: { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' },
    REJECTED: { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' },
    MUTATED: { bg: '#eff6ff', text: '#1e40af', border: '#3b82f6' },
    CLOSED: { bg: '#f1f5f9', text: '#334155', border: '#94a3b8' },
    AUDITED_READ: { bg: '#faf5ff', text: '#6b21a8', border: '#a855f7' },
    ESCALATED: { bg: '#fffbeb', text: '#92400e', border: '#f59e0b' },
    UNBLACKLISTED: { bg: '#ecfdf5', text: '#065f46', border: '#10b981' },
  };

  const currentOutcome = auditLog.outcome || 'RECORDED';
  const outcomeStyle = outcomeColors[currentOutcome] || { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        boxSizing: 'border-box',
        overscrollBehavior: 'contain',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: '16px',
          maxWidth: '860px',
          width: 'min(94vw, 860px)',
          maxHeight: 'min(90vh, calc(100vh - 32px))',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--color-border, #e2e8f0)',
          animation: 'modalSlideIn 150ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header-container"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            backgroundColor: '#f8fafc',
          }}
        >
          <div className="modal-header-content">
            {/* Top Badge Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-brand-600, #0f766e)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  backgroundColor: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                }}
              >
                <Hash size={11} />
                <span>{auditLog.id}</span>
              </div>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '5px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  border: '1px solid #e2e8f0',
                }}
              >
                {auditLog.actionKey || auditLog.actionType}
              </span>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '5px',
                  backgroundColor: outcomeStyle.bg,
                  color: outcomeStyle.text,
                  border: `1px solid ${outcomeStyle.border}`,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}
              >
                {currentOutcome}
              </span>
            </div>

            {/* Action Title */}
            <h2
              id="audit-detail-title"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--color-text-primary, #0f172a)',
                margin: '0 0 6px 0',
                lineHeight: 1.3,
                wordBreak: 'break-word',
              }}
            >
              {auditLog.summary}
            </h2>

            {/* Chronological Timeline & Timezone */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--color-text-secondary, #64748b)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} style={{ color: 'var(--color-text-tertiary, #94a3b8)' }} />
                <span>Recorded:</span>
                <strong style={{ color: 'var(--color-text-primary, #0f172a)' }}>{auditLog.timestamp}</strong>
              </div>

              {auditLog.recordedAtUtc && (
                <span
                  style={{
                    color: 'var(--color-text-tertiary, #64748b)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '11px',
                    backgroundColor: '#ffffff',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                  }}
                  title="UTC Coordinated Universal Time ISO String"
                >
                  UTC: {auditLog.recordedAtUtc}
                </span>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            title="Close modal"
            className="modal-close-btn"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          className="modal-scrollable-body"
          style={{
            flex: 1,
            minHeight: 0,
            padding: '24px',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Section 1: Primary Event Context (WHO & WHICH) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Column A: Actor Identity & Authorization */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="var(--color-brand-600, #0f766e)" />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-secondary, #64748b)',
                  }}
                >
                  Actor Identity & Authorization (WHO)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)' }}>
                    {auditLog.actorName}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {auditLog.actorRole || 'UNASSIGNED'}
                  </span>
                </div>

                {auditLog.actorEmail && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-brand-600, #0f766e)' }}>
                    <Mail size={12} />
                    <span>{auditLog.actorEmail}</span>
                  </div>
                )}

                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)', display: 'block', marginBottom: '3px' }}>
                    Staff / Actor UUID:
                  </span>
                  <CopyableIdPill value={auditLog.actorStaffId} label="Staff Actor UUID" emptyText="Identity UUID unavailable" />
                </div>
              </div>
            </div>

            {/* Column B: Affected Entity & Target Scope */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="var(--color-primary, #0f766e)" />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-secondary, #64748b)',
                  }}
                >
                  Affected Target Entity (WHICH)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)' }}>
                    {auditLog.targetEntityDisplay || auditLog.targetEntityType || 'System Entity'}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {auditLog.targetEntityType || 'GENERAL'}
                  </span>
                </div>

                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)', display: 'block', marginBottom: '3px' }}>
                    Target Record UUID:
                  </span>
                  <CopyableIdPill
                    value={auditLog.targetRecordId && auditLog.targetRecordId !== 'N/A' ? auditLog.targetRecordId : ''}
                    label="Target Entity UUID"
                    emptyText="No entity ID recorded"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Recorded Operational Justification (WHY) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={15} color="var(--color-brand-600, #0f766e)" />
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-secondary, #64748b)',
                  margin: 0,
                }}
              >
                Recorded Operational Justification
              </h3>
            </div>

            {hasJustification ? (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#166534',
                  lineHeight: 1.6,
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#14532d' }}>Recorded Justification:</strong> "{auditLog.operationalRemarks}"
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: 'var(--color-text-secondary, #64748b)',
                  lineHeight: 1.5,
                  border: '1px solid var(--color-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} style={{ color: 'var(--color-text-tertiary, #94a3b8)', flexShrink: 0 }} />
                <span style={{ fontStyle: 'italic' }}>No justification recorded for this event.</span>
              </div>
            )}
          </div>

          {/* Section 3: Before-and-After State Comparison (WHAT CHANGED) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="var(--color-brand-600, #0f766e)" />
                <h3
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-secondary, #64748b)',
                    margin: 0,
                  }}
                >
                  State Snapshot Diff
                </h3>
              </div>

              {auditLog.changedFields && auditLog.changedFields.length > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-brand-600, #0f766e)',
                    fontWeight: 600,
                    backgroundColor: '#f0fdfa',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ccfbf1',
                  }}
                >
                  Mutated Fields: {auditLog.changedFields.join(', ')}
                </span>
              )}
            </div>

            {hasSnapshots ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '12px',
                }}
              >
                {/* Pre-Mutation Card */}
                <div
                  style={{
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderBottom: '1px solid var(--color-border, #e2e8f0)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-text-secondary, #64748b)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>Pre-Mutation Snapshot</span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '12px',
                      backgroundColor: '#f8fafc',
                      fontSize: '11px',
                      color: 'var(--color-text-primary, #0f172a)',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      overflowX: 'auto',
                      maxHeight: '190px',
                      lineHeight: 1.5,
                    }}
                  >
                    {JSON.stringify(auditLog.preMutationState || { status: 'None' }, null, 2)}
                  </pre>
                </div>

                {/* Post-Mutation Card */}
                <div
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f0fdf4',
                      borderBottom: '1px solid #bbf7d0',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ArrowRight size={12} />
                    <span>Post-Mutation Snapshot</span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '12px',
                      backgroundColor: '#f0fdf4',
                      fontSize: '11px',
                      color: '#166534',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      overflowX: 'auto',
                      maxHeight: '190px',
                      lineHeight: 1.5,
                    }}
                  >
                    {JSON.stringify(auditLog.postMutationState || { status: 'None' }, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: 'var(--color-text-secondary, #64748b)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} style={{ color: 'var(--color-text-tertiary, #94a3b8)', flexShrink: 0 }} />
                <span style={{ fontStyle: 'italic' }}>No state-change snapshot available for this event.</span>
              </div>
            )}
          </div>

          {/* Section 4: Session & Network Context (TRACEABILITY) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={15} color="var(--color-brand-600, #0f766e)" />
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-secondary, #64748b)',
                  margin: 0,
                }}
              >
                Session & Network Context
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
                backgroundColor: '#f8fafc',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
              }}
            >
              {/* Session IP */}
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748b)', display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                  Session IP Address
                </span>
                {auditLog.ipAddress ? (
                  <CopyableIdPill value={auditLog.ipAddress} label="IP Address" />
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary, #94a3b8)', fontStyle: 'italic' }}>
                    IP address not recorded
                  </span>
                )}
              </div>

              {/* Request ID */}
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748b)', display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                  Request ID (Traceability)
                </span>
                <CopyableIdPill value={auditLog.requestId || ''} label="Request Traceability ID" emptyText="Not recorded" />
              </div>

              {/* Session ID */}
              <div>
                <span style={{ color: 'var(--color-text-secondary, #64748b)', display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                  Session Identifier
                </span>
                <CopyableIdPill value={auditLog.sessionId || ''} label="Session Identifier" emptyText="Session ID not recorded" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-tertiary, #64748b)' }}>
            <Lock size={13} />
            <span>Immutable write-only record — Modifications strictly prohibited.</span>
          </div>

          <button
            onClick={onClose}
            type="button"
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #cbd5e1)',
              backgroundColor: '#ffffff',
              color: 'var(--color-text-primary, #0f172a)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 150ms ease, border-color 150ms ease',
            }}
          >
            <span>Close</span>
            <kbd
              style={{
                fontSize: '10px',
                fontFamily: 'ui-monospace, monospace',
                backgroundColor: '#f1f5f9',
                padding: '1px 5px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                color: '#64748b',
              }}
            >
              Esc
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
