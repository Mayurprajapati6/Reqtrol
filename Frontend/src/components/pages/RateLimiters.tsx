import { memo, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChevronDown,
  Clock3,
  Gauge,
  Infinity as InfinityIcon,
  Info,
  Radio,
  ShieldCheck,
} from 'lucide-react';

import { useLimiterCards } from '@/hooks/useLimiters';
import { fetchLiveFeed, type LiveEvent } from '@/api/client';
import { SkeletonChartFrame, SkeletonTableRows } from '@/components/ui/SkeletonBlock';
import { useInitialQueryHydration } from '@/hooks/queryPolicy';
import type { LimiterCard } from '@/types/analytics.types';
import { AXIS_TICK_STYLE, COLORS } from '@/lib/theme';
import { useRealtimeClock } from '@/hooks/useRealtimeClock';

// ─── Types ────────────────────────────────────────────────────────────────────
type LimiterState = 'HEALTHY' | 'WARNING' | 'BLOCKING' | 'BYPASSED';
type Risk = 'Low' | 'Medium' | 'High' | 'Very High';
type ChartPoint = { second: number; total: number } & Record<string, number>;

const CARD_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isWebhook(card: LimiterCard) {
  return card.endpoint === '/payment/webhook' || card.name === 'No Limiter';
}

function usagePct(card: LimiterCard) {
  if (isWebhook(card) || card.total <= 0) return 0;
  return Math.min(100, Math.round((card.used / card.total) * 1000) / 10);
}

function limiterState(card: LimiterCard): LimiterState {
  if (isWebhook(card)) return 'BYPASSED';
  const pct = usagePct(card);
  if (pct >= 90) return 'BLOCKING';
  if (pct >= 70) return 'WARNING';
  return 'HEALTHY';
}

function stateColor(state: LimiterState) {
  if (state === 'BLOCKING') return COLORS.red;
  if (state === 'WARNING')  return COLORS.amber;
  if (state === 'BYPASSED') return COLORS.blue;
  return COLORS.emerald;
}

function stateGlow(state: LimiterState) {
  const color = stateColor(state);
  const pulse = state === 'BLOCKING' ? `, 0 0 34px ${color}44` : '';
  return `0 0 0 1px ${color}2b, 0 18px 50px rgba(0,0,0,0.32), 0 0 28px ${color}22${pulse}`;
}

function endpointKey(endpoint: string) {
  return endpoint.replace(/[^a-zA-Z0-9]/g, '_');
}

function riskFor(card: LimiterCard): Risk {
  const pct = usagePct(card);
  const rps = card.reqSec;
  if (pct >= 90 || rps >= 8) return 'Very High';
  if (pct >= 80 || rps >= 5) return 'High';
  if (pct >= 65 || rps >= 2) return 'Medium';
  return 'Low';
}

function riskColor(risk: Risk) {
  if (risk === 'Very High') return COLORS.red;
  if (risk === 'High')      return '#fb7185';
  if (risk === 'Medium')    return COLORS.amber;
  return COLORS.emerald;
}

function normalizeEventEndpoint(endpoint?: string) {
  if (!endpoint) return '';
  const clean = endpoint.split('?')[0].replace(/\/+$/, '') || '/';
  const aliases: Record<string, string> = {
    '/order':    '/payment/order',
    '/login':    '/auth/login',
    '/booking':  '/booking/create',
    '/booking/': '/booking/create',
    '/':         '/booking/create',
    '/register': '/auth/register',
    '/verify':   '/payment/verify',
    '/webhook':  '/payment/webhook',
  };
  return aliases[clean] ?? clean;
}

/** Format unix-ms as IST HH:MM:SS */
function fmtIST(ms: number) {
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Kolkata',
  });
}

/** Format unix-ms as IST HH:MM:SS (for bucket boundaries) */
function fmtBucketBoundary(ms: number) {
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Kolkata',
  });
}

/**
 * Clock-aligned countdown — the single source of truth for all cards.
 * Formula: 60 − currentSecond. Min 1 so we never display "0s".
 */
function clockCountdown(currentSecond: number): number {
  return Math.max(1, 60 - currentSecond);
}

