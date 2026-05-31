import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Activity, ShieldCheck, GitBranch, Users,
  Database, Zap, GitMerge, Settings,
} from 'lucide-react';

interface NavItem {
  path:  string;
  icon:  React.ElementType;
  label: string;
  badge?: 'live';
}

const NAV: NavItem[] = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/live',      icon: Activity,        label: 'Live Feed', badge: 'live' },
  { path: '/rate-limiters', icon: ShieldCheck, label: 'Rate Limiters' },
  { path: '/endpoints',     icon: GitBranch,   label: 'Endpoints' },
  { path: '/users',         icon: Users,       label: 'Users' },
  { path: '/redis',         icon: Database,    label: 'Redis' },
  { path: '/simulator',     icon: Zap,         label: 'Simulator' },
  { path: '/integration',   icon: GitMerge,    label: 'Integration' },
  { path: '/settings',      icon: Settings,    label: 'Settings' },
];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="mobile-nav" style={{
      flexShrink: 0,
      background: 'rgba(8,13,26,0.85)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      overflowX: 'auto',
      overflowY: 'hidden',
      whiteSpace: 'nowrap',
      padding: '0 16px',
      display: 'flex',
      gap: 8,
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      <style>{`
        .mobile-nav::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {NAV.map(({ path, icon: Icon, label, badge }) => {
        const active = isActive(path);
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: active ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              color: active ? '#f1f5f9' : '#64748b',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            <Icon size={14} strokeWidth={active ? 2 : 1.5} />
            <span>{label}</span>
            {badge === 'live' && (
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse-dot 2s infinite',
                flexShrink: 0,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
