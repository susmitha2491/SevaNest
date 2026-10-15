import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface VerificationBadgeProps {
  isFullyVerified: boolean;
  checkSummary?: string;
  className?: string;
}

/**
 * Trust Before Verified Badge.
 * Renders the verified trust badge strictly when the server confirms all configured checks are approved.
 */
export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  isFullyVerified,
  checkSummary = isFullyVerified ? 'All checks approved' : 'Verification in progress',
  className = '',
}) => {
  if (!isFullyVerified) {
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
        title={checkSummary}
      >
        <AlertCircle size={12} />
        <span>Pending KYC</span>
      </span>
    );
  }

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
      title={checkSummary}
    >
      <CheckCircle2 size={12} />
      <span>Verified</span>
    </span>
  );
};
