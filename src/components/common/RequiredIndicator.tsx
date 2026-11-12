import React from 'react';

export interface RequiredIndicatorProps {
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
}

/**
 * Enterprise standard required-field indicator (red asterisk).
 * Enforces consistent color, size, spacing, and vertical alignment across all forms.
 */
export const RequiredIndicator: React.FC<RequiredIndicatorProps> = ({
  className,
  style,
  'aria-hidden': ariaHidden = true,
}) => (
  <span
    className={className}
    aria-hidden={ariaHidden}
    data-testid="required-indicator"
    style={{
      color: 'var(--color-error, #dc2626)',
      marginLeft: '4px',
      fontWeight: 700,
      fontSize: 'var(--font-size-sm, 14px)',
      lineHeight: 1,
      display: 'inline-block',
      verticalAlign: 'baseline',
      ...style,
    }}
  >
    *
  </span>
);

