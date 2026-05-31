import type { TooltipProps } from 'recharts';

// Optional per-dataKey hint strings shown below the value
export interface TooltipMetaHints {
  [dataKey: string]: string;
}

interface DarkTooltipProps extends TooltipProps<number, string> {
  metaHints?: TooltipMetaHints;
}

export default function DarkTooltip({ active, payload, label, metaHints }: DarkTooltipProps) {
  if (!active || !payload?.length) return null;

  const details = payload[0]?.payload as {
    requests?: number;
    blocked?: number;
    allowed?: number;
    total?: number;
  } | undefined;

  return (
    <div style={{
      background: 'rgba(5,8,22,0.96)',
      border: '1px solid rgba(6,182,212,0.35)',
      borderRadius: 8,
      boxShadow: '0 18px 50px rgba(0,0,0,0.65), 0 0 24px rgba(6,182,212,0.12)',
      padding: '9px 10px',
      color: '#e2e8f0',
      fontSize: 11,
      minWidth: 140,
      maxWidth: 280,
      backdropFilter: 'blur(18px)',
    }}>
      {label !== undefined && (
        <div style={{ color: '#06b6d4', fontWeight: 800, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'normal' }}>
          {String(label)}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Rich block for timeline points that carry requests/allowed/blocked */}
        {details?.total !== undefined && details.total > 0 && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 5, marginBottom: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#64748b' }}>Total</span>
              <span style={{ color: '#f8fafc', fontWeight: 800 }}>{details.total}</span>
            </div>
          </div>
        )}

        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? '');
          const hint = metaHints?.[key];
          return (
            <div key={`${item.name}-${item.dataKey}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: item.color || '#94a3b8' }}>{item.name}</span>
                <span style={{ color: '#f8fafc', fontWeight: 800 }}>{String(item.value ?? 0)}</span>
              </div>
              {hint && (
                <div style={{ color: '#475569', fontSize: 9, marginTop: 2, lineHeight: 1.4 }}>{hint}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
