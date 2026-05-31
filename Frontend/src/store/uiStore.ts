import { create } from 'zustand';

interface UIState {
  sidebarOpen:      boolean;
  sidebarCollapsed: boolean;
  searchOpen:       boolean;
  setSidebarOpen:       (open: boolean) => void;
  toggleSidebar:        () => void;
  setSidebarCollapsed:  (collapsed: boolean) => void;
  toggleSidebarCollapse: () => void;
  setSearchOpen:        (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen:      false,
  sidebarCollapsed: false,
  searchOpen:       false,

  setSidebarOpen:   (open)      => set({ sidebarOpen: open }),
  toggleSidebar:    ()          => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarCollapsed: (c)      => set({ sidebarCollapsed: c }),
  toggleSidebarCollapse: ()     => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSearchOpen:    (open)      => set({ searchOpen: open }),
}));
