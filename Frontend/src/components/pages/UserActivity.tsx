import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, ArrowRight, ChevronRight, Shield, Target, TrendingUp, Users, Zap } from 'lucide-react';

import {
  userKeys,
  useUserActivities,
  useUserFrequency,
  useUserSummary,
  useUserTimeline,
} from '@/hooks/useUsers';
import AnimatedBadge from '@/components/ui/AnimatedBadge';
import CenteredModal from '@/components/ui/CenteredModal';
import DataTable from '@/components/ui/DataTable';
import DarkTooltip from '@/components/charts/DarkTooltip';
import { SkeletonUserCard, SkeletonTableRows, SkeletonChartFrame } from '@/components/ui/SkeletonBlock';
import { useInitialQueryHydration } from '@/hooks/queryPolicy';
import { formatNumber } from '@/lib/utils';
import { istHHMMSS } from '@/utils/ist';
import type { AnalyticsSource } from '@/types/analytics.contract';
import type { UserActivity, UserTimelineEvent } from '@/types/analytics.types';
import { UserAvatar, displayName } from '@/components/ui/UserAvatar';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function sourceLabel(source: AnalyticsSource | 'quby' | 'simulator') {
  if (source === 'all') return 'All Sources';
  return source === 'quby' ? 'Quby' : 'Simulator';
}