// ─── Live events hook ─────────────────────────────────────────────────────────
function useRecentLimiterEvents() {
  return useQuery({
    queryKey: ['rate-limiter-analytics', 'live-events', 'all'],
    queryFn: () => fetchLiveFeed(200, 'all'),
    staleTime: 5_000,
    refetchInterval: 10_000,
    placeholderData: (previous) => previous,
    retry: 1,
  });
}

// ─── Timeline chart data (pure function) ─────────────────────────────────────
// 60 slots indexed 0→59 (seconds within current clock-minute).
// Each slot: { second, [endpointKey]: reqCount, total }.
// Resets automatically when minuteStart changes (top-of-minute rollover).
function buildTimelineData(
  events: LiveEvent[],
  realCards: LimiterCard[],
  minuteStart: number,
): ChartPoint[] {
  // Pre-allocate 60 zero-filled slots
  const slots: ChartPoint[] = Array.from({ length: 60 }, (_, s) => {
    const pt: ChartPoint = { second: s, total: 0 };
    for (const card of realCards) pt[endpointKey(card.endpoint)] = 0;
    return pt;
  });

  for (const event of events) {
    const eventMs = new Date(event.timestamp).getTime();
    const s = Math.floor((eventMs - minuteStart) / 1000);
    if (s < 0 || s > 59) continue; // outside current minute — skip
    const ep   = normalizeEventEndpoint(event.endpoint);
    const card = realCards.find((c) => c.endpoint === ep);
    if (!card) continue;
    const key = endpointKey(card.endpoint);
    (slots[s] as Record<string, number>)[key] = ((slots[s] as Record<string, number>)[key] ?? 0) + 1;
    slots[s].total += 1;
  }

  return slots;
}

// ─── SectionShell ─────────────────────────────────────────────────────────────
function SectionShell({ index, title, subtitle, children, action }: {
  index: number; title: string; subtitle: string;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section style={{
      background: 'linear-gradient(180deg, rgba(8,13,26,0.96), rgba(5,8,22,0.92))',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 18px 60px rgba(0,0,0,0.24)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 23, height: 23, borderRadius: '50%',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'grid', placeItems: 'center',
            color: '#fff', fontSize: 11, fontWeight: 900,
            boxShadow: '0 0 18px rgba(59,130,246,0.35)', flexShrink: 0,
          }}>{index}</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#f8fafc', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h2>
            <p style={{ margin: '2px 0 0', color: COLORS.textMuted, fontSize: 11 }}>{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── CircularUsage ────────────────────────────────────────────────────────────
function CircularUsage({ pct, color, state }: { pct: number; color: string; state: LimiterState }) {
  const radius        = 58;
  const circumference = 2 * Math.PI * radius;
  const clampedPct    = Math.min(100, Math.max(0, pct));
  const offset        = circumference - (clampedPct / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 160, aspectRatio: '1 / 1', margin: '8px auto 10px' }}>
      <svg viewBox="0 0 160 160" width="100%" height="100%" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx="80" cy="80" r={radius} stroke="rgba(148,163,184,0.13)" strokeWidth="12" fill="none" />
        <motion.circle
          cx="80" cy="80" r={radius}
          stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      {state === 'BYPASSED' ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color }}>
          <InfinityIcon size={42} strokeWidth={2.3} />
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 26, lineHeight: 1, fontWeight: 950, color: '#f8fafc' }}>{Math.round(clampedPct)}%</div>
            <div style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: 800, marginTop: 4, letterSpacing: '0.1em' }}>USED</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color, fontSize: 12, fontWeight: 850, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

