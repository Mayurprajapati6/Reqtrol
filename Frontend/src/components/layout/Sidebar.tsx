import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Activity, ShieldCheck, GitBranch, Users,
  Database, Zap, GitMerge, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useUIStore } from '@/store';
import ReqtrolLogo from '@/components/ui/ReqtrolLogo';

interface NavItem {
  path:  string;
  icon:  React.ElementType;
  label: string;
  badge?: 'live';
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { path: '/',          icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/live',      icon: Activity,        label: 'Live Feed', badge: 'live' },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { path: '/rate-limiters', icon: ShieldCheck, label: 'Rate Limiters' },
      { path: '/endpoints',     icon: GitBranch,   label: 'Endpoint Analytics' },
      { path: '/users',         icon: Users,       label: 'User Activity' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { path: '/simulator',   icon: Zap,       label: 'Simulator' },
      { path: '/integration', icon: GitMerge,  label: 'Integration Flow' },
      { path: '/settings',    icon: Settings,  label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebarCollapse, sidebarOpen } = useUIStore();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <motion.div
      className="app-sidebar"
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        height: '100%',
        background: 'rgba(8,13,26,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'visible',
        position: 'relative',
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        padding: sidebarCollapsed ? '18px 0' : '18px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* ✅ NEW: ReqtrolLogo replaces ShieldCheck icon + old wordmark div */}
        <ReqtrolLogo
          size={34}
          showWordmark={!sidebarCollapsed}
          animated
        />

        {/* Collapse toggle */}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebarCollapse}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, padding: '4px',
              cursor: 'pointer', color: '#475569',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            title="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* ── Expand button (collapsed state) ── */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebarCollapse}
          style={{
            position: 'absolute', right: -12, top: 22,
            background: 'rgba(8,13,26,0.9)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '50%', width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#64748b',
            zIndex: 120, flexShrink: 0,
          }}
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* ── Navigation ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 0' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 2 }}>
            {/* Section label */}
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                    textTransform: 'uppercase', color: '#334155',
                    padding: '10px 20px 5px',
                  }}
                >
                  {section}
                </motion.div>
              )}
            </AnimatePresence>

            {items.map(({ path, icon: Icon, label, badge }) => {
              const active = isActive(path);
              return (
                <div key={path} style={{ position: 'relative', padding: sidebarCollapsed ? '2px 8px' : '2px 10px' }}>
                  {/* Active background */}
                  {active && (
                    <motion.div
                      layoutId="active-bg"
                      style={{
                        position: 'absolute', inset: '0 6px',
                        background: 'rgba(59,130,246,0.12)',
                        borderRadius: 10,
                        border: '1px solid rgba(59,130,246,0.18)',
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  )}

                  <button
                    onClick={() => navigate(path)}
                    title={sidebarCollapsed ? label : undefined}
                    style={{
                      position: 'relative', zIndex: 1,
                      display: 'flex', alignItems: 'center',
                      gap: 10, width: '100%',
                      padding: sidebarCollapsed ? '9px 0' : '9px 10px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderRadius: 10,
                      color: active ? '#f1f5f9' : '#64748b',
                      fontSize: 13, fontWeight: active ? 500 : 400,
                      fontFamily: "'Inter', sans-serif",
                      textAlign: 'left',
                      transition: 'color 0.15s',
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.color = '#64748b';
                    }}
                  >
                    <Icon
                      size={15}
                      color={active ? '#3b82f6' : 'currentColor'}
                      strokeWidth={active ? 2 : 1.5}
                      style={{ flexShrink: 0 }}
                    />

                    <AnimatePresence>
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* LIVE badge */}
                    {badge === 'live' && !sidebarCollapsed && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                        background: 'rgba(16,185,129,0.15)',
                        color: '#10b981', padding: '2px 7px',
                        borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)',
                        flexShrink: 0,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 2s infinite' }} />
                        LIVE
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom version */}
      <div style={{
        padding: sidebarCollapsed ? '10px 0' : '10px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        gap: 6, flexShrink: 0,
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
        {!sidebarCollapsed && (
          <span style={{ fontSize: 10, color: '#334155' }}>v1.0.0 · Reqtrol</span>
        )}
      </div>
    </motion.div>
  );
}
