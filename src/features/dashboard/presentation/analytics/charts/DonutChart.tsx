import React, { useState } from 'react';

export interface DonutChartSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutChartSegment[];
  centerLabel?: string;
  size?: number;
  strokeWidth?: number;
  emptyMessage?: string;
  ariaLabel?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  centerLabel = 'Total',
  size = 164,
  strokeWidth = 22,
  emptyMessage = 'No ticket records available',
  ariaLabel = 'Ticket Status Distribution Chart',
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const total = segments.reduce((sum, seg) => sum + Math.max(0, seg.value), 0);

  if (!segments.length || total === 0) {
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

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  const nonZeroSegments = segments.filter((s) => s.value > 0);
  const hoveredSegment = nonZeroSegments.find((s) => s.id === hoveredId) ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-6)',
        width: '100%',
      }}
    >
      {/* SVG Multi-Segment Doughnut Ring */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
          style={{ transform: 'rotate(-90deg)', display: 'block' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
          />
          {nonZeroSegments.map((seg) => {
            const fraction = seg.value / total;
            const dashLength = fraction * circumference;
            const dashOffset = -cumulativeOffset;
            cumulativeOffset += dashLength;
            const isHovered = hoveredId === seg.id;

            return (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                style={{
                  cursor: 'pointer',
                  opacity: hoveredId && !isHovered ? 0.65 : 1,
                  transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                }}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            );
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: 'var(--space-2)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.1 }}>
            {hoveredSegment ? hoveredSegment.value.toLocaleString() : total.toLocaleString()}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginTop: '2px',
              maxWidth: '90px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hoveredSegment ? hoveredSegment.label : centerLabel}
          </span>
        </div>
      </div>

      {/* Breakdown Legend */}
      <div
        role="list"
        aria-label={`${ariaLabel} legend`}
        style={{
          flex: '1 1 180px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {segments.map((seg) => {
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0.0';
          const isHovered = hoveredId === seg.id;
          return (
            <div
              key={seg.id}
              role="listitem"
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isHovered ? 'var(--color-primary-subtle)' : 'var(--color-bg-app)',
                border: `1px solid ${isHovered ? 'var(--color-primary)' : 'var(--color-border)'}`,
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-navy)' }}>
                  {seg.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexShrink: 0 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-navy)' }}>
                  {seg.value.toLocaleString()}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  ({pct}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

