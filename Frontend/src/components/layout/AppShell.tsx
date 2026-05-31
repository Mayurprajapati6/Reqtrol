import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';
import { useUIStore } from '@/store';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #050816 0%, #0b1023 50%, #020617 100%)',
        position: 'relative',
      }}
    >
      {/* ── Background ambient — static CSS, no JS animation ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '10%', left: '15%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', top: '50%', right: '10%',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(50px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', left: '40%',
          width: 350, height: 350,
          background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(55px)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />
      </div>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 40,
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ── Desktop Sidebar ── */}
      <div className="desktop-sidebar" style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <Sidebar />
      </div>

      {/* ── Main content area ── */}
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minWidth: 0, position: 'relative', zIndex: 1,
        }}
      >
        <Topbar />
        <MobileNav />
        <main
          data-app-scroll
          style={{
            flex: 1, overflow: 'auto',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
