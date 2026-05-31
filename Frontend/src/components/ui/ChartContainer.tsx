import React from 'react';
import GlassCard from './GlassCard';

interface ChartContainerProps {
  title:       string;
  subtitle?:   string;
  children:    React.ReactNode;
  action?:     React.ReactNode;   // right-side slot (filter, dropdown)
  style?:      React.CSSProperties;
  height?:     number;
  padding?:    string;
}

export default function ChartContainer({
  title, subtitle, children, action, style, height, padding = '18px',
}: ChartContainerProps) {
  return (
    <GlassCard style={{ display: 'flex', flexDirection: 'column', ...style }} padding={padding}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>{subtitle}</div>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, minHeight: height }}>
        {children}
      </div>
    </GlassCard>
  );
}
