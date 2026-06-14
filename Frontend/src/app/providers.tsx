import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { queryClient } from '@/lib/queryClient';
import { warmupBackend } from '@/api/client';
import AppRoutes from './routes';

// ─── Warm-up overlay ─────────────────────────────────────────────────────────
// Shown on first visit when the Render backend is sleeping (free tier).
// Disappears once /health responds (or after 30s timeout).
function WarmupOverlay() {
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const dotsInterval = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500);
    const elapsedInterval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(dotsInterval);
      clearInterval(elapsedInterval);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #020817, #0a0f1e, #050816)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24, fontFamily: "'Inter', 'Outfit', sans-serif",
    }}>
      {/* Pulsing logo ring */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid rgba(6,182,212,0.3)',
          animation: 'warmup-spin 2s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 8, borderRadius: '50%',
          border: '2px solid rgba(99,102,241,0.5)',
          borderTopColor: '#6366f1',
          animation: 'warmup-spin 1.2s linear infinite reverse',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: '#06b6d4', fontSize: 28,
        }}>⚡</div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f8fafc', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
          Server warming up{dots}
        </div>
        <div style={{ color: 'rgba(148,163,184,0.7)', fontSize: 13, maxWidth: 320, lineHeight: 1.6 }}>
          The backend is starting up. This only happens on the first visit and takes ~20 seconds.
        </div>
        {elapsed > 5 && (
          <div style={{
            marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7,
            color: 'rgba(148,163,184,0.5)', fontSize: 11,
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 999,
            padding: '4px 12px', background: 'rgba(255,255,255,0.03)',
          }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b', animation: 'warmup-pulse 1s ease-in-out infinite' }} />
            {elapsed}s elapsed
          </div>
        )}
      </div>

      <style>{`
        @keyframes warmup-spin { to { transform: rotate(360deg); } }
        @keyframes warmup-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

export default function Providers() {
  // isWarming: true = still waiting for health check, false = ready
  const [isWarming, setIsWarming] = useState(() => {
    // Only show the overlay when deployed (not localhost)
    return !window.location.hostname.includes('localhost') &&
           !window.location.hostname.includes('127.0.0.1');
  });

  useEffect(() => {
    if (!isWarming) return;
    warmupBackend(30_000).finally(() => {
      setIsWarming(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        {isWarming && <WarmupOverlay />}
        <AppRoutes />
      </QueryClientProvider>
    </MotionConfig>
  );
}
