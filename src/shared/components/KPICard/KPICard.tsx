import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number | null | undefined;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
}

/**
 * Operational KPI Metric Card.
 * Renders server-reported operational counts and metric summaries.
 * Unknown or unprovided metrics are cleanly displayed as "—" rather than fabricated as 0.
 */
export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  onClick,
}) => {
  const displayValue = value === null || value === undefined ? '—' : value;

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all var(--transition-fast)',
      }}
      className="kpi-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary-subtle)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--font-size-kpi)', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.2 }}>
          {displayValue}
        </span>
        {trend && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: trend.isPositive ? 'var(--color-status-success-text)' : 'var(--color-status-danger-text)',
            }}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
};
