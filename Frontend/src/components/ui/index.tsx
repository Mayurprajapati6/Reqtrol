import { ReactNode } from 'react';

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', display: 'block' }}>{title}</span>
        {subtitle && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  accent?: string;
  icon?: ReactNode;
  empty?: boolean;
}

export function StatCard({ label, value, sub, subColor, accent, icon, empty }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{label}</span>
        {icon && <div style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{icon}</div>}
      </div>
      <div style={{
        fontSize: empty ? '20px' : '26px', fontWeight: 700,
        color: empty ? 'var(--text-muted)' : 'var(--text-primary)',
        letterSpacing: '-0.03em', lineHeight: 1,
        animation: 'countUp 0.5s ease',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: subColor ?? 'var(--text-muted)', marginTop: '6px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function AllowedBadge() {
  return (
    <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: 'var(--emerald)', border: '1px solid rgba(16,185,129,0.2)' }}>
      allowed
    </span>
  );
}

export function BlockedBadge() {
  return (
    <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
      blocked
    </span>
  );
}

export function RiskBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const map = {
    high:   { bg: 'rgba(239,68,68,0.12)',   color: 'var(--red)',    border: 'rgba(239,68,68,0.2)',   label: 'high' },
    medium: { bg: 'rgba(245,158,11,0.12)',  color: 'var(--amber)',  border: 'rgba(245,158,11,0.2)',  label: 'medium' },
    low:    { bg: 'rgba(16,185,129,0.12)',  color: 'var(--emerald)', border: 'rgba(16,185,129,0.2)', label: 'normal' },
  }[level];
  return (
    <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '20px', background: map.bg, color: map.color, border: `1px solid ${map.border}` }}>
      {map.label}
    </span>
  );
}

export function EndpointPill({ text }: { text: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', padding: '2px 7px', borderRadius: '5px', border: '1px solid var(--border-subtle)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {text}
    </span>
  );
}

export function EmptyState({ message = 'No data available', hint }: { message?: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v5M10 13h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontSize: '13px', fontWeight: 500 }}>{message}</p>
      {hint && <p style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px', textAlign: 'center' }}>{hint}</p>}
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid var(--border-subtle)', borderTopColor: 'var(--emerald)', animation: 'spin 0.8s linear infinite' }} />
  );
}

export function DualBar({ allowed, blocked, total }: { allowed: number; blocked: number; total: number }) {
  const ap = total > 0 ? (allowed / total) * 100 : 0;
  const bp = total > 0 ? (blocked / total) * 100 : 0;
  return (
    <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden', display: 'flex', gap: '1px' }}>
      <div style={{ height: '100%', width: `${ap}%`, background: 'var(--emerald)', transition: 'width 0.5s ease', borderRadius: '3px 0 0 3px' }} />
      <div style={{ height: '100%', width: `${bp}%`, background: 'var(--red)', transition: 'width 0.5s ease', borderRadius: '0 3px 3px 0' }} />
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}

export function AxisLabel({ axis, label }: { axis: 'x' | 'y'; label: string }) {
  if (axis === 'x') {
    return (
      <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-faint)', marginTop: '4px', fontStyle: 'italic' }}>
        ↔ {label}
      </div>
    );
  }
  return (
    <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginBottom: '4px', fontStyle: 'italic' }}>
      ↕ {label}
    </div>
  );
}

export function SectionNote({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderLeft: '3px solid var(--border-medium)', padding: '8px 12px', borderRadius: '0 6px 6px 0', marginBottom: '12px' }}>
      {children}
    </div>
  );
}
