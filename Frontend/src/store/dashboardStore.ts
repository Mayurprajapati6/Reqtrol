import { create } from 'zustand';

type TimeWindow = 15 | 30 | 60 | 360;

interface DashboardState {
  timeWindow:      TimeWindow;
  blockedCount:    number;
  setTimeWindow:   (w: TimeWindow) => void;
  setBlockedCount: (n: number) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  timeWindow:    15,
  blockedCount:  0,

  setTimeWindow:   (w) => set({ timeWindow: w }),
  setBlockedCount: (n) => set({ blockedCount: n }),
}));
