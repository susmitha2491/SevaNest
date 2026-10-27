import React from 'react';
import { CheckCircle2, AlertCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface VerificationBadgeProps {
  isFullyVerified: boolean;
  status?: string;
  checkSummary?: string;
  className?: string;
}

/**
 * Trust Before Verified Badge.
 * Renders the verified trust badge strictly when the server confirms all configured checks are approved,
 * or displays the specific operational verification stage (Pending, In Review, Rejected, Re-Check Due).
 */
export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  isFullyVerified,
  status,
  checkSummary,
  className = '',
}) => {
  const normStatus = (status || (isFullyVerified ? 'VERIFIED' : 'PENDING')).toUpperCase();

  if (normStatus === 'IN_REVIEW') {
    return (
      <span
        className={`verification-badge in-review ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-status-info-bg)',
          border: '1px solid var(--color-status-info-border)',
          color: 'var(--color-status-info-text)',
        }}
        title={checkSummary || 'Review in progress by Verification Executive'}
      >
        <Clock size={12} />
        <span>In Review</span>
      </span>
    );
  }

  if (normStatus === 'REJECTED') {
    return (
      <span
        className={`verification-badge rejected ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-status-danger-bg)',
          border: '1px solid var(--color-status-danger-border)',
          color: 'var(--color-status-danger-text)',
        }}
        title={checkSummary || 'Check rejected / Corrections requested'}
      >
        <AlertTriangle size={12} />
        <span>Rejected / Corrections</span>
      </span>
    );
  }

  if (normStatus === 'RECHECK_DUE') {
    return (
      <span
        className={`verification-badge recheck-due ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-status-warning-bg)',
          border: '1px solid var(--color-status-warning-border)',
          color: 'var(--color-status-warning-text)',
        }}
        title={checkSummary || 'Periodic verification re-check due'}
      >
        <RefreshCw size={12} />
        <span>Re-Check Due</span>
      </span>
    );
  }

  if (normStatus === 'VERIFIED' || normStatus === 'APPROVED' || isFullyVerified) {
    return (
      <span
        className={`verification-badge fully-verified ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-status-success-bg)',
          border: '1px solid var(--color-status-success-border)',
          color: 'var(--color-status-success-text)',
        }}
        title={checkSummary || 'All checks approved'}
      >
        <CheckCircle2 size={12} />
        <span>Verified</span>
      </span>
    );
  }

  return (
    <span
      className={`verification-badge in-progress ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--color-status-warning-bg)',
        border: '1px solid var(--color-status-warning-border)',
        color: 'var(--color-status-warning-text)',
      }}
      title={checkSummary || 'Verification in progress'}
    >
      <AlertCircle size={12} />
      <span>Pending KYC</span>
    </span>
  );
};

