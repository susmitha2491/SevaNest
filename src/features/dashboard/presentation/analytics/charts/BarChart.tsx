import React, { useState } from 'react';

export interface BarChartItem {
  label: string;
  value: number;
  subLabel?: string;
  color?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  height?: number;
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
  ariaLabel?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
  valueFormatter = (val) => val.toLocaleString(),
  emptyMessage = 'No data recorded for this period',
  ariaLabel = 'Bar Chart',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartWidth = 500;
  const chartHeight = height;
  const paddingBottom = 38;
  const paddingTop = 24;
  const plotHeight = chartHeight - paddingBottom - paddingTop;
  const barSpacing = chartWidth / data.length;
  const barWidth = Math.max(Math.min(barSpacing * 0.58, 48), 16);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label={ariaLabel}
      >
        {/* Subtle gridlines */}
        {[0, 0.5, 1].map((pct, idx) => {
          const y = paddingTop + plotHeight * (1 - pct);
          return (
            <line
              key={idx}
              x1={0}
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * plotHeight : 0;
          const x = idx * barSpacing + (barSpacing - barWidth) / 2;
          const y = paddingTop + plotHeight - barHeight;
          const isHovered = hoveredIndex === idx;
          const barColor = item.color || 'var(--color-primary)';

          return (
            <g
              key={item.label + idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Background hover highlight */}
              <rect
                x={idx * barSpacing}
                y={paddingTop}
                width={barSpacing}
                height={plotHeight}
                fill={isHovered ? 'rgba(15, 118, 110, 0.05)' : 'transparent'}
                rx="4"
              />

              {/* Bar */}
              <rect
                x={x}
                y={item.value > 0 ? y : paddingTop + plotHeight - 2}
                width={barWidth}
                height={item.value > 0 ? barHeight : 2}
                fill={barColor}
                opacity={isHovered ? 1 : 0.88}
                rx="3"
                ry="3"
              />

              {/* Value label on top of bar */}
              <text
                x={x + barWidth / 2}
                y={item.value > 0 ? y - 5 : paddingTop + plotHeight - 6}
                textAnchor="middle"
                fill={isHovered ? 'var(--color-navy)' : 'var(--color-text-secondary)'}
                fontSize="10"
                fontWeight={isHovered ? 700 : 500}
                fontFamily="inherit"
              >
                {valueFormatter(item.value)}
              </text>

              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - 12}
                textAnchor="middle"
                fill={isHovered ? 'var(--color-navy)' : 'var(--color-text-secondary)'}
                fontSize="11"
                fontWeight={isHovered ? 600 : 400}
                fontFamily="inherit"
              >
                {item.label.length > 12 ? `${item.label.substring(0, 10)}…` : item.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip on hover */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 8,
            backgroundColor: 'var(--color-navy)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600,
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-md)',
            zIndex: 10,
          }}
        >
          {data[hoveredIndex].label}: {valueFormatter(data[hoveredIndex].value)}
          {data[hoveredIndex].subLabel && (
            <span style={{ opacity: 0.8, marginLeft: '4px', fontWeight: 400 }}>
              ({data[hoveredIndex].subLabel})
            </span>
          )}
        </div>
      )}
    </div>
  );
};
