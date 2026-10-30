import React from 'react';

interface DonutGaugeProps {
  value: number | null | undefined; // 0 to 1 (or percentage 0-100)
  label: string;
  numerator?: number | null;
  denominator?: number | null;
  numeratorLabel?: string;
  denominatorLabel?: string;
  size?: number;
  strokeWidth?: number;
  colorVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'navy';
  isInverseColorScale?: boolean; // For rates where lower is better (e.g., cancellation or replacement)
  emptyMessage?: string;
  ariaLabel?: string;
}

export const DonutGauge: React.FC<DonutGaugeProps> = ({
  value,
  label,
  numerator,
  denominator,
  numeratorLabel,
  denominatorLabel,
  size = 110,
  strokeWidth = 9,
  colorVariant = 'primary',
  isInverseColorScale = false,
  emptyMessage = 'Data Unavailable',
  ariaLabel,
}) => {
  if (value === null || value === undefined) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-3)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `${strokeWidth}px solid var(--color-border)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-disabled)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
          }}
        >
          —
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          {label}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--color-text-disabled)', marginTop: '2px' }}>
          {emptyMessage}
        </span>
      </div>
    );
  }

  // Normalize rate to percentage between 0 and 100
  const normalizedPct = value <= 1 && value >= 0 ? Math.round(value * 1000) / 10 : Math.round(value * 10) / 10;
  const clampedPct = Math.min(Math.max(normalizedPct, 0), 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  // Determine stroke color
  let strokeColor = 'var(--color-primary)';
  if (isInverseColorScale) {
    // Lower rate is better (e.g., cancellations or replacements)
    if (clampedPct > 15) {
      strokeColor = 'var(--color-error)';
    } else if (clampedPct > 8) {
      strokeColor = 'var(--color-warning)';
    } else {
      strokeColor = 'var(--color-success)';
    }
  } else {
    switch (colorVariant) {
      case 'success':
        strokeColor = 'var(--color-success)';
        break;
      case 'warning':
        strokeColor = 'var(--color-warning)';
        break;
      case 'danger':
        strokeColor = 'var(--color-error)';
        break;
      case 'navy':
        strokeColor = 'var(--color-navy)';
        break;
      case 'primary':
      default:
        strokeColor = 'var(--color-primary)';
        break;
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2)',
        textAlign: 'center',
      }}
      role="group"
      aria-label={ariaLabel || `${label}: ${normalizedPct.toFixed(1)}%`}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>

        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1 }}>
            {normalizedPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-navy)', marginTop: 'var(--space-2)' }}>
        {label}
      </span>

      {numerator !== undefined && denominator !== undefined && numerator !== null && denominator !== null && (
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          {numerator.toLocaleString()}{numeratorLabel ? ` ${numeratorLabel}` : ''} / {denominator.toLocaleString()}{denominatorLabel ? ` ${denominatorLabel}` : ''}
        </span>
      )}
    </div>
  );
};
