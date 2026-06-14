import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Activity, Shield, AlertOctagon, Users, Database, ArrowRight, MoreHorizontal } from 'lucide-react';

import {
  dashboardKeys,
  useDashboardOverview,
  useDashboardTimeline,
  useDashboardEndpointChart,
  useDashboardSourceChart,
  useDashboardActivity,
  useDashboardSystemOverview,
} from '@/hooks/useDashboard';

import { UserAvatar, displayName } from '@/components/ui/UserAvatar';
import { istHHMMSS } from '@/utils/ist';
import MetricCard from '@/components/ui/MetricCard';
import ChartContainer from '@/components/ui/ChartContainer';
import GlassCard from '@/components/ui/GlassCard';
import AnimatedBadge from '@/components/ui/AnimatedBadge';
import CenteredModal from '@/components/ui/CenteredModal';
import DarkTooltip from '@/components/charts/DarkTooltip';
import {
  SkeletonMetricCard,
  SkeletonChartFrame,
  SkeletonTableRows,
} from '@/components/ui/SkeletonBlock';

import { formatNumber, formatMs } from '@/lib/utils';
import { AXIS_TICK_STYLE } from '@/lib/theme';
import type { ActivityEvent, TimelinePoint } from '@/types/analytics.types';
import type { AnalyticsSource, DashboardChartWindow } from '@/types/analytics.contract';
import { safePct } from '@/services/analytics.selectors';
import { useAppSettingsStore } from '@/store/appSettingsStore';
import { useInitialQueryHydration } from '@/hooks/queryPolicy';
import { useRealtimeMinuteClock } from '@/hooks/useRealtimeClock';

// ─── Types ─────────────────────────────────────────────────────────────────────
type TrafficMode = 'live' | 'today';

const TRAFFIC_MODES: Array<{ label: string; value: TrafficMode; desc: string }> = [
  { label: 'Live',  value: 'live',  desc: 'Rolling last 15 mins · realtime updates' },
  { label: 'Today', value: 'today', desc: 'Since 00:00 IST · hourly aggregation'    },
];

function windowForMode(mode: TrafficMode): DashboardChartWindow {
  return mode === 'live' ? 15 : 1440;
}

// ─── IST helpers ───────────────────────────────────────────────────────────────
function hourToAmPm(h: number): string {
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

// ─── Time bucket builder ───────────────────────────────────────────────────────
function minuteLabel(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildEmptyTimeline(mode: TrafficMode, currentMinute: number, currentHour: number): TimelinePoint[] {
  if (mode === 'live') {
    return Array.from({ length: 15 }, (_, i) => {
      return { label: minuteLabel(currentMinute - (14 - i)), allowed: 0, blocked: 0, total: 0 };
    });
  }

  return Array.from({ length: currentHour + 1 }, (_, h) => ({
    label: `${String(h).padStart(2, '0')}:00`,
    allowed: 0,
    blocked: 0,
    total: 0,
  }));
}

function buildEmptySourceTimeline() {
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return {
      time: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }),
      quby: 0,
      simulator: 0,
    };
  });
}

// ─── Empty chart overlay ───────────────────────────────────────────────────────
function EmptyChartOverlay() {
  return (
    <div style={{ marginTop: -150, textAlign: 'center', color: '#64748b', fontSize: 12, pointerEvents: 'none' }}>
      <div style={{ fontWeight: 800 }}>No traffic recorded for selected window.</div>
      <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>Run simulator or wait for live requests.</div>
    </div>
  );
}

