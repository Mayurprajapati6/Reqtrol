import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeDensity = 'comfortable' | 'compact';

export interface AppSettingsState {
  pollingIntervalMs: number;
  liveFeedLimit: number;
  chartRefreshIntervalMs: number;
  simulatorDefaultCount: number;
  simulatorDefaultDelayMs: number;
  themeDensity: ThemeDensity;
  realtimeEnabled: boolean;
  setPollingIntervalMs: (value: number) => void;
  setLiveFeedLimit: (value: number) => void;
  setChartRefreshIntervalMs: (value: number) => void;
  setSimulatorDefaultCount: (value: number) => void;
  setSimulatorDefaultDelayMs: (value: number) => void;
  setThemeDensity: (value: ThemeDensity) => void;
  setRealtimeEnabled: (value: boolean) => void;
  resetSettings: () => void;
}

export const DEFAULT_APP_SETTINGS = {
  pollingIntervalMs: 3000,
  liveFeedLimit: 500,
  chartRefreshIntervalMs: 8000,
  simulatorDefaultCount: 10,
  simulatorDefaultDelayMs: 50,
  themeDensity: 'comfortable' as ThemeDensity,
  realtimeEnabled: true,
};

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_APP_SETTINGS,
      setPollingIntervalMs: (value) => set({ pollingIntervalMs: clampInt(value, 1000, 30000) }),
      setLiveFeedLimit: (value) => set({ liveFeedLimit: clampInt(value, 50, 2000) }),
      setChartRefreshIntervalMs: (value) => set({ chartRefreshIntervalMs: clampInt(value, 3000, 60000) }),
      setSimulatorDefaultCount: (value) => set({ simulatorDefaultCount: clampInt(value, 1, 100) }),
      setSimulatorDefaultDelayMs: (value) => set({ simulatorDefaultDelayMs: clampInt(value, 0, 5000) }),
      setThemeDensity: (value) => set({ themeDensity: value }),
      setRealtimeEnabled: (value) => set({ realtimeEnabled: value }),
      resetSettings: () => set(DEFAULT_APP_SETTINGS),
    }),
    { name: 'reqtrol-frontend-settings' },
  ),
);
