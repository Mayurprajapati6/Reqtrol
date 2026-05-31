import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays, Pause, Play, Radio, Trash2,
} from 'lucide-react';

import { useLiveFeedEvents } from '@/hooks/useLiveFeed';
import { fetchHistoricalRequests } from '@/api/client';
import CenteredModal from '@/components/ui/CenteredModal';
import DataTable from '@/components/ui/DataTable';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/SkeletonBlock';
import { useInitialQueryHydration } from '@/hooks/queryPolicy';
import { UserAvatar, displayName } from '@/components/ui/UserAvatar';
import { istHHMMSS } from '@/utils/ist';
import type { ActivityEvent, LiveFeedWindow } from '@/types/analytics.types';
import type { AnalyticsSource } from '@/types/analytics.contract';
import { activeEndpointOptions } from '@/services/analytics/chartTransformers';
import { useAppSettingsStore } from '@/store/appSettingsStore';

type ReqStatus = 'allowed' | 'blocked';
type EnrichedEvent = ActivityEvent & { _status: ReqStatus };

const WINDOW_OPTIONS: Array<{ label: string; value: LiveFeedWindow }> = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: 'Today', value: 1440 },
];

const STATUS_STYLE: Record<ReqStatus, { color: string; bg: string; label: string }> = {
  allowed: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Allowed' },
  blocked: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Blocked' },
};

const todayInputValue = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

/** Format a Date as YYYY-MM-DD in IST — the navbar clock timezone. */
function formatIST(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  // Parse 'YYYY-MM-DD' as LOCAL midnight so getFullYear/getMonth give the right calendar page.
  const parseLocalDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const [month, setMonth] = useState(() => parseLocalDate(value));

  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startDay = startOfMonth.getDay();

  const days: Array<(Date | null)> = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(month.getFullYear(), month.getMonth(), d));

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(2,6,23,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
        color: '#cbd5e1', padding: '8px 10px', fontSize: 12, cursor: 'pointer', minWidth: 150, textAlign: 'left'
      }}><CalendarDays size={14} color="#06b6d4" /> {value}</button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 200, background: 'rgba(8,13,26,0.98)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.6)'}}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '6px 4px' }}>
            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={{background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer'}}>&lt;</button>
            <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{month.toLocaleString('default', { month: 'long' })} {month.getFullYear()}</div>
            <button onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer'}}>&gt;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 28px)', gap: 4, marginTop: 8 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ color: '#64748b', fontSize: 11, textAlign: 'center' }}>{d}</div>)}
            {days.map((dt, i) => (
              <div key={i} onClick={() => { if (dt) { onChange(formatIST(dt)); setOpen(false); } }}
                style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: dt ? 'pointer' : 'default', color: dt ? '#cbd5e1' : 'transparent', background: dt && formatIST(dt) === value ? '#06b6d4' : 'transparent' }}>
                {dt ? dt.getDate() : ''}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={() => { onChange(todayInputValue()); setOpen(false); }} style={{ background: 'transparent', border: 'none', color: '#06b6d4', cursor: 'pointer' }}>Today</button>
            <button onClick={() => { onChange(''); setOpen(false); }} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

function decisionBadge(status: ReqStatus) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 78,
      padding: '4px 0',
      borderRadius: 6,
      background: s.bg,
      border: `1px solid ${s.color}35`,
      color: s.color,
      fontSize: 10,
      fontWeight: 800,
      textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  );
}

function sourceBadge(source: AnalyticsSource | ActivityEvent['source']) {
  if (source === 'all') return 'All';
  return source === 'quby' ? 'Quby' : 'Simulator';
}

function LiveStatus({ paused }: { paused: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(5,8,22,0.92)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: '7px 12px',
      minHeight: 32,
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: paused ? '#f59e0b' : '#10b981',
      }} />
      <span style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.07em',
        color: paused ? '#f59e0b' : '#10b981',
      }}>
        {paused ? 'PAUSED' : 'LIVE'}
      </span>
    </div>
  );
}

