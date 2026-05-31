/**
 * RedisMonitor.tsx — Premium Redis Infrastructure Monitor Page
 *
 * Sections:
 *  Header + health badge
 *  5 hero metric cards
 *  Chart 1: Redis Memory Usage (7-day area)
 *  Chart 2: Key Growth Timeline (7-day area)
 *  Chart 3: Redis Operations Commands/Sec (multi-line)
 *  Chart 4: Limiter Counter Activity (stacked area)
 *  Bottom row: Command Stats table | Slowest Commands | Redis Info
 *  Right sidebar: Redis Health | Cache Donut | Keyspace | Limiter Storage
 */

import { motion } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { RefreshCw, Database, Server, Cpu, Key, Zap } from 'lucide-react';

import {
  useRedisHealth, useRedisMemoryTrend, useRedisKeyGrowth,
  useRedisOpsTrend, useRedisLimiterCounters,
  useRedisCommandStats, useRedisSlowCommands, useRedisLimiterStorage,
} from '@/hooks/useRedis';
import { AXIS_TICK_STYLE } from '@/lib/theme';
import DarkTooltip from '@/components/charts/DarkTooltip';
import { formatNumber } from '@/lib/utils';

// ─── Colors ───────────────────────────────────────────────────────────────────

const OP_COLORS: Record<string, string> = {
  GET: '#3b82f6', SET: '#10b981', DEL: '#ef4444', EXPIRE: '#8b5cf6', INCR: '#f59e0b',
};
const LC_COLORS: Record<string, string> = {
  loginLimiter: '#3b82f6', registerLimiter: '#10b981',
  bookingLimiter: '#f59e0b', paymentLimiter: '#06b6d4', others: '#8b5cf6',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ServiceDot({ status }: { status: string }) {
  const color = status === 'Healthy' || status === 'Optimal' ? '#10b981' : status === 'Degraded' ? '#f59e0b' : '#ef4444';
  return (
    <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
      style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
  );
}

function K(n: number, unit = '') { return n >= 1000 ? `${(n / 1000).toFixed(2)}K${unit}` : `${n}${unit}`; }

const glass = (accent = 'rgba(255,255,255,0.07)'): React.CSSProperties => ({
  background: 'rgba(8,13,26,0.92)',
  border: `1px solid ${accent}`,
  borderRadius: 13, padding: '14px 16px',
});

const sectionTitle = (t: string, sub?: string) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{t}</div>
    {sub && <div style={{ fontSize: 9, color: '#334155', marginTop: 2 }}>{sub}</div>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  REDIS MONITOR PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RedisMonitor() {
  const { data: health }    = useRedisHealth();
  const { data: memTrend = [] }   = useRedisMemoryTrend();
  const { data: keyGrowth = [] }  = useRedisKeyGrowth();
  const { data: opsTrend = [] }   = useRedisOpsTrend();
  const { data: limCounters = [] }= useRedisLimiterCounters();
  const { data: cmdStats = [] }   = useRedisCommandStats();
  const { data: slowCmds = [] }   = useRedisSlowCommands();
  const { data: limStorage = [] } = useRedisLimiterStorage();

  const h = health;
  const memPct = h ? Math.round((h.usedMemoryMb / h.maxMemoryMb) * 100) : 70;
  const cacheDonut = h ? [
    { name: 'Used Memory',  value: h.usedMemoryMb,  color: '#06b6d4' },
    { name: 'Free Memory',  value: h.freeMemoryMb,  color: '#1e3a5f' },
  ] : [];

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ════ HEADER ════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Redis Monitor</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '3px 10px' }}>
              <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>{h?.overallHealth ?? 'Healthy'}</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Real-time monitoring of Redis instance and rate limiting storage.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, color: '#94a3b8', fontSize: 12, padding: '7px 14px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
            <option>All Instances</option>
          </select>
          <select style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, color: '#94a3b8', fontSize: 12, padding: '7px 14px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
            <option>Last 7 Days</option>
          </select>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 9, padding: '7px 14px', cursor: 'pointer', fontSize: 12, color: '#06b6d4', fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
            <RefreshCw size={12} /> 10s
          </button>
        </div>
      </div>

      {/* ════ MAIN GRID ════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 256px', gap: 18, alignItems: 'start' }}>

        {/* ──────── LEFT ──────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 5 Hero metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Limiter Keys',     value: K(h?.totalKeys ?? 0),              sub: 'active Redis keys',       color: '#3b82f6', icon: <Key  size={14} /> },
              { label: 'Redis Memory Usage',     value: `${(h?.usedMemoryMb ?? 0).toFixed(1)} MB`,    sub: 'heap used',               color: '#a855f7', icon: <Server size={14} /> },
              { label: 'Command Throughput',     value: `${K(h?.commandThroughput ?? 0)}/s`,     sub: 'ops per second',          color: '#10b981', icon: <Zap size={14} /> },
              { label: 'Request Writes/Sec',     value: `${K(h?.requestWritesSec ?? 0)}/s`,     sub: 'writes per second',       color: '#f59e0b', icon: <Database size={14} /> },
              { label: 'Active Limiter Counters',value: K(h?.activeLimiterKeys ?? 0),            sub: 'live rate-limit keys',    color: '#06b6d4', icon: <Cpu size={14} /> },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                style={{ ...glass(`${s.color}22`), position: 'relative', overflow: 'hidden', boxShadow: `0 0 20px ${s.color}10` }}>
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 0% 0%, ${s.color}0c, transparent 60%)`, pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#1e293b' }}>{s.label}</div>
                  <div style={{ color: s.color, opacity: 0.8 }}>{s.icon}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: 5 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#10b981', marginBottom: 8 }}>{s.sub}</div>
                {/* Mini sparkline from memTrend as proxy */}
                <ResponsiveContainer width="100%" height={28}>
                  <AreaChart data={memTrend.map((p, j) => ({ j, v: p.mb * (i + 1) * 0.4 }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`rmg-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={s.color} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={s.color} stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={s.color} strokeWidth={1.5} fill={`url(#rmg-${i})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            ))}
          </div>

          {/* Charts row 1: Memory | Key Growth */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Chart 1: Memory */}
            <div style={glass()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                {sectionTitle('1. Redis Memory Usage')}
                <select style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', outline: 'none', fontFamily: "'Inter',sans-serif", marginBottom: 14 }}>
                  <option>Last 7 Days</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={memTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}  />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} unit=" MB" domain={['auto', 'auto']} />
                  <Tooltip content={<DarkTooltip />} wrapperStyle={{ background: 'transparent', boxShadow: 'none' }} contentStyle={{ background: 'transparent' }} />
                  <Area type="monotone" dataKey="mb" stroke="#06b6d4" strokeWidth={2} fill="url(#memGrad)" dot={false} name="Memory" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 9, color: '#475569' }}>
                <div style={{ width: 18, height: 2, background: '#06b6d4', borderRadius: 1 }} /> Memory
              </div>
            </div>

            {/* Chart 2: Key Growth */}
            <div style={glass()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                {sectionTitle('2. Key Growth Timeline')}
                <select style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', outline: 'none', fontFamily: "'Inter',sans-serif", marginBottom: 14 }}>
                  <option>Last 7 Days</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={keyGrowth} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="keyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}  />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} />
                  <Tooltip content={<DarkTooltip />} wrapperStyle={{ background: 'transparent', boxShadow: 'none' }} contentStyle={{ background: 'transparent' }} />
                  <Area type="monotone" dataKey="keys" stroke="#a855f7" strokeWidth={2} fill="url(#keyGrad)" dot={false} name="Total Keys" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts row 2: Ops | Limiter Counters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Chart 3: Redis Operations */}
            <div style={glass()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                {sectionTitle('3. Redis Operations (Commands / Sec)')}
                <select style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', outline: 'none', fontFamily: "'Inter',sans-serif", marginBottom: 14 }}>
                  <option>Last 7 Days</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={185}>
                <LineChart data={opsTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} />
                  <Tooltip content={<DarkTooltip />} wrapperStyle={{ background: 'transparent', boxShadow: 'none' }} contentStyle={{ background: 'transparent' }} />
                  {Object.entries(OP_COLORS).map(([key, color]) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} dot={false}
                      style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                {Object.entries(OP_COLORS).map(([key, color]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#475569' }}>
                    <div style={{ width: 14, height: 2, background: color, borderRadius: 1 }} />{key}
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 4: Limiter Counter Activity */}
            <div style={glass()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                {sectionTitle('4. Limiter Counter Activity')}
                <select style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', outline: 'none', fontFamily: "'Inter',sans-serif", marginBottom: 14 }}>
                  <option>Last 7 Days</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={185}>
                <AreaChart data={limCounters} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    {Object.entries(LC_COLORS).map(([key, color]) => (
                      <linearGradient key={key} id={`lcg-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} />
                  <Tooltip content={<DarkTooltip />} wrapperStyle={{ background: 'transparent', boxShadow: 'none' }} contentStyle={{ background: 'transparent' }} />
                  {Object.entries(LC_COLORS).map(([key, color]) => (
                    <Area key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={1.5}
                      fill={`url(#lcg-${key})`} stackId="lc" dot={false} name={key} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                {Object.entries(LC_COLORS).map(([key, color]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#475569' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{key.replace('Limiter', '')}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom 3-column: Command Stats | Slow Commands | Redis Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

            {/* Command Stats */}
            <div style={glass()}>
              {sectionTitle('Real-time Command Stats')}
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 64px 80px', marginBottom: 8 }}>
                {['CMD', 'OPS/SEC', '% TOTAL', 'TREND'].map((h) => (
                  <span key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', color: '#1e293b', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {cmdStats.map((c, i) => (
                <motion.div key={c.command} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  style={{ display: 'grid', gridTemplateColumns: '56px 1fr 64px 80px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                    <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace" }}>{c.command}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{K(c.opsPerSec)}</span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>{c.pctTotal.toFixed(1)}%</span>
                  <ResponsiveContainer width="100%" height={24}>
                    <AreaChart data={c.sparkData.map((v, j) => ({ j, v }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Area type="monotone" dataKey="v" stroke={c.color} strokeWidth={1} fill={`${c.color}18`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              ))}
            </div>

            {/* Slowest Commands */}
            <div style={glass()}>
              {sectionTitle('Slowest Commands (Top 5)')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', marginBottom: 8 }}>
                {['COMMAND', 'AVG LATENCY', 'CALLS/SEC'].map((h) => (
                  <span key={h} style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', color: '#1e293b', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {slowCmds.map((c, i) => (
                <motion.div key={c.command} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace" }}>{c.command}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.avgMs > 2 ? '#ef4444' : c.avgMs > 1 ? '#f59e0b' : '#10b981' }}>{c.avgMs.toFixed(2)}ms</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{c.callsSec.toFixed(1)}</span>
                </motion.div>
              ))}
            </div>

            {/* Redis Info */}
            <div style={glass()}>
              {sectionTitle('Redis Info')}
              {[
                { label: 'Redis Version',        value: String(health?.redisVersion ?? '7.2.4'), color: '#94a3b8' },
                { label: 'Uptime',               value: String(health?.uptime ?? '15d 7h 24m'), color: '#94a3b8' },
                { label: 'Connected Clients',    value: String(health?.connectedClients ?? 48),  color: '#3b82f6' },
                { label: 'Used CPU',             value: `${health?.usedCpuPct ?? 23.6}%`,        color: health && health.usedCpuPct > 80 ? '#ef4444' : '#f1f5f9' },
                { label: 'Hit Rate',             value: `${health?.hitRatePct ?? 98.62}%`,       color: '#10b981' },
                { label: 'Evicted Keys',         value: formatNumber(health?.evictedKeys ?? 1260), color: '#f59e0b' },
                { label: 'Rejected Connections', value: String(health?.rejectedConnections ?? 0),  color: '#ef4444' },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 11, color: '#475569' }}>{s.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono',monospace" }}>{s.value}</span>
                </div>
              ))}
              {/* Hit rate bar */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 9, color: '#334155' }}>
                  <span>Hit Rate</span><span style={{ color: '#10b981', fontWeight: 700 }}>{health?.hitRatePct ?? 98.62}%</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${health?.hitRatePct ?? 98.62}%` }} transition={{ duration: 1 }}
                    style={{ height: '100%', background: '#10b981', borderRadius: 3, boxShadow: '0 0 8px #10b98180' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ──────── RIGHT SIDEBAR ──────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Redis Health */}
          <div style={{ ...glass('rgba(16,185,129,0.18)'), boxShadow: '0 0 24px rgba(16,185,129,0.08)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Redis Health</div>
            {/* Hex icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(16,185,129,0.2)',
              }}>
                <Database size={22} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{health?.overallHealth ?? 'Healthy'}</div>
                <div style={{ fontSize: 9, color: '#334155' }}>All systems operational</div>
              </div>
            </div>
            {/* Service rows */}
            {health && Object.entries(health.services).map(([svc, status]) => (
              <div key={svc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{svc}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ServiceDot status={status} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: status === 'Healthy' || status === 'Optimal' ? '#10b981' : '#f59e0b' }}>{status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Cache Usage Donut */}
          <div style={glass()}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Cache Usage</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={cacheDonut} cx="50%" cy="50%" innerRadius={30} outerRadius={46}
                      startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0} paddingAngle={1}
                    >
                      {cacheDonut.map((d, i) => (
                        <Cell key={i} fill={d.color} style={{ filter: i === 0 ? `drop-shadow(0 0 8px ${d.color}80)` : undefined }} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#06b6d4' }}>{memPct}%</div>
                  <div style={{ fontSize: 7, color: '#475569' }}>Used</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Used Memory',  value: `${health?.usedMemoryMb?.toFixed(1)} MB`, color: '#06b6d4' },
                  { label: 'Free Memory',  value: `${health?.freeMemoryMb?.toFixed(1)} MB`, color: '#1e3a5f' },
                  { label: 'Max Memory',   value: `${health?.maxMemoryMb?.toFixed(1)} MB`,  color: '#475569' },
                ].map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                    <span style={{ fontSize: 9, color: '#475569', flex: 1 }}>{s.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace" }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Keyspace Overview */}
          <div style={glass()}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Keyspace Overview</div>
            {[
              { label: 'Total Keys',      value: K(health?.totalKeys ?? 24580),      icon: '🔑', color: '#3b82f6' },
              { label: 'Expiring Keys',   value: K(health?.expiringKeys ?? 6230),    icon: '⏳', color: '#f59e0b' },
              { label: 'Persistent Keys', value: K(health?.persistentKeys ?? 18350), icon: '💾', color: '#10b981' },
              { label: 'Avg TTL',         value: `${health?.avgTtlSec ?? 46.2}s`,   icon: '⏱',  color: '#06b6d4' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12 }}>{s.icon}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Limiter Storage Overview */}
          <div style={glass()}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Limiter Storage Overview</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {limStorage.map((l, i) => (
                <motion.div key={l.name} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{l.name}</span>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{K(l.keys)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: l.color }}>{l.pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${l.pct * 4}%` }}
                      transition={{ duration: 0.7, delay: i * 0.05 }}
                      style={{ height: '100%', background: l.color, borderRadius: 2, boxShadow: `0 0 6px ${l.color}60` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
