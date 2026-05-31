interface SectionHeaderProps {
  title:     string;
  subtitle?: string;
  action?:   React.ReactNode;
  style?:    React.CSSProperties;
}

export default function SectionHeader({ title, subtitle, action, style }: SectionHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', ...style,
    }}>
      <div>
        <h2 style={{
          fontSize: 13, fontWeight: 700, color: '#94a3b8',
          letterSpacing: '0.07em', textTransform: 'uppercase',
          margin: 0,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
