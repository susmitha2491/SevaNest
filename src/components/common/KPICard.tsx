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
  isSelected?: boolean;
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
  isSelected = false,
}) => {
  const displayValue = value === null || value === undefined ? '—' : value;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      style={{
        backgroundColor: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-bg-surface)',
        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: isSelected ? 'calc(var(--space-4) - 1px)' : 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: isSelected ? '0 0 0 1px var(--color-primary), var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'all var(--transition-fast)',
      }}
      className={`kpi-card ${isSelected ? 'selected' : ''}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: isSelected ? 700 : 500 }}>
          {title}
        </span>
        {Icon && (
          <div
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-primary-subtle)',
              color: isSelected ? '#ffffff' : 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--transition-fast)',
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
