import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useUIStore } from '@/store';
import { getISTTime, getISTDate } from '@/lib/utils';
import ReqtrolLogo from '@/components/ui/ReqtrolLogo';

const PAGE_LABELS: Record<string, { title: string; subtitle: string }> = {
  '/':             { title: 'Dashboard',          subtitle: 'Real-time overview of request traffic and limiter analytics.' },
  '/live':         { title: 'Live Feed',           subtitle: 'Real-time stream of all incoming requests and decisions.' },
  '/rate-limiters':{ title: 'Rate Limiters',       subtitle: 'Current Redis window pressure and stored limiter decisions.' },
  '/endpoints':    { title: 'Endpoint Analytics',  subtitle: 'Historical request pressure and endpoint performance.' },
  '/users':        { title: 'User Activity',       subtitle: 'User-level request patterns and block history.' },
  '/redis':        { title: 'Redis Monitor',       subtitle: 'Redis connection health, memory, and limiter key metrics.' },
  '/simulator':    { title: 'Simulator',           subtitle: 'Manual backend traffic check through Reqtrol APIs.' },
  '/integration':  { title: 'Integration Flow',    subtitle: 'Blueprint of the Quby to Reqtrol limiter pipeline.' },
  '/settings':     { title: 'Settings',            subtitle: 'System configuration and preferences.' },
};

export default function Topbar() {
  const location = useLocation();
  const { toggleSidebar } = useUIStore();
  const [time, setTime] = useState(getISTTime());
  const [date, setDate] = useState(getISTDate());
  const meta = PAGE_LABELS[location.pathname] ?? PAGE_LABELS['/'];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(getISTTime());
      setDate(getISTDate());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div style={{
      height: 56, flexShrink: 0,
      background: 'rgba(8,13,26,0.75)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12,
    }}>
      {/* Mobile menu */}
      <button onClick={toggleSidebar} className="mobile-menu-btn"
        style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
        <Menu size={18} />
      </button>

      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meta.subtitle}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

        {/* LIVE indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.10)',
          border: '1px solid rgba(16,185,129,0.20)',
          borderRadius: 20, padding: '5px 12px',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: '0.05em' }}>LIVE</span>
        </div>

        {/* IST Clock */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', fontFamily: "'JetBrains Mono',monospace" }}>
            {time} IST
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>{date}</div>
        </div>

        {/* Avatar pill with ReqtrolLogo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '5px 12px',
        }}>
          <ReqtrolLogo size={28} inAvatar animated={false} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', lineHeight: 1 }}>Reqtrol</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Admin</div>
          </div>
        </div>

      </div>
    </div>
  );
}
