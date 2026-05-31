import { motion } from 'framer-motion';

type BadgeVariant = 'live' | 'allowed' | 'blocked' | 'quby' | 'simulator' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'healthy' | 'degraded' | 'error' | 'unknown';

interface AnimatedBadgeProps {
  variant:  BadgeVariant;
  label?:   string;
  size?:    'sm' | 'md';
}

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string; dot?: string }> = {
  live:      { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: 'rgba(16,185,129,0.25)',  dot: '#10b981' },
  allowed:   { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', border: 'rgba(16,185,129,0.20)' },
  blocked:   { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.22)' },
  quby:      { bg: 'rgba(6,182,212,0.12)',   color: '#06b6d4', border: 'rgba(6,182,212,0.22)' },
  simulator: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.22)' },
  get:       { bg: 'rgba(16,185,129,0.10)',  color: '#10b981', border: 'rgba(16,185,129,0.18)' },
  post:      { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6', border: 'rgba(59,130,246,0.22)' },
  put:       { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.22)' },
  delete:    { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.22)' },
  patch:     { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6', border: 'rgba(139,92,246,0.22)' },
  healthy:   { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', border: 'rgba(16,185,129,0.20)', dot: '#10b981' },
  degraded:  { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.20)', dot: '#f59e0b' },
  error:     { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', border: 'rgba(239,68,68,0.20)',  dot: '#ef4444' },
  unknown:   { bg: 'rgba(100,116,139,0.12)', color: '#64748b', border: 'rgba(100,116,139,0.20)' },
};

const DEFAULT_LABELS: Partial<Record<BadgeVariant, string>> = {
  live:      'LIVE',
  allowed:   '+ Allowed',
  blocked:   '⊘ Blocked',
  quby:      'Quby',
  simulator: 'Simulator',
  get:       'GET',
  post:      'POST',
  put:       'PUT',
  delete:    'DELETE',
  patch:     'PATCH',
  healthy:   'Healthy',
  degraded:  'Degraded',
  error:     'Error',
  unknown:   'Unknown',
};

export default function AnimatedBadge({ variant, label, size = 'sm' }: AnimatedBadgeProps) {
  const style    = BADGE_STYLES[variant];
  const text     = label ?? DEFAULT_LABELS[variant] ?? variant;
  const fontSize = size === 'sm' ? 10 : 12;
  const padding  = size === 'sm' ? '2px 8px' : '4px 12px';
  const animate  = variant === 'live' || variant === 'healthy' || variant === 'degraded' || variant === 'error';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: style.bg, color: style.color,
      border: `1px solid ${style.border}`,
      borderRadius: 20, padding, fontSize, fontWeight: 600,
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
      fontFamily: "'Inter', sans-serif",
    }}>
      {style.dot && animate && (
        <motion.span
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: style.dot, display: 'inline-block', flexShrink: 0 }}
        />
      )}
      {text}
    </span>
  );
}