function HistoricalRequestsModal({
  source,
  onClose,
}: {
  source: AnalyticsSource;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayInputValue());
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['historicalRequests', date, page, limit, source],
    queryFn: () => fetchHistoricalRequests(date, page, limit, source),
    enabled: Boolean(date),
    staleTime: 20_000,
  });

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <CenteredModal
      title="Historical Requests"
      subtitle={`Selected day in IST. Source: ${sourceBadge(source)}`}
      onClose={onClose}
      maxWidth={1180}
      accent="#06b6d4"
    >
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <CalendarPicker value={date} onChange={(v) => { setDate(v); setPage(1); }} />
          <button onClick={() => void refetch()} style={buttonStyle('#06b6d4')}>
            Refresh
          </button>
          <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11 }}>
            {isFetching ? 'Loading...' : `${data?.total ?? 0} requests`}
          </span>
        </div>

        {isError ? (
          <ErrorState title="Could Not Load Requests" message="The selected day could not be fetched from the backend." onRetry={() => refetch()} />
        ) : (
          <DataTable
            data={rows}
            keyField="_id"
            maxHeight={520}
            stickyHeader
            emptyLabel={isFetching ? 'Loading requests...' : 'No requests found for this day'}
            columns={[
              { key: 'userId', header: 'User', width: 210, render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <UserAvatar userId={r.userId} userName={r.userName} avatarUrl={r.avatarUrl} size={24} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(r.userId, r.userName)}</span>
                </span>
              ) },
              { key: 'source', header: 'Source', width: 100, render: (r) => sourceBadge(r.source ?? 'quby') },
              { key: 'method', header: 'Method', width: 84 },
              { key: 'endpoint', header: 'Endpoint', width: '24%' },
              { key: 'limiterName', header: 'Limiter', width: 180, render: (r) => r.limiterName || 'No Limiter' },
              { key: 'timestamp', header: 'Timestamp', width: 110, render: (r) => istHHMMSS(r.timestamp) },
              { key: 'responseTimeMs', header: 'Latency', width: 90, align: 'right', render: (r) => `${r.responseTimeMs}ms` },
              { key: 'allowed', header: 'Decision', width: 104, align: 'center', render: (r) => decisionBadge(r.allowed ? 'allowed' : 'blocked') },
            ]}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={pagerStyle(page <= 1)}>
            Previous
          </button>
          <span style={{ color: '#64748b', fontSize: 11, minWidth: 90, textAlign: 'center' }}>
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={pagerStyle(page >= totalPages)}>
            Next
          </button>
        </div>
      </div>
    </CenteredModal>
  );
}