function sourceBadge(source: 'quby' | 'simulator') {
  const color = source === 'simulator' ? '#f59e0b' : '#3b82f6';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${color}35`, background: `${color}16`, color,
      borderRadius: 6, padding: '3px 7px', fontSize: 10, fontWeight: 800,
    }}>
      {sourceLabel(source)}
    </span>
  );
}

function severityColor(severity: UserActivity['severity']): string {
  if (severity === 'critical') return '#ef4444';
  if (severity === 'warning')  return '#f59e0b';
  return '#10b981';
}

function decisionBadge(allowed: boolean) {
  return <AnimatedBadge variant={allowed ? 'allowed' : 'blocked'} label={allowed ? 'Allowed' : 'Blocked'} size="sm" />;
}

// ─── Panel ─────────────────────────────────────────────────────────────────────
function Panel({ title, icon, children, minHeight }: { title: string; icon?: React.ReactNode; children: React.ReactNode; minHeight?: number }) {
  return (
    <section style={{
      background: 'rgba(8,13,26,0.90)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, overflow: 'hidden', minHeight: minHeight ?? 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(2,6,23,0.45)' }}>
        {icon}
        <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      {children}
    </section>
  );
}

// ─── Metric tile ───────────────────────────────────────────────────────────────
function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '8px 9px', minWidth: 0 }}>
      <div style={{ color: '#475569', fontSize: 9, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

// ─── User profile card ─────────────────────────────────────────────────────────
function UserProfileCard({ user, onClick }: { user: UserActivity; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const borderColor = hovered ? severityColor(user.severity) : 'rgba(255,255,255,0.08)';
  const glowColor   = hovered ? `${severityColor(user.severity)}22` : 'transparent';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to view detailed activity"
      style={{
        background: 'rgba(5,8,22,0.78)', border: `1px solid ${borderColor}`, borderRadius: 8,
        padding: 14, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 12,
        minHeight: 214, textAlign: 'left', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
        boxShadow: hovered ? `0 0 20px ${glowColor}, 0 4px 24px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'border-color 0.15s, box-shadow 0.15s', position: 'relative', overflow: 'hidden',
      }}
    >
      {hovered && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${severityColor(user.severity)}, transparent)`, opacity: 0.8 }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <UserAvatar userId={user.userId} userName={user.userName} avatarUrl={user.avatarUrl} size={48} severity={user.severity} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.userName}</div>
          <div style={{ marginTop: 5 }}>{sourceBadge(user.source)}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Metric label="Total Requests"    value={formatNumber(user.total)}           color="#f1f5f9" />
        <Metric label="Block Rate"        value={`${user.blockRate.toFixed(1)}%`}    color={user.blockRate >= 10 ? '#ef4444' : '#10b981'} />
        <Metric label="Allowed Requests"  value={formatNumber(user.allowed)}         color="#10b981" />
        <Metric label="Blocked Requests"  value={formatNumber(user.blocked)}         color={user.blocked > 0 ? '#ef4444' : '#64748b'} />
        <Metric label="Last Active"       value={istHHMMSS(user.lastSeen)}           color="#cbd5e1" />
        <div style={{ gridColumn: '1 / -1' }}>
          <Metric label="Favorite Endpoint" value={user.favoriteEndpoint || '-'}     color="#06b6d4" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', color: severityColor(user.severity), fontSize: 11, fontWeight: 700, paddingTop: 4, borderTop: `1px solid ${borderColor}` }}>
        <span>View Activity</span><ChevronRight size={12} />
      </div>
    </button>
  );
}

// ─── Ranking list ──────────────────────────────────────────────────────────────
function RankingList({ users, metric, color: fixedColor, onViewAll }: {
  users: Array<UserActivity | null>;
  metric: 'total' | 'blocked';
  color?: string;
  onViewAll?: () => void;
}) {
  const max      = Math.max(1, ...users.map(u => u?.[metric] ?? 0));
  const barColor = fixedColor ?? (metric === 'blocked' ? '#ef4444' : '#3b82f6');

  return (
    <div style={{ padding: '6px 0' }}>
      {users.map((user, i) => {
        const value = user?.[metric] ?? 0;
        return (
          <div key={user?.userId ?? `empty-${i}`} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 76px', gap: 8, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', minHeight: 40 }}>
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: user ? '#94a3b8' : '#334155', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.userName ?? 'No user data'}
              </div>
              <div style={{ marginTop: 5, height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: user ? barColor : 'transparent', borderRadius: 3 }} />
              </div>
            </div>
            <span style={{ color: user ? barColor : '#334155', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>
              {user ? formatNumber(value) : '-'}
            </span>
          </div>
        );
      })}
      {onViewAll && (
        <button onClick={onViewAll} style={{ width: '100%', marginTop: 8, background: 'transparent', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: "'Inter',sans-serif" }}>
          View All <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Request table ─────────────────────────────────────────────────────────────
function RequestTable({ rows, limit, onUserClick }: { rows: UserTimelineEvent[]; limit?: number; onUserClick?: (userId: string) => void }) {
  const visible = typeof limit === 'number' ? rows.slice(0, limit) : rows;
  return (
    <DataTable
      data={visible}
      keyField="id"
      emptyLabel="No user activity events"
      maxHeight={520}
      stickyHeader
      columns={[
        { key: 'userName', header: 'User', width: 220, render: row => (
          <button
            onClick={() => onUserClick?.(row.userId)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, background: 'transparent', border: 'none', padding: 0, color: '#bfdbfe', cursor: onUserClick ? 'pointer' : 'default', fontFamily: "'Inter',sans-serif" }}
          >
            <UserAvatar userId={row.userId} userName={row.userName} avatarUrl={row.avatarUrl} size={24} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(row.userId, row.userName)}</span>
          </button>
        )},
        { key: 'source',      header: 'Source',          width: 104, render: row => sourceBadge(row.source) },
        { key: 'method',      header: 'Method',           width: 80 },
        { key: 'endpoint',    header: 'Endpoint',         width: '24%' },
        { key: 'limiterName', header: 'Limiter',          width: 170, render: row => (
          <span style={{ color: row.limiterName ? '#8b5cf6' : '#475569', fontStyle: row.limiterName ? 'normal' : 'italic' }}>
            {row.limiterName || 'No Limiter'}
          </span>
        )},
        { key: 'timestamp',  header: 'Timestamp (IST)',  width: 110, render: row => istHHMMSS(row.timestamp) },
        { key: 'responseMs', header: 'Latency',           width: 84, align: 'right', render: row => `${row.responseMs ?? 0}ms` },
        { key: 'allowed',    header: 'Decision',          width: 106, align: 'center', render: row => decisionBadge(row.allowed) },
      ]}
    />
  );
}

// ─── Users modal ───────────────────────────────────────────────────────────────
function UsersModal({ title, users, onClose }: { title: string; users: UserActivity[]; onClose: () => void }) {
  return (
    <CenteredModal title={title} subtitle="Full user list — sorted by request count" onClose={onClose} maxWidth={980} accent="#06b6d4">
      <div style={{ padding: 18 }}>
        <DataTable
          data={users}
          keyField="userId"
          maxHeight={520}
          stickyHeader
          columns={[
            { key: 'userName', header: 'User', render: row => (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <UserAvatar userId={row.userId} userName={row.userName} avatarUrl={row.avatarUrl} size={24} severity={row.severity} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(row.userId, row.userName)}</span>
              </span>
            )},
            { key: 'source',    header: 'Source',         width: 110, render: row => sourceBadge(row.source) },
            { key: 'total',     header: 'Total Requests',  width: 130, align: 'right', render: row => formatNumber(row.total) },
            { key: 'allowed',   header: 'Allowed',         width: 100, align: 'right', render: row => <span style={{ color: '#10b981', fontWeight: 700 }}>{formatNumber(row.allowed)}</span> },
            { key: 'blocked',   header: 'Blocked',         width: 100, align: 'right', render: row => <span style={{ color: row.blocked > 0 ? '#ef4444' : '#64748b', fontWeight: 700 }}>{formatNumber(row.blocked)}</span> },
            { key: 'blockRate', header: 'Block Rate',      width: 100, align: 'right', render: row => (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: row.blockRate >= 10 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{row.blockRate.toFixed(1)}%</div>
                <div style={{ color: '#475569', fontSize: 9 }}>Blocked ÷ Total</div>
              </div>
            )},
            { key: 'favoriteEndpoint', header: 'Favorite Endpoint', width: 180 },
            { key: 'lastSeen', header: 'Last Active', width: 120, align: 'right', render: row => istHHMMSS(row.lastSeen) },
          ]}
        />
      </div>
    </CenteredModal>
  );
}

// ─── Timeline modal ────────────────────────────────────────────────────────────
function TimelineModal({ events, onClose }: { events: UserTimelineEvent[]; onClose: () => void }) {
  return (
    <CenteredModal title="User Activity Timeline" subtitle="All recent request events" onClose={onClose} maxWidth={1040} accent="#06b6d4">
      <div style={{ padding: 18 }}><RequestTable rows={events} /></div>
    </CenteredModal>
  );
}

// ─── User detail modal ─────────────────────────────────────────────────────────
function UserDetailModal({ user, events, onClose }: { user: UserActivity; events: UserTimelineEvent[]; onClose: () => void }) {
  const userEvents    = events.filter(e => e.userId === user.userId);
  const blockedEvents = userEvents.filter(e => !e.allowed);

  const endpointCount = new Map<string, number>();
  const hourCount     = new Map<number, number>();
  userEvents.forEach(e => {
    endpointCount.set(e.endpoint, (endpointCount.get(e.endpoint) ?? 0) + 1);
    const hour = new Date(e.timestamp).getHours();
    hourCount.set(hour, (hourCount.get(hour) ?? 0) + 1);
  });

  const topEndpoint = [...endpointCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? user.favoriteEndpoint ?? '—';
  const topHour     = [...hourCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const peakHour    = topHour ? `${String(topHour[0]).padStart(2, '0')}:00 IST` : '—';
  const isAggressive = user.blockRate >= 20;
  const riskLabel   = user.severity === 'critical' ? 'High Risk' : user.severity === 'warning' ? 'Medium Risk' : 'Low Risk';
  const riskColor   = user.severity === 'critical' ? '#ef4444' : user.severity === 'warning' ? '#f59e0b' : '#10b981';

  return (
    <CenteredModal title={displayName(user.userId, user.userName)} subtitle={`User activity detail · ${sourceLabel(user.source)} · ${user.email || user.userId}`} onClose={onClose} maxWidth={1100} accent={severityColor(user.severity)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: '80vh', overflowY: 'auto' }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <UserAvatar userId={user.userId} userName={user.userName} avatarUrl={user.avatarUrl} size={56} severity={user.severity} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 850, color: '#f1f5f9' }}>{user.userName}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{user.userId}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {sourceBadge(user.source)}
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, background: `${riskColor}16`, border: `1px solid ${riskColor}35`, color: riskColor }}>{riskLabel}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {[
              { label: 'Total Requests',   value: formatNumber(user.total),                                        color: '#f1f5f9'  },
              { label: 'Allowed Requests', value: formatNumber(user.allowed),                                      color: '#10b981'  },
              { label: 'Blocked Requests', value: formatNumber(user.blocked),                                      color: user.blocked > 0 ? '#ef4444' : '#64748b' },
              { label: 'Block Rate',       value: `${user.blockRate.toFixed(1)}%`,                                 color: user.blockRate >= 10 ? '#ef4444' : '#10b981' },
              { label: 'Last Active',      value: istHHMMSS(user.lastSeen),                                        color: '#cbd5e1'  },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{m.label}</div>
                <div style={{ color: m.color, fontSize: 18, fontWeight: 850, lineHeight: 1 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section A — Endpoint usage */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Target size={13} color="#06b6d4" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Section A — Endpoint Usage</span>
          </div>
          {endpointCount.size === 0 ? (
            <div style={{ color: '#475569', fontSize: 12, padding: '8px 0' }}>No endpoint data in current timeline window.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...endpointCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ep, count]) => {
                const maxCount = Math.max(...endpointCount.values());
                const pct = (count / maxCount) * 100;
                return (
                  <div key={ep}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{ep}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', flexShrink: 0 }}>{formatNumber(count)}</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#06b6d4', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section B — Recent activity */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Activity size={13} color="#3b82f6" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Section B — Recent Activity Timeline</span>
          </div>
          <RequestTable rows={userEvents} limit={20} />
        </div>

        {/* Section C — Block history */}
        {blockedEvents.length > 0 && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Shield size={13} color="#ef4444" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Section C — Block History ({blockedEvents.length} events)</span>
            </div>
            <RequestTable rows={blockedEvents} limit={10} />
          </div>
        )}

        {/* Section D — Behavior insights */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <TrendingUp size={13} color="#a855f7" />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Section D — Behavior Insights</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { icon: <Target size={14} color="#06b6d4" />,  label: 'Most Targeted Endpoint',    value: topEndpoint,                                           sub: 'Endpoint hit most frequently by this user' },
              { icon: <Zap    size={14} color="#f59e0b" />,  label: 'Most Active Hour',           value: peakHour,                                              sub: 'Hour of day with highest request volume' },
              { icon: <Activity size={14} color="#3b82f6" />,label: 'Primary Traffic Source',     value: sourceLabel(user.source),                              sub: "Source platform for this user's requests" },
              { icon: <Shield size={14} color={riskColor} />,label: 'Aggressive Behavior Risk',   value: isAggressive ? `High — ${user.blockRate.toFixed(1)}% block rate` : riskLabel, sub: isAggressive ? 'Block rate ≥ 20% indicates aggressive or misconfigured client' : 'Normal behavior detected — block rate within acceptable range', color: riskColor },
            ].map(insight => (
              <div key={insight.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 10 }}>
                <div style={{ marginTop: 2 }}>{insight.icon}</div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{insight.label}</div>
                  <div style={{ color: (insight as { color?: string }).color ?? '#f1f5f9', fontSize: 13, fontWeight: 800 }}>{insight.value}</div>
                  <div style={{ color: '#475569', fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>{insight.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CenteredModal>
  );
}

// ─── Empty placeholder card ────────────────────────────────────────────────────
function EmptyCard() {
  return (
    <div style={{ minHeight: 214, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,8,22,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>
      No user data
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function UserActivityPage() {
  const [sourceFilter, setSourceFilter] = useState<AnalyticsSource>('all');
  const [modal, setModal]               = useState<'activeUsers' | 'blockedUsers' | 'timeline' | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);

  // ── Cache cleanup — prevents stale user data from another visit ─────────────
  // ── Data fetching ────────────────────────────────────────────────────────────
  const usersQuery = useUserActivities(sourceFilter);
  const summaryQuery = useUserSummary(sourceFilter);
  const timelineQuery = useUserTimeline(sourceFilter);
  const frequencyQuery = useUserFrequency(sourceFilter);

  const activitiesLoading = useInitialQueryHydration([usersQuery], [sourceFilter]);
  const timelineLoading = useInitialQueryHydration([timelineQuery], [sourceFilter]);
  const frequencyLoading = useInitialQueryHydration([frequencyQuery], [sourceFilter]);
  const users = activitiesLoading ? [] : usersQuery.data ?? [];
  const timeline = timelineLoading ? [] : timelineQuery.data ?? [];
  const frequency = frequencyLoading ? [] : frequencyQuery.data ?? [];

  useEffect(() => {
    setModal(null);
    setSelectedUser(null);
  }, [sourceFilter]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const rankedByRequests = useMemo(() => [...users].sort((a, b) => b.total   - a.total),   [users]);
  const rankedByBlocked  = useMemo(() => [...users].sort((a, b) => b.blocked - a.blocked), [users]);
  const topFiveRequests  = Array.from({ length: 5 }, (_, i) => rankedByRequests[i] ?? null);
  const topFiveBlocked   = Array.from({ length: 5 }, (_, i) => rankedByBlocked[i]  ?? null);
  const profileUsers     = Array.from({ length: 4 }, (_, i) => rankedByRequests[i] ?? null);

  // Suppress unused warning — summary is fetched to keep cache warm
  void summaryQuery.data;

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>User Activity</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            User request behavior, source isolation, risk scoring, and endpoint usage.
            <span style={{ color: '#475569', marginLeft: 6 }}>Click any user card to inspect their activity.</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(['all', 'quby', 'simulator'] as const).map(source => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              style={{
                background: sourceFilter === source ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${sourceFilter === source ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.10)'}`,
                color: sourceFilter === source ? '#06b6d4' : '#64748b',
                borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 750,
              }}
            >
              {sourceLabel(source)}
            </button>
          ))}
        </div>
      </div>

      {/* ── User profile cards ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {activitiesLoading
          ? Array.from({ length: 4 }, (_, i) => <SkeletonUserCard key={i} />)
          : profileUsers.map((user, index) =>
              user
                ? <UserProfileCard key={user.userId} user={user} onClick={() => setSelectedUser(user)} />
                : <EmptyCard key={`empty-user-${index}`} />
            )
        }
      </div>

      {/* ── Rankings + frequency ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, alignItems: 'start' }}>
        <Panel title="User Request Frequency" icon={<Activity size={14} color="#3b82f6" />} minHeight={320}>
          <div style={{ height: 260, padding: '14px 10px 12px' }}>
            {frequencyLoading ? (
              <SkeletonChartFrame height={234} />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={frequency} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                <defs>
                  <linearGradient id="qubyUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="simUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.09)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={<DarkTooltip metaHints={{ realUsers: 'Unique users from Quby (production)', simUsers: 'Unique users from Simulator' }} />}
                  wrapperStyle={{ background: 'transparent', boxShadow: 'none' }}
                  contentStyle={{ background: 'transparent' }}
                />
                {(sourceFilter === 'all' || sourceFilter === 'quby')      && <Area type="monotone" dataKey="realUsers" name="Quby Users"      stroke="#3b82f6" fill="url(#qubyUsers)" strokeWidth={2} dot={false} />}
                {(sourceFilter === 'all' || sourceFilter === 'simulator') && <Area type="monotone" dataKey="simUsers"  name="Simulator Users" stroke="#f59e0b" fill="url(#simUsers)"  strokeWidth={2} dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Highest Blocked Users" icon={<Shield size={15} color="#ef4444" />} minHeight={320}>
          {activitiesLoading ? <SkeletonTableRows rows={5} height={40} /> : <RankingList users={topFiveBlocked} metric="blocked" color="#ef4444" onViewAll={() => setModal('blockedUsers')} />}
        </Panel>

        <Panel title="Most Active Users" icon={<Users size={14} color="#3b82f6" />} minHeight={300}>
          {activitiesLoading ? <SkeletonTableRows rows={5} height={40} /> : <RankingList users={topFiveRequests} metric="total" onViewAll={() => setModal('activeUsers')} />}
        </Panel>
      </div>

      {/* ── Activity timeline table ──────────────────────────────────────── */}
      <Panel title="User Activity Timeline — Last 15 mins" icon={<Activity size={14} color="#06b6d4" />}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 16px 0' }}>
          <button
            onClick={() => setModal('timeline')}
            style={{ background: 'transparent', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Inter',sans-serif" }}
          >
            View All <ArrowRight size={12} />
          </button>
        </div>
        {timelineLoading ? (
          <SkeletonTableRows rows={10} height={42} />
        ) : (
          <RequestTable
            rows={timeline}
            limit={60}
            onUserClick={(userId) => setSelectedUser(users.find(u => u.userId === userId) ?? null)}
          />
        )}
      </Panel>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {modal === 'activeUsers'  && <UsersModal title="Most Active Users"      users={rankedByRequests} onClose={() => setModal(null)} />}
      {modal === 'blockedUsers' && <UsersModal title="Highest Blocked Users"  users={rankedByBlocked}  onClose={() => setModal(null)} />}
      {modal === 'timeline'     && <TimelineModal events={timeline} onClose={() => setModal(null)} />}
      {selectedUser             && <UserDetailModal user={selectedUser} events={timeline} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}