// ─── Segmented control ─────────────────────────────────────────────────────────
function Segmented<T extends string | number>({ options, value, onChange }: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
      {options.map((option) => (
        <button
          key={`${option.label}-${String(option.value)}`}
          onClick={() => onChange(option.value)}
          style={{
            padding: '5px 12px', border: 'none', cursor: 'pointer',
            fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 500,
            background: value === option.value ? 'rgba(59,130,246,0.20)' : 'transparent',
            color:      value === option.value ? '#3b82f6' : '#475569',
            transition: 'all 0.15s',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function methodVariant(m: string): 'get' | 'post' | 'put' | 'delete' | 'patch' {
  switch (m.toLowerCase()) {
    case 'get':    return 'get';
    case 'post':   return 'post';
    case 'put':    return 'put';
    case 'delete': return 'delete';
    default:       return 'patch';
  }
}

// ─── Bucket click modal ────────────────────────────────────────────────────────
interface BucketDetail { label: string; total: number; allowed: number; blocked: number; }

function BucketModal({ bucket, onClose }: { bucket: BucketDetail; onClose: () => void }) {
  const isEmpty = bucket.total === 0;
  return (
    <CenteredModal title={`Traffic Bucket: ${bucket.label}`} subtitle="Aggregated request counts for this time interval" onClose={onClose} maxWidth={480}>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>No requests recorded during this interval.</div>
            <div style={{ fontSize: 11 }}>Run the simulator or wait for live traffic.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total Requests',   value: bucket.total,   color: '#3b82f6' },
              { label: 'Allowed Requests', value: bucket.allowed, color: '#10b981' },
              { label: 'Blocked Requests', value: bucket.blocked, color: '#ef4444' },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${m.color}30`, borderRadius: 8, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ color: m.color, fontSize: 24, fontWeight: 850, lineHeight: 1 }}>{formatNumber(m.value)}</div>
                <div style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}
        {!isEmpty && (
          <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#64748b' }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>Block rate: </span>
            <span style={{ color: '#f1f5f9' }}>{bucket.total > 0 ? ((bucket.blocked / bucket.total) * 100).toFixed(1) : '0.0'}%</span>
            <span style={{ color: '#475569' }}> (Blocked ÷ Total Requests)</span>
          </div>
        )}
      </div>
    </CenteredModal>
  );
}

// ─── Activity table ────────────────────────────────────────────────────────────
function ActivityGrid({ events }: { events: ActivityEvent[] }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 76px 1.1fr 120px 90px 96px 100px 128px', padding: '8px 18px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 10 }}>
        {['USER', 'METHOD', 'ENDPOINT', 'LIMITER', 'SOURCE', 'DECISION', 'RESP TIME', 'TIMESTAMP (IST)'].map((h) => (
          <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#334155', textAlign: 'left' }}>{h}</span>
        ))}
      </div>
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {events.map((ev, i) => (
          <motion.div
            key={ev.id}
            initial={i === 0 ? { opacity: 0, x: -8 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'grid', gridTemplateColumns: '1.4fr 76px 1.1fr 120px 90px 96px 100px 128px', gap: 10, padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: `2px solid ${ev.allowed ? '#10b981' : '#ef4444'}`, alignItems: 'center' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, textAlign: 'left' }}>
              <UserAvatar userId={ev.userId} userName={ev.userName} avatarUrl={ev.avatarUrl} size={26} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(ev.userId, ev.userName)}</div>
                <div style={{ fontSize: 9, color: '#475569', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.userId}</div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}><AnimatedBadge variant={methodVariant(ev.method)} /></div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{ev.endpoint}</div>
            <div style={{ fontSize: 10, color: '#8b5cf6', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{ev.limiterName || 'No Limiter'}</div>
            <div style={{ textAlign: 'center' }}><AnimatedBadge variant={ev.source === 'simulator' ? 'simulator' : 'quby'} /></div>
            <div style={{ textAlign: 'center' }}><AnimatedBadge variant={ev.allowed ? 'allowed' : 'blocked'} label={ev.allowed ? 'Allowed' : 'Blocked'} /></div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }}>{ev.responseMs ? `${ev.responseMs}ms` : '0ms'}</div>
            <div style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }}>{istHHMMSS(ev.timestamp)}</div>
          </motion.div>
        ))}
        {events.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#475569', fontSize: 12 }}>No activity yet</div>
        )}
      </div>
    </>
  );
}

// ─── Timeline chart ────────────────────────────────────────────────────────────
function TimelineChart({ data, mode, onBucketClick }: {
  data: TimelinePoint[];
  mode: TrafficMode;
  onBucketClick: (bucket: BucketDetail) => void;
}) {
  const xTickFormatter = mode === 'today'
    ? (label: string) => hourToAmPm(parseInt(label.split(':')[0], 10))
    : undefined;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
        onClick={(chartData) => {
          if (chartData?.activePayload && chartData.activeLabel) {
            const point = data.find(d => d.label === chartData.activeLabel);
            if (point) onBucketClick({ label: point.label, total: point.total, allowed: point.allowed, blocked: point.blocked });
          }
        }}
        style={{ cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id="gAllow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} /></linearGradient>
          <linearGradient id="gBlock" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} /></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="label" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={xTickFormatter} />
        <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
        <Tooltip
          content={<DarkTooltip metaHints={{ allowed: 'Requests successfully processed', blocked: 'Requests denied by limiter rules', total: 'Allowed + Blocked combined' }} />}
          wrapperStyle={{ background: 'transparent', boxShadow: 'none' }}
          contentStyle={{ background: 'transparent' }}
          cursor={{ stroke: 'rgba(6,182,212,0.18)', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area type="monotone" dataKey="allowed" stroke="#06b6d4" fill="url(#gAllow)" strokeWidth={2}   dot={false} name="Allowed Requests" />
        <Area type="monotone" dataKey="blocked" stroke="#ef4444" fill="url(#gBlock)" strokeWidth={1.5} dot={false} name="Blocked Requests" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [trafficMode, setTrafficMode] = useState<TrafficMode>('live');
  const [source, setSource]           = useState<AnalyticsSource>('all');
  const [modal, setModal]             = useState<'activity' | 'endpoints' | null>(null);
  const [bucketModal, setBucketModal] = useState<BucketDetail | null>(null);
  const { liveFeedLimit }             = useAppSettingsStore();

  // ── Cache cleanup ──────────────────────────────────────────────────────────

  // ── Minute ticker (keeps x-axis in sync with IST clock) ───────────────────
  const { currentMinute, currentHour } = useRealtimeMinuteClock();

  // ── Data fetching — all parallel ───────────────────────────────────────────
  const overviewQuery = useDashboardOverview();
  const timelineQuery = useDashboardTimeline(windowForMode(trafficMode));
  const endpointsQuery = useDashboardEndpointChart();
  const sourceQuery = useDashboardSourceChart(7, source);
  const activityQuery = useDashboardActivity(12);
  const allActivityQuery = useDashboardActivity(Math.min(liveFeedLimit, 300));
  const sysQuery = useDashboardSystemOverview();

  const overviewLoading = useInitialQueryHydration([overviewQuery], []);
  const timelineLoading = useInitialQueryHydration([timelineQuery], [trafficMode]);
  const endpointsLoading = useInitialQueryHydration([endpointsQuery], []);
  const sourceLoading = useInitialQueryHydration([sourceQuery], [source]);
  const activityLoading = useInitialQueryHydration([activityQuery], []);
  const sysLoading = useInitialQueryHydration([sysQuery], []);

  const overview = overviewLoading ? undefined : overviewQuery.data;
  const timeline = timelineLoading ? [] : timelineQuery.data ?? [];
  const endpoints = endpointsLoading ? [] : endpointsQuery.data ?? [];
  const sourceChart = sourceLoading ? [] : sourceQuery.data ?? [];
  const activity = activityLoading ? [] : activityQuery.data ?? [];
  const allActivity = allActivityQuery.data ?? [];
  const sysOverview = sysLoading ? undefined : sysQuery.data;

  useEffect(() => {
    setBucketModal(null);
  }, [trafficMode]);

  useEffect(() => {
    setModal(null);
  }, [source]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const allowed    = overview?.allowedCount ?? 0;
  const blocked    = overview?.blockedCount ?? 0;
  const total      = overview?.totalRequests ?? allowed + blocked;
  const allowedPct = safePct(allowed, total);
  const blockedPct = safePct(blocked, total);
  const hasTraffic = total > 0;

  const ratioData = hasTraffic
    ? [
        { name: 'Allowed Requests', value: allowed, color: '#10b981' },
        { name: 'Blocked Requests', value: blocked, color: '#ef4444' },
      ]
    : [{ name: 'No traffic', value: 1, color: 'rgba(255,255,255,0.06)' }];

  const allEndpoints = useMemo(
    () => Array.from({ length: 6 }, (_, i) => endpoints[i] ?? null),
    [endpoints],
  );
  const maxEndpoint = Math.max(...allEndpoints.map(ep => ep?.value ?? 0), 1);

  const systemStatus = sysOverview ?? {
    redisStatus:    'unknown' as const,
    apiServerStatus:'unknown' as const,
    databaseStatus: 'unknown' as const,
    totalLimiterHits: 0,
    avgResponseMs:    0,
    activeEndpoints:  0,
  };

  const timelineHasTraffic = timeline.some(p => p.total > 0);
  const sourceHasTraffic   = sourceChart.some(p => p.quby + p.simulator > 0);

  // Guard on timelineLoading prevents empty-chart → repopulate flicker.
  // The useMemo also re-runs when the IST minute ticks over.
  const timelineData = useMemo((): TimelinePoint[] => {
    if (timelineLoading) return [];
    const empty = buildEmptyTimeline(trafficMode, currentMinute, currentHour);
    if (!timelineHasTraffic) return empty;
    const map = new Map(timeline.map(p => [p.label, p]));
    return empty.map(slot => map.get(slot.label) ?? slot);
  }, [timeline, trafficMode, timelineHasTraffic, currentMinute, currentHour, timelineLoading]);

  const sourceData = sourceHasTraffic ? sourceChart : buildEmptySourceTimeline();
  const modeDesc   = TRAFFIC_MODES.find(m => m.value === trafficMode)?.desc ?? '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>

      {/* ── Metric cards ───────────────────────────────────────────────────── */}
      <div className="dashboard-metric-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {overviewLoading ? (
          Array.from({ length: 4 }, (_, i) => <SkeletonMetricCard key={i} />)
        ) : (
          <>
            <MetricCard label="Total Requests"   value={total}                    subtitle="15m live window"                    icon={<Activity     size={15} color="#3b82f6" />} accent="#3b82f6" gradient="linear-gradient(135deg,#3b82f6,#06b6d4)" sparkData={[]} delay={0}    />
            <MetricCard label="Allowed Requests" value={allowed}                  subtitle="Requests successfully processed"    icon={<Shield       size={15} color="#10b981" />} accent="#10b981" gradient="linear-gradient(135deg,#10b981,#059669)" sparkData={[]} delay={0.08} />
            <MetricCard label="Blocked Requests" value={blocked}                  subtitle="Requests denied by limiter rules"   icon={<AlertOctagon size={15} color="#ef4444" />} accent="#ef4444" gradient="linear-gradient(135deg,#ef4444,#dc2626)" sparkData={[]} delay={0.16} />
            <MetricCard label="Active Users"     value={overview?.activeUsers ?? 0} subtitle="15m live window"                  icon={<Users        size={15} color="#a855f7" />} accent="#a855f7" gradient="linear-gradient(135deg,#a855f7,#8b5cf6)" sparkData={[]} delay={0.24} />
          </>
        )}
      </div>

      {/* ── Timeline + Pie ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <ChartContainer
          title="Requests Over Time"
          subtitle={`${modeDesc} · Click any bucket to inspect · X-axis: IST time · Y-axis: request count`}
          height={260}
          action={
            <Segmented
              options={TRAFFIC_MODES.map(m => ({ label: m.label, value: m.value }))}
              value={trafficMode}
              onChange={setTrafficMode}
            />
          }
        >
          {timelineLoading ? (
            <SkeletonChartFrame height={260} />
          ) : (
            <>
              <TimelineChart data={timelineData} mode={trafficMode} onBucketClick={setBucketModal} />
              {!timelineHasTraffic && <EmptyChartOverlay />}
            </>
          )}
        </ChartContainer>

        <ChartContainer
          title="Allow vs Block Ratio"
          subtitle={`Allowed ÷ Total and Blocked ÷ Total · 15m live window · ${formatNumber(total)} total requests`}
          height={260}
        >
          {overviewLoading ? (
            <SkeletonChartFrame height={200} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={ratioData} cx="50%" cy="50%" innerRadius={52} outerRadius={72} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0} paddingAngle={hasTraffic ? 2 : 0}>
                      {ratioData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} style={{ filter: hasTraffic ? `drop-shadow(0 0 8px ${entry.color}80)` : undefined }} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: hasTraffic ? 22 : 12, fontWeight: 800, color: hasTraffic ? '#f1f5f9' : '#64748b' }}>
                    {hasTraffic ? `${allowedPct.toFixed(1)}%` : 'No traffic'}
                  </div>
                  {hasTraffic && <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Allowed</div>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {[
                  { name: 'Allowed Requests', color: '#10b981', pct: allowedPct, count: allowed },
                  { name: 'Blocked Requests', color: '#ef4444', pct: blockedPct, count: blocked },
                ].map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: d.color }}>{d.pct.toFixed(1)}%</span>
                      <div style={{ fontSize: 9, color: '#475569' }}>{formatNumber(d.count)} reqs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartContainer>
      </div>

      {/* ── Top Endpoints + Source chart ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartContainer
          title="Top Endpoints"
          subtitle="Global historical analytics · Sorted by total request count (descending)"
          action={<button onClick={() => setModal('endpoints')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>View All</button>}
        >
          {endpointsLoading ? (
            <SkeletonTableRows rows={6} height={36} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allEndpoints.map((ep, i) => {
                const pct = ep ? (ep.value / maxEndpoint) * 100 : 0;
                return (
                  <div key={ep?.endpoint ?? `placeholder-${i}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: ep ? '#94a3b8' : '#334155', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{ep?.name ?? 'No endpoint data'}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: ep ? '#f1f5f9' : '#334155', flexShrink: 0 }}>{ep ? formatNumber(ep.value) : '-'}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                        style={{ height: '100%', background: ep?.color ?? 'rgba(255,255,255,0.08)', borderRadius: 3, boxShadow: ep ? `0 0 8px ${ep.color}60` : undefined }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartContainer>

        <ChartContainer
          title="Request Sources"
          subtitle="Historical source breakdown · X-axis: IST date · Y-axis: request count"
          height={220}
          action={<Segmented options={[{ label: 'All', value: 'all' }, { label: 'Quby', value: 'quby' }, { label: 'Simulator', value: 'simulator' }]} value={source} onChange={setSource} />}
        >
          {sourceLoading ? (
            <SkeletonChartFrame height={220} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sourceData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gQuby" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.50} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="gSim"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.40} /><stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} interval={0} minTickGap={8} />
                  <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={<DarkTooltip metaHints={{ quby: 'Requests from the Quby production source', simulator: 'Requests fired by the built-in simulator' }} />}
                    wrapperStyle={{ background: 'transparent', boxShadow: 'none' }}
                    contentStyle={{ background: 'transparent' }}
                  />
                  {(source === 'all' || source === 'quby')      && <Area type="monotone" dataKey="quby"      name="Quby"      stroke="#06b6d4" fill="url(#gQuby)" strokeWidth={2}   dot={false} stackId="1" />}
                  {(source === 'all' || source === 'simulator') && <Area type="monotone" dataKey="simulator" name="Simulator" stroke="#a855f7" fill="url(#gSim)"  strokeWidth={1.5} dot={false} stackId="1" />}
                </AreaChart>
              </ResponsiveContainer>
              {!sourceHasTraffic && <EmptyChartOverlay />}
            </>
          )}
        </ChartContainer>
      </div>

      {/* ── Recent activity ─────────────────────────────────────────────────── */}
      <GlassCard padding="0">
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Recent Activity</div>
            <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>Live request log · sorted newest first</div>
          </div>
          <MoreHorizontal size={16} color="#475569" />
        </div>
        {activityLoading ? (
          <SkeletonTableRows rows={8} height={42} />
        ) : (
          <ActivityGrid events={activity} />
        )}
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => setModal('activity')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Inter',sans-serif" }}>
            View All Activity <ArrowRight size={13} />
          </button>
        </div>
      </GlassCard>

      {/* ── System overview ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {sysLoading ? (
          <>
            <GlassCard accent="#10b981" glowColor="rgba(16,185,129,0.12)">
              <SkeletonTableRows rows={4} height={36} />
            </GlassCard>
            <GlassCard>
              <SkeletonTableRows rows={3} height={36} />
            </GlassCard>
          </>
        ) : (
          <>
            <GlassCard accent="#10b981" glowColor="rgba(16,185,129,0.12)">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>System Overview</span>
                <Database size={14} color="#10b981" />
              </div>
              {[
                { label: 'Redis Status',       value: <AnimatedBadge variant={systemStatus.redisStatus} /> },
                { label: 'Avg Response Time',  value: formatMs(systemStatus.avgResponseMs) },
                { label: 'Active Endpoints',   value: String(systemStatus.activeEndpoints) },
                { label: 'Limiter Hits',       value: formatNumber(systemStatus.totalLimiterHits) },
              ].map((m) => (
                <div key={m.label} style={{ padding: '9px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{m.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{m.value}</span>
                </div>
              ))}
            </GlassCard>

            <GlassCard>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>System Status</div>
              {[
                { label: 'API Server', value: systemStatus.apiServerStatus },
                { label: 'Redis',      value: systemStatus.redisStatus      },
                { label: 'Database',   value: systemStatus.databaseStatus   },
              ].map((s) => (
                <div key={s.label} style={{ padding: '9px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{s.label}</span>
                  <AnimatedBadge variant={s.value} label={s.value === 'unknown' ? 'Unavailable' : undefined} />
                </div>
              ))}
            </GlassCard>
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === 'activity' && (
          <CenteredModal title="View All Activity" subtitle="Latest request decisions — allowed and blocked" onClose={() => setModal(null)} maxWidth={1100}>
            <div style={{ padding: 18 }}><ActivityGrid events={allActivity} /></div>
          </CenteredModal>
        )}
        {modal === 'endpoints' && (
          <CenteredModal title="Full Endpoint Ranking" subtitle="Global historical request count" onClose={() => setModal(null)} maxWidth={860}>
            <div style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 120px', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 6 }}>
                {['#', 'ENDPOINT', 'REQUESTS'].map((h) => <span key={h} style={{ fontSize: 9, fontWeight: 700, color: '#334155', letterSpacing: '0.09em' }}>{h}</span>)}
              </div>
              {endpoints.map((ep, i) => (
                <div key={ep.endpoint} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 120px', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace" }}>{ep.endpoint}</span>
                  <span style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 700 }}>{formatNumber(ep.value)}</span>
                </div>
              ))}
            </div>
          </CenteredModal>
        )}
        {bucketModal && <BucketModal bucket={bucketModal} onClose={() => setBucketModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
