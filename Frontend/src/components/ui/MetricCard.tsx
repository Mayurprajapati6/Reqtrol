import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import GlassCard from './GlassCard';

interface SparkPoint { v: number }

interface MetricCardProps {
  label:      string;
  value:      string | number;
  subtitle?:  string;
  trend?:     { value: number; label?: string };   // +/- percentage
  icon:       React.ReactNode;
  accent:     string;       // hex color
  gradient:   string;       // CSS gradient
  sparkData?: number[];
  pulse?:     boolean;
  delay?:     number;
}

function StaticCounter({ target }: { target: number }) {
  return <span>{target.toLocaleString()}</span>;
}

export default function MetricCard({
  label, value, subtitle, trend, icon, accent, gradient, sparkData, pulse = true, delay = 0,
}: MetricCardProps) {

  const numericValue  = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
  const displaySuffix = typeof value === 'string' ? value.replace(/^[\d,.]+/, '') : '';

  const spark: SparkPoint[] = (sparkData ?? []).map((v) => ({ v }));

  const trendUp      = (trend?.value ?? 0) >= 0;
  const trendColor   = trendUp ? '#10b981' : '#ef4444';
  const trendSymbol  = trendUp ? '↑' : '↓';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <GlassCard
        accent={accent}
        glowColor={`${accent}22`}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Pulse indicator */}
        {pulse && (
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <motion.div
              animate={{ scale: [1, 2.2, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: accent, position: 'absolute',
                top: 0, left: 0,
              }}
            />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: accent, position: 'relative' }} />
          </div>
        )}

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: accent,
          }}>
            {label}
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${accent}18`,
            border: `1px solid ${accent}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
        </div>

        {/* Value */}
        <div style={{
          fontSize: 34, fontWeight: 800, color: '#f1f5f9',
          letterSpacing: '-0.04em', lineHeight: 1.1,
          display: 'flex', alignItems: 'baseline', gap: 4,
          fontFamily: "'Inter', sans-serif",
        }}>
          <StaticCounter target={numericValue} />
          {displaySuffix && (
            <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400 }}>{displaySuffix}</span>
          )}
        </div>

        {/* Trend + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {trend && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: trendColor,
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              {trendSymbol} {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {subtitle && (
            <span style={{ fontSize: 11, color: '#64748b' }}>{subtitle}</span>
          )}
        </div>

        {/* Sparkline */}
        <div style={{ marginTop: 14, height: 48, marginLeft: -4, marginRight: -4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
              <defs>
                <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={accent} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v"
                stroke={accent} strokeWidth={1.5}
                fill={`url(#sg-${label})`}
                dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </motion.div>
  );
}
