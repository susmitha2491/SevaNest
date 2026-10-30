import React from 'react';
import { Star } from 'lucide-react';

export interface HorizontalBarItem {
  id: string;
  title: string;
  subtitle?: string;
  value: number;
  formattedValue?: string;
  badge?: string;
  color?: string;
  starRating?: number;
}

interface HorizontalBarChartProps {
  items: HorizontalBarItem[];
  emptyMessage?: string;
  maxItems?: number;
  ariaLabel?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  items,
  emptyMessage = 'No records available in this period',
  maxItems = 6,
  ariaLabel = 'Horizontal Ranking Chart',
}) => {
  if (!items || items.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-6)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-xs)',
          backgroundColor: 'var(--color-bg-app)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-border)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  const displayedItems = items.slice(0, maxItems);
  const maxValue = Math.max(...displayedItems.map((i) => i.value), 1);

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}
    >
      {displayedItems.map((item, index) => {
        const percentage = maxValue > 0 ? Math.min(Math.round((item.value / maxValue) * 100), 100) : 0;
        const barColor = item.color || 'var(--color-primary)';

        return (
          <div
            key={item.id || index}
            role="listitem"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-app)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    height: '18px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: index < 3 ? 'var(--color-primary)' : 'var(--color-border)',
                    color: index < 3 ? '#fff' : 'var(--color-text-secondary)',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  #{index + 1}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-navy)' }}>
                  {item.title}
                </span>
                {item.subtitle && (
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                    ({item.subtitle})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {item.starRating !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--color-amber)' }}>
                    <Star size={11} fill="currentColor" />
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>
                      {item.starRating.toFixed(2)}
                    </span>
                  </div>
                )}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-navy)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {item.formattedValue || item.value.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Progress bar container */}
            <div
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: 'var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percentage}%`,
                  height: '100%',
                  backgroundColor: barColor,
                  borderRadius: '3px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
