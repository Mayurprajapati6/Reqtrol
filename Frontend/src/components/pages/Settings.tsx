import { RotateCcw, Save, Settings2 } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { useAppSettingsStore, type ThemeDensity } from '@/store/appSettingsStore';

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: 18, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberInput({ value, min, max, step = 1, suffix, onChange }: { value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 112, background: '#0b1220', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12, outline: 'none' }}
      />
      {suffix && <span style={{ color: '#64748b', fontSize: 11 }}>{suffix}</span>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ width: 48, height: 26, borderRadius: 14, border: `1px solid ${checked ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.10)'}`, cursor: 'pointer', background: checked ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.07)', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: checked ? '#06b6d4' : '#64748b', transition: 'left 0.16s' }} />
    </button>
  );
}

function DensitySelect({ value, onChange }: { value: ThemeDensity; onChange: (value: ThemeDensity) => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
      {(['comfortable', 'compact'] as const).map((density) => (
        <button key={density} onClick={() => onChange(density)} style={{ padding: '8px 12px', border: 'none', cursor: 'pointer', background: value === density ? 'rgba(6,182,212,0.18)' : 'transparent', color: value === density ? '#06b6d4' : '#64748b', fontSize: 12, fontWeight: 750, textTransform: 'capitalize' }}>
          {density}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const settings = useAppSettingsStore();

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>Settings</h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
          Frontend controls that immediately affect polling, realtime views, simulator defaults, and interface density.
        </p>
      </div>

      <GlassCard accent="#06b6d4" glowColor="rgba(6,182,212,0.12)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(6,182,212,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings2 size={15} color="#06b6d4" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>Runtime Configuration</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Stored locally and read by live dashboard hooks.</div>
          </div>
        </div>

        <Row label="Realtime Updates" description="Turn frontend polling on or off across live analytics pages.">
          <Toggle checked={settings.realtimeEnabled} onChange={settings.setRealtimeEnabled} />
        </Row>
        <Row label="Polling Interval" description="Controls live feed, dashboard KPI, user activity, and limiter refresh cadence.">
          <NumberInput value={settings.pollingIntervalMs / 1000} min={1} max={30} suffix="seconds" onChange={(v) => settings.setPollingIntervalMs(v * 1000)} />
        </Row>
        <Row label="Chart Refresh Interval" description="Controls slower chart and ranking refreshes.">
          <NumberInput value={settings.chartRefreshIntervalMs / 1000} min={3} max={60} suffix="seconds" onChange={(v) => settings.setChartRefreshIntervalMs(v * 1000)} />
        </Row>
        <Row label="Live Feed Limit" description="Maximum number of recent requests loaded into the full-width stream.">
          <NumberInput value={settings.liveFeedLimit} min={50} max={1000} step={50} suffix="rows" onChange={settings.setLiveFeedLimit} />
        </Row>
        <Row label="Simulator Default Count" description="Default request count used when opening the simulator.">
          <NumberInput value={settings.simulatorDefaultCount} min={1} max={100} suffix="requests" onChange={settings.setSimulatorDefaultCount} />
        </Row>
        <Row label="Simulator Default Delay" description="Default delay between simulated requests.">
          <NumberInput value={settings.simulatorDefaultDelayMs} min={0} max={5000} step={25} suffix="ms" onChange={settings.setSimulatorDefaultDelayMs} />
        </Row>
        <Row label="Theme Density" description="Compact density tightens operational tables where supported.">
          <DensitySelect value={settings.themeDensity} onChange={settings.setThemeDensity} />
        </Row>
      </GlassCard>

      <div style={{ display: 'flex', gap: 12 }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'default', fontFamily: "'Inter',sans-serif" }}>
          <Save size={14} /> Saved Automatically
        </button>
        <button onClick={settings.resetSettings} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#94a3b8', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
          <RotateCcw size={14} /> Reset Defaults
        </button>
      </div>
    </div>
  );
}
