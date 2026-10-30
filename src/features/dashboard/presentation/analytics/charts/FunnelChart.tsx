import React from 'react';
import { ArrowDown } from 'lucide-react';

export interface FunnelStage {
  name: string;
  count: number;
  subtext?: string;
  color?: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
  emptyMessage?: string;
  ariaLabel?: string;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({
  stages,
  emptyMessage = 'No funnel data available',
  ariaLabel = 'Conversion Funnel Chart',
}) => {
  if (!stages || stages.length === 0) {
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

  const baseCount = stages[0]?.count || 0;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}
    >
      {stages.map((stage, idx) => {
        const percentage = baseCount > 0 ? Math.min(Math.round((stage.count / baseCount) * 100), 100) : 0;
        const widthPct = Math.max(percentage, 18); // Minimum width for visual legibility
        const stageColor = stage.color || (idx === 0 ? 'var(--color-navy)' : idx === stages.length - 1 ? 'var(--color-success)' : 'var(--color-primary)');

        return (
          <React.Fragment key={stage.name + idx}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span
                    style={{
                      padding: '0 6px',
                      height: '18px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: stageColor,
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Stage {idx + 1}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-navy)' }}>
                    {stage.name}
                  </span>
                  {stage.subtext && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                      ({stage.subtext})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    {idx === 0 ? '100% (Baseline)' : `${percentage}% of Requests`}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: 'var(--color-navy)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Progress visual bar */}
              <div
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--color-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: '100%',
                    backgroundColor: stageColor,
                    borderRadius: '4px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Dropdown indicator between stages */}
            {idx < stages.length - 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px 0',
                  color: 'var(--color-text-disabled)',
                  fontSize: '10px',
                  gap: '4px',
                }}
              >
                <ArrowDown size={12} />
                <span>
                  Drop-off:{' '}
                  {baseCount > 0
                    ? `${Math.max(0, 100 - Math.round((stages[idx + 1].count / (stage.count || 1)) * 100))}%`
                    : '0%'}
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
