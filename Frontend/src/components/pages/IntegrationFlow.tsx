import { ArrowRight, CheckCircle2, Clock3, Database, Gauge, GitBranch, LayoutDashboard, Server, Shield, TimerReset, XCircle } from 'lucide-react';

import GlassCard from '@/components/ui/GlassCard';

const stages = [
  { title: 'Quby Backend', copy: 'Application route receives a request with user, endpoint, method, and source.', icon: <Server size={18} />, color: '#3b82f6' },
  { title: 'Reqtrol Middleware', copy: 'Normalizes identity and maps the endpoint to a limiter rule before the route handler runs.', icon: <Shield size={18} />, color: '#06b6d4' },
  { title: 'Redis Decision', copy: 'Reads the active time bucket, increments it, and decides allowed or blocked.', icon: <Gauge size={18} />, color: '#a855f7' },
  { title: 'Mongo Analytics', copy: 'Stores the decision, latency, limiter, endpoint, and user profile for dashboards.', icon: <Database size={18} />, color: '#10b981' },
  { title: 'Dashboard', copy: 'Turns stored events into trustworthy product analytics and operational views.', icon: <LayoutDashboard size={18} />, color: '#f59e0b' },
];

const limiterSteps = [
  ['Rule lookup', 'Endpoint selects a limiter, for example /payment/order uses paymentOrderLimiter.'],
  ['Window check', 'Redis checks the current bucket, such as 10 requests per 1 minute.'],
  ['Allow path', 'If used count is below the limit, Reqtrol increments the bucket and forwards the request.'],
  ['Block path', 'If used count reaches the limit, Reqtrol returns 429 and records the limiter that blocked it.'],
  ['Window rollover', 'When the bucket expires, the next request starts a fresh window. Longer windows keep pressure visible longer.'],
];

function BlueprintNode({ stage, index }: { stage: typeof stages[number]; index: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{
        minHeight: 132,
        width: '100%',
        borderRadius: 8,
        border: `1px solid ${stage.color}40`,
        background: `linear-gradient(145deg, ${stage.color}18, rgba(5,8,22,0.82))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 40px ${stage.color}10`,
        padding: 14,
        transform: index % 2 === 0 ? 'translateY(0)' : 'translateY(18px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: stage.color }}>
          {stage.icon}
          <span style={{ fontSize: 10, fontWeight: 900, fontFamily: "'JetBrains Mono',monospace" }}>0{index + 1}</span>
        </div>
        <div style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 900, marginTop: 16 }}>{stage.title}</div>
        <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.45, marginTop: 7 }}>{stage.copy}</div>
      </div>
      {index < stages.length - 1 && <ArrowRight size={16} color="#334155" />}
    </div>
  );
}

function DecisionCard({ allowed }: { allowed: boolean }) {
  const color = allowed ? '#10b981' : '#ef4444';
  return (
    <div style={{ border: `1px solid ${color}35`, background: `${color}0f`, borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color }}>
        {allowed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{allowed ? 'Allowed' : 'Blocked'}</span>
      </div>
      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>
        {allowed
          ? 'The active window still has capacity. Reqtrol increments Redis, lets the request continue, then records the decision.'
          : 'The active window is full. Reqtrol stops the request before the route handler and records the limiter that caused the 429.'}
      </div>
    </div>
  );
}

export default function IntegrationFlow() {
  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Integration Flow</h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>A blueprint of how requests travel through Reqtrol and how limiter decisions are made.</p>
      </div>

      <GlassCard padding="18px" accent="#06b6d4">
        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>Reqtrol System Blueprint</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`, gap: 10, minHeight: 172 }}>
          {stages.map((stage, index) => <BlueprintNode key={stage.title} stage={stage} index={index} />)}
        </div>
      </GlassCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: 14 }}>
        <GlassCard padding="0" accent="#a855f7">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Limiter Decision Model</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>How a single request becomes allowed or blocked.</div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {limiterSteps.map(([title, copy], index) => (
              <div key={title} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12, alignItems: 'start' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(168,85,247,0.14)', border: '1px solid rgba(168,85,247,0.30)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{index + 1}</div>
                <div style={{ borderBottom: index < limiterSteps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: 10 }}>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 850 }}>{title}</div>
                  <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>{copy}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GlassCard padding="16px" accent="#10b981">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#10b981', marginBottom: 12 }}>
              <TimerReset size={18} />
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Window Meaning</div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.55 }}>
              A 1m rule means Redis counts requests inside the current minute-sized bucket. When the bucket expires, usage starts again. A 5m or 15m rule keeps pressure active longer, so repeated traffic blocks for longer.
            </div>
          </GlassCard>

          <GlassCard padding="16px" accent="#f59e0b">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#f59e0b', marginBottom: 12 }}>
              <Clock3 size={18} />
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Latency Meaning</div>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.55 }}>
              Reqtrol records request latency with every decision. Allowed requests include route handling time; blocked requests should be fast because they stop at middleware after Redis decides.
            </div>
          </GlassCard>

          <GlassCard padding="16px" accent="#ef4444">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#ef4444', marginBottom: 12 }}>
              <GitBranch size={18} />
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Decision Branches</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <DecisionCard allowed />
              <DecisionCard allowed={false} />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