function buttonStyle(accent: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${accent}35`,
    background: `${accent}14`,
    color: accent,
    borderRadius: 8,
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Inter',sans-serif",
  };
}

function pagerStyle(disabled: boolean): React.CSSProperties {
  return {
    border: '1px solid rgba(255,255,255,0.1)',
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
    color: disabled ? '#334155' : '#cbd5e1',
    borderRadius: 8,
    padding: '7px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    fontWeight: 700,
  };
}

export default function LiveFeed() {
  const [paused, setPaused] = useState(false);
  const [window_, setWindow_] = useState<LiveFeedWindow>(15);
  const [filterStatus, setFilterStatus] = useState<'all' | ReqStatus>('all');
  const [filterSource, setFilterSource] = useState<AnalyticsSource>('all');
  const [filterEndpoint, setFilterEndpoint] = useState('all');
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => new Set());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(80);
  const { liveFeedLimit, realtimeEnabled, themeDensity } = useAppSettingsStore();
  const requestLimit = Math.max(liveFeedLimit ?? 0, 2000);

  const liveFeedQuery = useLiveFeedEvents(window_, requestLimit, paused || !realtimeEnabled, filterSource);
  const feedLoading = useInitialQueryHydration(
    [liveFeedQuery],
    [window_, requestLimit, filterSource, paused, realtimeEnabled],
  );
  const liveEvents = feedLoading ? [] : liveFeedQuery.data ?? [];
  const feedError = liveFeedQuery.isError;
  const refetchFeed = liveFeedQuery.refetch;

  const endpointOptions = useMemo(() => activeEndpointOptions(), []);

  useEffect(() => {
    setClearedIds(new Set());
    setFilterEndpoint('all');
    setVisibleCount(80);
  }, [window_, filterSource]);

  useEffect(() => {
    setVisibleCount(80);
  }, [filterStatus, filterEndpoint]);

  const enriched = useMemo<EnrichedEvent[]>(() => {
    const cutoff = Date.now() - window_ * 60 * 1000;
    return liveEvents
      .filter(ev => window_ === 1440 || new Date(ev.timestamp).getTime() > cutoff)
      .filter(ev => !clearedIds.has(ev.id))
      .map(ev => ({
        ...ev,
        _status: (ev.allowed ? 'allowed' : 'blocked') as ReqStatus,
      }))
      .filter(ev => {
        if (filterStatus !== 'all' && ev._status !== filterStatus) return false;
        if (filterEndpoint !== 'all' && ev.endpoint !== filterEndpoint) return false;
        return true;
      });
  }, [liveEvents, window_, clearedIds, filterStatus, filterEndpoint]);

  const allowedN = enriched.filter(e => e._status === 'allowed').length;
  const blockedN = enriched.filter(e => e._status === 'blocked').length;
  const visibleRows = enriched.slice(0, visibleCount);

  const handleStreamScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      setVisibleCount(count => Math.min(enriched.length, count + 80));
    }
  };

  const clearVisibleFeed = () => {
    setClearedIds(prev => {
      const next = new Set(prev);
      enriched.forEach(ev => next.add(ev.id));
      return next;
    });
  };

  return (
    <div style={{ padding: themeDensity === 'compact' ? '10px 14px' : '14px 18px', display: 'flex', flexDirection: 'column', gap: themeDensity === 'compact' ? 8 : 12, height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LiveStatus paused={paused} />

        <div style={segmentedStyle}>
          {WINDOW_OPTIONS.map(w => (
            <button key={w.value} onClick={() => setWindow_(w.value)} style={segmentButtonStyle(window_ === w.value, '#06b6d4')}>
              {w.label}
            </button>
          ))}
        </div>

        <div style={segmentedStyle}>
          {(['all', 'allowed', 'blocked'] as const).map(status => (
            <button key={status} onClick={() => setFilterStatus(status)} style={segmentButtonStyle(filterStatus === status, '#3b82f6')}>
              {status}
            </button>
          ))}
        </div>

        <div style={segmentedStyle}>
          {(['all', 'quby', 'simulator'] as const).map(source => (
            <button key={source} onClick={() => setFilterSource(source)} style={segmentButtonStyle(filterSource === source, '#14b8a6')}>
              {sourceBadge(source)}
            </button>
          ))}
        </div>

        <select
          value={filterEndpoint}
          onChange={(e) => setFilterEndpoint(e.target.value)}
          style={{
            background: 'rgba(5,8,22,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: filterEndpoint === 'all' ? '#64748b' : '#06b6d4',
            fontSize: 12,
            padding: '7px 10px',
            cursor: 'pointer',
            outline: 'none',
            minWidth: 170,
          }}
        >
          <option value="all">All endpoints</option>
          {endpointOptions.map(endpoint => (
            <option key={endpoint} value={endpoint}>{endpoint}</option>
          ))}
        </select>

        <button onClick={() => setHistoryOpen(true)} style={buttonStyle('#06b6d4')}>
          <CalendarDays size={14} /> View Historical Requests
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={() => setPaused(p => !p)} style={buttonStyle(paused ? '#10b981' : '#f59e0b')}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? 'Resume' : 'Pause'}
        </button>

        <button onClick={clearVisibleFeed} style={buttonStyle('#ef4444')}>
          <Trash2 size={14} /> Clear
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <section style={{ ...panelStyle, height: '100%', minHeight: 0 }}>
          <div style={panelHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={14} color="#06b6d4" />
              <span style={panelTitleStyle}>Request Stream</span>
            </div>
            <div style={{ display: 'flex', gap: 14, color: '#64748b', fontSize: 11 }}>
              <span>{feedLoading ? 'Loading' : `${visibleRows.length}/${enriched.length}`} visible</span>
              <span style={{ color: '#10b981' }}>{allowedN} allowed</span>
              <span style={{ color: '#ef4444' }}>{blockedN} blocked</span>
            </div>
          </div>

          {feedError ? (
            <ErrorState title="Live Feed Unavailable" message="Could not connect to Reqtrol backend. Start the server on port 4000." onRetry={() => refetchFeed()} />
          ) : feedLoading ? (
            <SkeletonTableRows rows={12} height={42} />
          ) : (
            <DataTable
              data={visibleRows}
              keyField="id"
              stickyHeader
              maxHeight="100%"
              onScroll={handleStreamScroll}
              emptyLabel={paused ? 'Live polling is paused' : 'Waiting for realtime traffic'}
              columns={[
                {
                  key: 'userId',
                  header: 'User',
                  width: 220,
                  render: (ev) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <UserAvatar userId={ev.userId} avatarUrl={ev.avatarUrl} size={24} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(ev.userId, ev.userName)}</span>
                    </span>
                  ),
                },
                { key: 'source', header: 'Source', width: 96, render: (ev) => sourceBadge(ev.source) },
                { key: 'method', header: 'Method', width: 82, render: (ev) => <span style={{ color: '#cbd5e1', fontWeight: 800 }}>{ev.method}</span> },
                { key: 'endpoint', header: 'Endpoint', width: '25%' },
                { key: 'limiterName', header: 'Limiter', width: 180, render: (ev) => ev.limiterName || 'No Limiter' },
                { key: 'timestamp', header: 'Timestamp', width: 108, render: (ev) => istHHMMSS(ev.timestamp) },
                { key: 'responseMs', header: 'Latency', width: 86, align: 'right', render: (ev) => `${ev.responseMs}ms` },
                { key: '_status', header: 'Decision', width: 108, align: 'center', render: (ev) => decisionBadge(ev._status) },
              ]}
            />
          )}
        </section>
      </div>

      {historyOpen && <HistoricalRequestsModal source={filterSource} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

const segmentedStyle: React.CSSProperties = {
  display: 'flex',
  background: 'rgba(5,8,22,0.92)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  overflow: 'hidden',
  minHeight: 32,
};

function segmentButtonStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    padding: '7px 12px',
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 750,
    background: active ? `${accent}22` : 'transparent',
    color: active ? accent : '#64748b',
    textTransform: 'capitalize',
  };
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  background: 'rgba(5,8,22,0.78)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  overflow: 'hidden',
};

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(2,6,23,0.55)',
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: '#94a3b8',
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
};
