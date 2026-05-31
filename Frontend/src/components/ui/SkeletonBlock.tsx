import { motion } from 'framer-motion';

// ─── Shared pulse config ───────────────────────────────────────────────────────
const PULSE = {
  animate: { opacity: [0.4, 0.75, 0.4] },
  transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const },
};

// ─── Metric Card skeleton — matches MetricCard/GlassCard dimensions ────────────
export function SkeletonMetricCard() {
  return (
    <motion.div
      {...PULSE}
      style={{
        background: 'rgba(8,13,26,0.90)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: 18,
        minHeight: 148,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 90, height: 9, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)' }} />
      </div>
      <div style={{ width: 72, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.09)' }} />
      <div style={{ width: 130, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ marginTop: 'auto', height: 48, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }} />
    </motion.div>
  );
}

// ─── Chart frame skeleton ──────────────────────────────────────────────────────
export function SkeletonChartFrame({ height = 260 }: { height?: number }) {
  return (
    <motion.div
      {...PULSE}
      style={{
        height,
        borderRadius: 6,
        background: 'rgba(255,255,255,0.025)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 5,
        padding: '0 12px 12px',
        overflow: 'hidden',
      }}
    >
      {[38, 62, 28, 75, 50, 68, 42, 55, 33, 72, 48, 80, 38, 60, 52].map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            background: 'rgba(6,182,212,0.18)',
            borderRadius: '3px 3px 0 0',
          }}
        />
      ))}
    </motion.div>
  );
}

// ─── Table rows skeleton ───────────────────────────────────────────────────────
export function SkeletonTableRows({ rows = 6, height = 42 }: { rows?: number; height?: number }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.07 }}
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 18px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
          <div style={{ flex: 2, height: 9, background: 'rgba(255,255,255,0.07)', borderRadius: 4 }} />
          <div style={{ flex: 1, height: 9, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
          <div style={{ width: 64, height: 9, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
          <div style={{ width: 52, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── User profile card skeleton — matches UserProfileCard (minHeight 214) ──────
export function SkeletonUserCard() {
  return (
    <motion.div
      {...PULSE}
      style={{
        background: 'rgba(5,8,22,0.78)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 14,
        minHeight: 214,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Avatar + name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.09)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: '62%', height: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }} />
          <div style={{ width: '38%', height: 18, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
        </div>
      </div>
      {/* Metric tiles 2×3 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 7,
              padding: '8px 9px',
              gridColumn: i === 5 ? '1 / -1' : undefined,
            }}
          >
            <div style={{ width: '58%', height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 6 }} />
            <div style={{ width: '46%', height: 10, background: 'rgba(255,255,255,0.09)', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Stat card skeleton — matches Stat component in RateLimiters ───────────────
export function SkeletonStatCard() {
  return (
    <motion.div
      {...PULSE}
      style={{
        background: 'rgba(5,8,22,0.78)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '13px 14px',
        minHeight: 90,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ width: '72%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
      <div style={{ width: '46%', height: 24, background: 'rgba(255,255,255,0.09)', borderRadius: 4 }} />
      <div style={{ width: '86%', height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
    </motion.div>
  );
}

// ─── Endpoint card skeleton — matches EndpointCard (minHeight 190) ─────────────
export function SkeletonEndpointCard() {
  return (
    <motion.div
      {...PULSE}
      style={{
        background: 'rgba(5,8,22,0.78)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 14,
        minHeight: 190,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ width: 110, height: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }} />
        </div>
        <div style={{ width: 62, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
      </div>
      {/* Request count */}
      <div>
        <div style={{ width: 80, height: 28, background: 'rgba(255,255,255,0.09)', borderRadius: 4, marginBottom: 6 }} />
        <div style={{ width: 88, height: 7, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
      </div>
      {/* Metric tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 7,
              padding: '8px 9px',
            }}
          >
            <div style={{ width: '60%', height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 6 }} />
            <div style={{ width: '44%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
