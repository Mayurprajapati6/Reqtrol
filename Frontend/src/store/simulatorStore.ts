import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SimulateResult } from '@/api/client';

interface SimulatorState {
  lastRun: SimulateResult | null;
  completedAt: string | null;
  setLastRun: (run: SimulateResult) => void;
  clearLastRun: () => void;
}

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set) => ({
      lastRun: null,
      completedAt: null,
      setLastRun: (run) => set({ lastRun: run, completedAt: new Date().toISOString() }),
      clearLastRun: () => set({ lastRun: null, completedAt: null }),
    }),
    { name: 'reqtrol-simulator-last-run' },
  ),
);
