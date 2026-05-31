import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw, Shield, User, Zap } from 'lucide-react';

import { fetchLimitsConfig, runSimulation, type LimitConfig, type SimulateResult } from '@/api/client';
import { istHHMMSS } from '@/utils/ist';
import { formatNumber } from '@/lib/utils';
import { useSimulatorStore } from '@/store/simulatorStore';
import { useAppSettingsStore } from '@/store/appSettingsStore';

function Panel({ children, accent = 'rgba(255,255,255,0.07)' }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: 'rgba(8,13,26,0.92)',
      border: `1px solid ${accent}`,
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>
      {children}
    </div>
  );
}

export default function Simulator() {
  const queryClient = useQueryClient();
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [username, setUsername] = useState('');
  const { simulatorDefaultCount, simulatorDefaultDelayMs } = useAppSettingsStore();
  const [countInput, setCountInput] = useState(String(simulatorDefaultCount));
  const [delayInput, setDelayInput] = useState(String(simulatorDefaultDelayMs));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lastRun, completedAt, setLastRun, clearLastRun } = useSimulatorStore();

  const { data: configs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['simulator', 'limits-config'],
    queryFn: fetchLimitsConfig,
    staleTime: 60_000,
    retry: 1,
  });

  const endpoints = useMemo(
    () => configs.filter((cfg) => cfg.endpoint && cfg.endpoint !== '*'),
    [configs],
  );
  const activeEndpoint = endpoints.find((cfg) => cfg.endpoint === selectedEndpoint) ?? endpoints[0];
  const endpoint = selectedEndpoint || activeEndpoint?.endpoint || '';
  const parsedCount = Number(countInput);
  const parsedDelay = Number(delayInput);
  const safeCount = Number.isFinite(parsedCount) ? Math.min(100, Math.max(1, Math.trunc(parsedCount))) : 1;
  const safeDelay = Number.isFinite(parsedDelay) ? Math.min(5000, Math.max(0, Math.trunc(parsedDelay))) : 0;
  const canRun = Boolean(endpoint && username.trim() && countInput.trim() && Number.isFinite(parsedCount) && parsedCount >= 1 && !running);

  async function handleRun() {
    if (!canRun) return;
    if (lastRun) {
      setError('Reset previous simulation before running another.');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const next = await runSimulation({
        userId: username.trim(),
        endpoint,
        count: safeCount,
        delayMs: safeDelay,
      });
      setLastRun(next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['live-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['rate-limiter-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['endpoint-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['user-activity'] }),
      ]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Backend simulation failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleRefreshConfig() {
    clearLastRun();
    setError(null);
    await queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['live-feed'] });
    await queryClient.invalidateQueries({ queryKey: ['rate-limiter-analytics'] });
    await queryClient.invalidateQueries({ queryKey: ['endpoint-analytics'] });
    await refetch();
  }

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Simulator</h1>
          <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
            Sends manual test traffic to the backend simulator API. The frontend does not create analytics locally.
          </p>
        </div>
        <button onClick={() => void handleRefreshConfig()} disabled={isLoading} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 9, padding: '8px 14px', cursor: isLoading ? 'wait' : 'pointer',
          fontSize: 12, color: '#94a3b8', fontFamily: "'Inter',sans-serif",
        }}>
          <RefreshCw size={13} /> Refresh Config
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, alignItems: 'stretch' }}>
        <Panel accent="rgba(59,130,246,0.22)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <FieldLabel>Backend Endpoint</FieldLabel>
              <select
                value={endpoint}
                onChange={(e) => setSelectedEndpoint(e.target.value)}
                disabled={isLoading || endpoints.length === 0}
                style={{
                  width: '100%', background: '#0b1220', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 9, color: '#e2e8f0', fontSize: 12, padding: '9px 10px',
                  fontFamily: "'JetBrains Mono',monospace", outline: 'none',
                  colorScheme: 'dark',
                }}
              >
                {endpoints.map((cfg: LimitConfig) => (
                  <option key={cfg.endpoint} value={cfg.endpoint} style={{ background: '#0b1220', color: '#e2e8f0' }}>{cfg.endpoint}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Username</FieldLabel>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a test username"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 9, color: '#e2e8f0', fontSize: 12, padding: '9px 10px',
                  fontFamily: "'JetBrains Mono',monospace", outline: 'none',
                }}
              />
            </div>
            <div>
              <FieldLabel>Request Count</FieldLabel>
              <input
                type="number"
                min={1}
                max={100}
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                onBlur={() => setCountInput(String(safeCount))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 9, color: '#e2e8f0', fontSize: 12, padding: '9px 10px',
                  fontFamily: "'JetBrains Mono',monospace", outline: 'none',
                }}
              />
            </div>
            <div>
              <FieldLabel>Delay Ms</FieldLabel>
              <input
                type="number"
                min={0}
                max={5000}
                value={delayInput}
                onChange={(e) => setDelayInput(e.target.value)}
                onBlur={() => setDelayInput(String(safeDelay))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 9, color: '#e2e8f0', fontSize: 12, padding: '9px 10px',
                  fontFamily: "'JetBrains Mono',monospace", outline: 'none',
                }}
              />
            </div>
          </div>

          {activeEndpoint && (
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Limiter', value: activeEndpoint.limiterName ?? 'backend' },
                { label: 'Limit', value: `${activeEndpoint.max}` },
                { label: 'Window', value: activeEndpoint.windowLabel },
                { label: 'Algorithm', value: activeEndpoint.algorithm },
              ].map((item) => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#475569', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div style={{ marginTop: 14, color: '#ef4444', fontSize: 12 }}>Could not load backend limiter config.</div>
          )}
          {error && (
            <div style={{ marginTop: 14, color: '#ef4444', fontSize: 12 }}>{error}</div>
          )}

          <motion.button
            whileHover={canRun ? { scale: 1.01 } : undefined}
            whileTap={canRun ? { scale: 0.99 } : undefined}
            onClick={handleRun}
            disabled={!canRun}
            style={{
              marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', minHeight: 44,
              background: canRun ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : 'rgba(100,116,139,0.16)',
              border: canRun ? '1px solid rgba(59,130,246,0.45)' : '1px solid rgba(100,116,139,0.22)',
              borderRadius: 10, color: canRun ? '#fff' : '#64748b',
              cursor: canRun ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 700, fontFamily: "'Inter',sans-serif",
            }}
          >
            {running ? <><RefreshCw size={14} /> Running Backend Check</> : <><Play size={14} /> Run Simulation</>}
          </motion.button>
          {lastRun && (
            <button onClick={() => { clearLastRun(); setError(null); }} style={{
              marginTop: 10, width: '100%', minHeight: 38, borderRadius: 9,
              background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.24)',
              color: '#ef4444', cursor: 'pointer', fontWeight: 800, fontSize: 12,
            }}>
              Reset Previous Simulation
            </button>
          )}
        </Panel>

        <Panel accent="rgba(16,185,129,0.18)">
          <FieldLabel>Latest Simulation Result</FieldLabel>
          {!lastRun ? (
            <div style={{ minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#475569' }}>
              <Zap size={32} strokeWidth={1.2} />
              <div style={{ fontSize: 12 }}>No backend simulation run yet</div>
              <div style={{ fontSize: 10, maxWidth: 280, textAlign: 'center' }}>Run the simulator to see the latest backend response, limiter decision, and request summary here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total', value: formatNumber(lastRun.total), color: '#06b6d4', icon: <Zap size={13} /> },
                  { label: 'Allowed', value: formatNumber(lastRun.allowed), color: '#10b981', icon: <Shield size={13} /> },
                  { label: 'Blocked', value: formatNumber(lastRun.blocked), color: '#ef4444', icon: <Shield size={13} /> },
                ].map((item) => (
                  <div key={item.label} style={{ border: `1px solid ${item.color}22`, borderRadius: 9, padding: '10px 12px', background: `${item.color}0a` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: item.color, marginBottom: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 700 }}>{item.label}</span>
                      {item.icon}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ border: `1px solid ${lastRun.blocked > 0 ? 'rgba(239,68,68,0.22)' : 'rgba(16,185,129,0.22)'}`, background: lastRun.blocked > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Limiter Decision</div>
                <div style={{ color: lastRun.blocked > 0 ? '#ef4444' : '#10b981', fontSize: 14, fontWeight: 850 }}>
                  {lastRun.blocked > 0 ? 'Rate limit triggered during run' : 'All simulated requests allowed'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Endpoint', lastRun.endpoint],
                  ['Username', lastRun.userId],
                  ['Block Rate', `${lastRun.blockRate.toFixed(1)}%`],
                  ['Avg Latency', `${lastRun.avgLatencyMs}ms`],
                  ['Algorithm', lastRun.algorithm],
                  ['Limiter', lastRun.limiterName ?? 'backend'],
                  ['Limiter Triggered', lastRun.blocked > 0 ? 'Yes' : 'No'],
                  ['Reset Window', '60s'],
                  ['Configured Limit', String(lastRun.limit)],
                  ['Backend Result Rows', String(lastRun.results.length)],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '6px 0' }}>
                    <span style={{ color: '#475569' }}>{label}</span>
                    <span style={{ color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 80px 1fr', padding: '7px 10px', background: 'rgba(255,255,255,0.035)', color: '#475569', fontSize: 9, fontWeight: 800 }}>
                  <span>#</span><span>Decision</span><span>Remaining</span><span>Reason</span>
                </div>
                {lastRun.results.slice(0, 8).map((row) => (
                  <div key={row.seq} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 80px 1fr', padding: '7px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 10 }}>
                    <span style={{ color: '#64748b' }}>{row.seq}</span>
                    <span style={{ color: row.allowed ? '#10b981' : '#ef4444', fontWeight: 800 }}>{row.allowed ? 'Allowed' : 'Blocked'}</span>
                    <span style={{ color: '#94a3b8' }}>{row.remaining}</span>
                    <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.reason ?? '-'}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={11} /> Completed at {completedAt ? istHHMMSS(completedAt) : '-'}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