// ─── LimiterPressureCard ──────────────────────────────────────────────────────
const LimiterPressureCard = memo(function LimiterPressureCard({
  card, currentSecond, bucketLabel,
}: {
  card: LimiterCard;
  currentSecond: number;
  bucketLabel: string;
}) {
  const state     = limiterState(card);
  const color     = stateColor(state);
  const pct       = usagePct(card);
  const burst     = !isWebhook(card) && card.total >= 5;
  // All time values derived from server clock — never from resetAt
  const countdown = clockCountdown(currentSecond);
  const webhook   = isWebhook(card);

  return (
    <motion.article
      layout
      animate={{ boxShadow: stateGlow(state), borderColor: `${color}55` }}
      transition={{ duration: 0.35 }}
      className={state === 'BLOCKING' ? 'rl-blocking-card' : undefined}
      style={{
        border: `1px solid ${color}33`, borderRadius: 8,
        background: `linear-gradient(180deg, ${color}0e, rgba(5,8,22,0.86) 34%, rgba(5,8,22,0.94))`,
        padding: 14, position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Radial glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 0%, ${color}18, transparent 56%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.endpoint}</div>
            <div style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
          </div>
          <span style={{ color, border: `1px solid ${color}44`, background: `${color}18`, borderRadius: 18, padding: '3px 7px', fontSize: 8, fontWeight: 950, letterSpacing: '0.07em', flexShrink: 0 }}>
            {state}
          </span>
        </div>

        {/* Circular gauge */}
        <CircularUsage pct={pct} color={color} state={state} />

        {/* Used / limit display */}
        {webhook ? (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: 16 }}>No Limiter</div>
            <div style={{ color: COLORS.textMuted, fontSize: 10, marginTop: 3 }}>Requests bypass Redis buckets</div>
          </div>
        ) : (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ color, fontWeight: 950, fontSize: 20 }}>{card.used}</span>
              <span style={{ color: COLORS.textSecondary, fontWeight: 800, fontSize: 14 }}>/ {card.total}</span>
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: 10 }}>used / limit</div>
          </div>
        )}

        {/* Bucket window label */}
        {!webhook && (
          <div style={{
            margin: '8px 0 10px',
            background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6, padding: '5px 9px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Clock3 size={10} color={COLORS.cyan} />
            <span style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Window</span>
            <span style={{ color: COLORS.cyan, fontSize: 10, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bucketLabel}
            </span>
          </div>
        )}

        {/* 8 audited metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 10px' }}>
          <Metric
            label="Used / Limit"
            value={webhook ? '—' : `${card.used} / ${card.total}`}
            color={card.used > 0 ? color : COLORS.textSecondary}
          />
          <Metric
            label="Remaining"
            value={webhook ? '∞' : String(card.remaining)}
            color={webhook ? COLORS.blue : card.remaining > 0 ? COLORS.emerald : COLORS.red}
          />
          
          <Metric
            label="Req / Min"
            value={webhook ? '—' : String(card.reqMin)}
            color={card.reqMin > 0 ? color : COLORS.textSecondary}
          />
          <Metric
            label="Resets In"
            value={webhook ? '—' : `${countdown}s`}
            color={countdown <= 10 ? COLORS.amber : COLORS.textSecondary}
          />
          
          <Metric
            label="Burst"
            value={webhook ? 'Bypassed' : burst ? `Enabled (${card.total})` : 'Off'}
            color={burst ? COLORS.cyan : COLORS.textMuted}
          />
          <Metric
            label="Algorithm"
            value={webhook ? 'Bypassed' : card.algorithm}
            color={COLORS.textMuted}
          />
        </div>
      </div>
    </motion.article>
  );
});

// ─── Chart tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label, realCards, minuteStart,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  realCards: LimiterCard[];
  minuteStart: number;
}) {
  if (!active || !payload?.length || label == null) return null;
  
  // label is the second (0-59), minuteStart is the minute boundary in ms
  const secondInMs = (label as number) * 1000;
  const slotTimestamp = minuteStart + secondInMs;
  const now = Date.now();
  
  // Don't show tooltip for future seconds that haven't occurred yet
  if (slotTimestamp > now) return null;
  
  const timestamp = fmtIST(slotTimestamp);
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  
  // Extract just HH:MM:SS for cleaner display
  const timeOnly = timestamp; // Already formatted as HH:MM:SS by fmtIST
  
  return (
    <div style={{
      background: 'rgba(5,8,22,0.97)', border: '1px solid rgba(6,182,212,0.35)',
      borderRadius: 9, padding: '10px 13px', minWidth: 160,
      boxShadow: '0 18px 50px rgba(0,0,0,0.65), 0 0 24px rgba(6,182,212,0.12)',
      backdropFilter: 'blur(18px)',
    }}>
      <div style={{ color: COLORS.cyan, fontWeight: 800, fontSize: 11, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
        {timeOnly}
      </div>
      {payload.filter((p) => (p.value ?? 0) > 0).map((item) => (
        <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
          <span style={{ color: item.color, fontSize: 11, fontWeight: 600 }}>{item.name}</span>
          <span style={{ color: '#f8fafc', fontSize: 11, fontWeight: 800 }}>{item.value} req</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 7, paddingTop: 7, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: COLORS.textMuted, fontSize: 10 }}>Total</span>
        <span style={{ color: '#f8fafc', fontSize: 11, fontWeight: 900 }}>{total} req</span>
      </div>
    </div>
  );
}

// ─── ResetQueue ───────────────────────────────────────────────────────────────
function ResetQueue({ cards, currentSecond }: { cards: LimiterCard[]; currentSecond: number }) {
  const countdown = clockCountdown(currentSecond);
  const rows = useMemo(() =>
    cards
      .filter((c) => !isWebhook(c))
      .map((card) => ({ card, pct: usagePct(card), risk: riskFor(card) }))
      .sort((a, b) => b.pct - a.pct),
    [cards],
  );

  return (
    <div style={{ padding: '10px 14px 16px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
        <thead>
          <tr>
            {['Limiter', 'Endpoint', 'Used / Limit', 'Resets In', 'Req / Min', 'Next Block Risk'].map((h, i) => (
              <th key={h} style={{ padding: '9px 12px', fontWeight: 850, borderBottom: '1px solid rgba(255,255,255,0.07)', color: COLORS.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i < 2 ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ card, pct, risk }) => {
            const color = stateColor(limiterState(card));
            return (
              <tr key={card.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '11px 12px', color: '#f8fafc', fontSize: 12, fontWeight: 800, textAlign: 'left' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, marginRight: 8 }} />
                  {card.name}
                </td>
                <td style={{ padding: '11px 12px', color: COLORS.textSecondary, fontSize: 12, textAlign: 'left' }}>{card.endpoint}</td>
                <td style={{ padding: '11px 12px', color: COLORS.textSecondary, fontSize: 12, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                    <span style={{ minWidth: 88 }}>{card.used} / {card.total} ({Math.round(pct)}%)</span>
                    <div style={{ height: 5, width: 100, background: 'rgba(148,163,184,0.14)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}`, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                </td>
                <td style={{ padding: '11px 12px', color, fontWeight: 900, fontSize: 12, textAlign: 'right' }}>{countdown}s</td>
              
                <td style={{ padding: '11px 12px', color: card.reqMin > 0 ? color : COLORS.textMuted, fontWeight: 800, fontSize: 12, textAlign: 'right' }}>{card.reqMin}</td>
                <td style={{ padding: '11px 12px', color: riskColor(risk), fontWeight: 900, fontSize: 12, textAlign: 'right' }}>{risk}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, color: COLORS.textMuted, fontSize: 11 }}>
        <Info size={13} color={COLORS.blue} />
        Next block risk is calculated from live bucket saturation and rolling req/sec.
      </div>
    </div>
  );
}

// ─── ConfigInspector ──────────────────────────────────────────────────────────
function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'rgba(15,23,42,0.52)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '9px 10px', minWidth: 0 }}>
      <div style={{ color: COLORS.textFaint, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 750, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function ConfigInspector({ cards }: { cards: LimiterCard[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {cards.map((card) => {
        const expanded = open[card.id] ?? false;
        const color    = stateColor(limiterState(card));
        const webhook  = isWebhook(card);
        const redisKey = webhook ? 'bypass:/payment/webhook' : `rt:${card.algorithm === 'Sliding Window' ? 'sw' : 'fw'}:global:${card.endpoint}`;
        return (
          <div key={card.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(5,8,22,0.58)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setOpen((cur) => ({ ...cur, [card.id]: !expanded }))}
              style={{ width: '100%', minHeight: 48, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: '10px 14px', display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) minmax(130px,1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <ShieldCheck size={16} color={color} />
                <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
              </div>
              <div style={{ color: COLORS.textSecondary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.endpoint}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'end' }}>
                {[webhook ? 'Bypassed' : card.algorithm, webhook ? 'No Limiter' : card.windowLabel, webhook ? 'Webhook Bypass' : `${card.total} req`].map((pill) => (
                  <span key={pill} style={{ color: pill === 'Bypassed' ? COLORS.blue : COLORS.textSecondary, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.7)', borderRadius: 14, padding: '3px 9px', fontSize: 10 }}>{pill}</span>
                ))}
                <ChevronDown size={15} color={COLORS.textMuted} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }} />
              </div>
            </button>
            {expanded && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10, padding: '0 14px 14px' }}>
                <ConfigItem label="Algorithm"       value={webhook ? 'Bypassed' : card.algorithm} />
                <ConfigItem label="Window"          value={webhook ? 'N/A' : card.windowLabel} />
                <ConfigItem label="Max Requests"    value={webhook ? 'Unlimited' : String(card.total)} />
                <ConfigItem label="Burst"           value={webhook ? 'Bypassed' : card.total >= 5 ? `Enabled (${card.total})` : 'Disabled'} />
                <ConfigItem label="Cooldown"        value="0s" />
                <ConfigItem label="Retry-After"     value={webhook ? 'N/A' : 'Clock-aligned TTL'} />
                <ConfigItem label="Redis Key"       value={redisKey} />
                <ConfigItem label="Webhook Bypass"  value={webhook ? 'Yes' : 'No'} />
                <ConfigItem label="Route Metadata"  value={`POST ${card.endpoint}`} />
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 28, color: COLORS.textMuted, fontSize: 11, padding: '10px 4px 0', flexWrap: 'wrap' }}>
        <span>Algorithm: Fixed / Sliding Window</span>
        <span>Store: Redis</span>
        <span>Key Prefix: rt:</span>
        <span>Bucket: Clock-aligned (top of minute)</span>
        <span>Update Interval: 1s</span>
      </div>
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
function StatusPill({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${color}33`, background: `${color}10`, color, borderRadius: 999, padding: '6px 11px', fontSize: 11, fontWeight: 800 }}>
      {icon}
      {label}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      {([['Healthy', COLORS.emerald], ['Warning', COLORS.amber], ['Blocking', COLORS.red]] as [string, string][]).map(([label, color]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: COLORS.textSecondary, fontSize: 11 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, display: 'block' }} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── SkeletonLimiterCard ──────────────────────────────────────────────────────
function SkeletonLimiterCard() {
  return (
    <div style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(5,8,22,0.72)', padding: 14 }}>
      <div className="skeleton" style={{ width: '70%', height: 14, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: '42%', height: 10, marginBottom: 28 }} />
      <div className="skeleton" style={{ width: 112, height: 112, borderRadius: '50%', margin: '0 auto 22px' }} />
      <div className="skeleton" style={{ width: '46%', height: 24, marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 28, marginBottom: 10, borderRadius: 6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 30 }} />)}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RateLimiters() {
  // Single clock source — drives countdown, bucket label, and chart reset
  const { currentSecond, currentMinute, currentHour, currentTime } = useRealtimeClock();
  const now = currentTime.getTime();

  // Clock-aligned minute boundary — recomputes only when minute rolls over
  const minuteStart = useMemo(
    () => Math.floor(now / 60_000) * 60_000,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMinute, currentHour],
  );

  // Bucket label: "HH:MM:00 → HH:MM:59"
  const globalBucketLabel = useMemo(() => {
    const start = fmtBucketBoundary(minuteStart);
    const end   = fmtBucketBoundary(minuteStart + 59_000);
    return `${start} → ${end}`;
  }, [minuteStart]);

  const cardsQuery  = useLimiterCards();
  const eventsQuery = useRecentLimiterEvents();
  const cardsLoading = useInitialQueryHydration([cardsQuery], []);
  const rawCards   = cardsQuery.data ?? [];
  const liveEvents = eventsQuery.data ?? [];

  // Simple enrichment: backend is now reliable (direct Redis reads + MongoDB fallback).
  // reqMin: take max of backend value and live event count from current minute.
  // used:   take backend value when > 0; when 0 (Redis just expired for this poll),
  //         derive from live events in the current minute bucket only.
  const cards = useMemo(() => {
    const nowMs        = Date.now();
    const bucketStart  = Math.floor(nowMs / 60000) * 60000;   // clock-aligned minute start
    const bucketEnd    = bucketStart + 60000;

    // Filter events to only those within the CURRENT minute
    const recentEvents = liveEvents.filter(
      (e) => new Date(e.timestamp).getTime() >= bucketStart,
    );

    return rawCards.map((card) => {
      if (isWebhook(card)) return card;

      // Count live events for this endpoint this minute
      const eventsThisMin = recentEvents.filter(
        (e) => normalizeEventEndpoint(e.endpoint) === card.endpoint,
      ).length;

      // CRITICAL FIX: Check if backend data is from CURRENT minute bucket
      // If bucketStart/bucketEnd from backend matches current minute, trust it
      // Otherwise, backend is returning stale data from previous minute
      const backendIsCurrentMinute = 
        card.bucketStart && card.bucketEnd &&
        card.bucketStart === bucketStart && 
        card.bucketEnd === bucketEnd;

      // reqMin: best of backend + live events
      const reqMin = Math.max(card.reqMin ?? 0, eventsThisMin);

      // CRITICAL FIX: When minute changes, FORCE reset to 0 or live events count
      // Don't trust backend data from previous minute even if it's non-zero
      const used = backendIsCurrentMinute
          ? (card.used ?? 0)  // Trust backend when it's from current minute
          : eventsThisMin;     // Use live events when backend is stale

      const remaining  = Math.max(0, card.total - used);
      const saturation = card.total > 0
        ? Math.min(100, Math.round((used / card.total) * 1000) / 10)
        : 0;

      return { ...card, used, remaining, saturation, reqMin };
    });
  }, [rawCards, liveEvents]);



  const realCards = useMemo(() => cards.filter((c) => !isWebhook(c)), [cards]);

  // Timeline chart — pure rebuild every second from live events
  // Minute rollover: minuteStart changes → all slots reset to 0 automatically
  const timelineData = useMemo(
    () => buildTimelineData(liveEvents, realCards, minuteStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveEvents, realCards, minuteStart],
  );

  const hottest   = useMemo(() => [...realCards].sort((a, b) => usagePct(b) - usagePct(a))[0], [realCards]);
  const safeState = hottest ? limiterState(hottest) : 'HEALTHY';
  const countdown = clockCountdown(currentSecond);

  if (cardsQuery.isError) {
    return (
      <div style={{ padding: 20, color: COLORS.textSecondary }}>
        Could not load limiter intelligence.
        <button onClick={() => cardsQuery.refetch()} style={{ marginLeft: 12, color: COLORS.cyan, background: 'transparent', border: 'none', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .rl-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          padding: 12px;
        }
        .rl-blocking-card { animation: rl-red-pulse 1.5s ease-in-out infinite; }
        @keyframes rl-red-pulse {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-1px); }
        }
        @media (max-width: 1200px) {
          .rl-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 768px) {
          .rl-card-grid    { grid-template-columns: 1fr; }
          .rl-chart-wrap   { height: 260px !important; }
        }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.03em' }}>Rate Limiters</h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, color: COLORS.emerald, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 10, fontWeight: 900 }}>
              <span className="live-dot" /> LIVE
            </div>
          </div>
          <p style={{ color: COLORS.textSecondary, fontSize: 12, margin: '3px 0 0' }}>
            Clock-aligned Redis bucket intelligence · {globalBucketLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatusPill icon={<Radio size={13} />}  label="Redis Connected"  color={COLORS.emerald} />
          <StatusPill
            icon={<Clock3 size={13} />}
            label={`Resets in ${countdown}s`}
            color={countdown <= 10 ? COLORS.amber : COLORS.textSecondary}
          />
          <StatusPill
            icon={<Gauge size={13} />}
            label={hottest ? `Hottest: ${hottest.endpoint}` : 'Awaiting traffic'}
            color={stateColor(safeState)}
          />
        </div>
      </div>

      {/* ── Section 1: Live Limiter Pressure (3 + 3 grid) ───────────────────── */}
      <SectionShell
        index={1}
        title="Live Limiter Pressure"
        subtitle="Clock-aligned bucket usage per endpoint · 3 cards per row · resets at top of every minute"
        action={<Legend />}
      >
        {cardsLoading ? (
          <div className="rl-card-grid">
            {Array.from({ length: 6 }, (_, i) => <SkeletonLimiterCard key={i} />)}
          </div>
        ) : (
          <div className="rl-card-grid">
            {cards.map((card) => (
              <LimiterPressureCard
                key={card.id}
                card={card}
                currentSecond={currentSecond}
                bucketLabel={globalBucketLabel}
              />
            ))}
          </div>
        )}
      </SectionShell>

      {/* ── Section 2: Minute Timeline Chart ────────────────────────────────── */}
      <SectionShell
        index={2}
        title="Minute Timeline"
        subtitle="Requests per second · X: 0 → 59 seconds · Y: request count · per-endpoint series · linear · no interpolation"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <StatusPill
              icon={<Clock3 size={12} />}
              label={`s${String(currentSecond).padStart(2, '0')} / 59`}
              color={COLORS.cyan}
            />
          </div>
        }
      >
        <div className="rl-chart-wrap" style={{ height: 320, padding: '8px 14px 4px' }}>
          {cardsLoading ? <SkeletonChartFrame height={280} /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 12, right: 20, left: -4, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.09)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="second"
                  type="number"
                  domain={[0, 59]}
                  ticks={[0, 10, 20, 30, 40, 50, 59]}
                  tick={{ ...AXIS_TICK_STYLE, fill: COLORS.textMuted }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(148,163,184,0.18)' }}
                  tickFormatter={(v: number) => `${v}s`}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ ...AXIS_TICK_STYLE, fill: COLORS.textMuted }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload as Array<{ name: string; value: number; color: string }>}
                      label={props.label as number}
                      realCards={realCards}
                      minuteStart={minuteStart}
                    />
                  )}
                  wrapperStyle={{ background: 'transparent', boxShadow: 'none' }}
                  contentStyle={{ background: 'transparent' }}
                />
                {realCards.map((card, idx) => {
                  const color = CARD_COLORS[idx % CARD_COLORS.length];
                  return (
                    <Line
                      key={card.id}
                      type="linear"
                      dataKey={endpointKey(card.endpoint)}
                      name={card.endpoint}
                      stroke={color}
                      strokeWidth={2.2}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                      activeDot={{ r: 4, stroke: color, strokeWidth: 2, fill: 'rgba(5,8,22,0.9)' }}
                      style={{ filter: `drop-shadow(0 0 5px ${color}88)` }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {/* Chart legend */}
        <div style={{ display: 'flex', gap: 16, padding: '0 18px 14px', flexWrap: 'wrap' }}>
          {realCards.map((card, idx) => (
            <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 7, color: COLORS.textSecondary, fontSize: 11 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: CARD_COLORS[idx % CARD_COLORS.length], boxShadow: `0 0 8px ${CARD_COLORS[idx % CARD_COLORS.length]}`, display: 'block' }} />
              {card.endpoint}
            </div>
          ))}
        </div>
      </SectionShell>

      {/* ── Section 3: Reset Queue ───────────────────────────────────────────── */}
      <SectionShell
        index={3}
        title="Reset Queue"
        subtitle="Live bucket metrics · sorted by saturation · countdown from server clock · all values real"
      >
        {cardsLoading ? <SkeletonTableRows rows={5} /> : (
          <ResetQueue cards={cards} currentSecond={currentSecond} />
        )}
      </SectionShell>

      {/* ── Section 4: Config Inspector ──────────────────────────────────────── */}
      <SectionShell
        index={4}
        title="Limiter Config Inspector"
        subtitle="Inspect limiter rules and Redis configuration"
      >
        {cardsLoading ? <SkeletonTableRows rows={6} /> : <ConfigInspector cards={cards} />}
      </SectionShell>
    </div>
  );
}
