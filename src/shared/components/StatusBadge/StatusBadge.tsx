import React from 'react';
import { getStatusDescriptor, StatusVariant } from '../../constants/statusLabels';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const variantStyles: Record<StatusVariant, { bg: string; border: string; text: string }> = {
  success: {
    bg: 'var(--color-status-success-bg)',
    border: 'var(--color-status-success-border)',
    text: 'var(--color-status-success-text)',
  },
  warning: {
    bg: 'var(--color-status-warning-bg)',
    border: 'var(--color-status-warning-border)',
    text: 'var(--color-status-warning-text)',
  },
  danger: {
    bg: 'var(--color-status-danger-bg)',
    border: 'var(--color-status-danger-border)',
    text: 'var(--color-status-danger-text)',
  },
  info: {
    bg: 'var(--color-status-info-bg)',
    border: 'var(--color-status-info-border)',
    text: 'var(--color-status-info-text)',
  },
  neutral: {
    bg: 'var(--color-status-neutral-bg)',
    border: 'var(--color-status-neutral-border)',
    text: 'var(--color-status-neutral-text)',
  },
};

/**
 * Accessible Status Badge component.
 * Converts backend status enums into canonical display labels with paired color indicators.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const descriptor = getStatusDescriptor(status);
  const style = variantStyles[descriptor.variant];

  return (
    <span
      className={`status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        letterSpacing: '0.025em',
        whiteSpace: 'nowrap',
      }}
      role="status"
      aria-label={`Status: ${descriptor.label}`}
    >
      {descriptor.label}
    </span>
  );
};
