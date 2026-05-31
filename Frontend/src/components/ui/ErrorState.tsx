import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?:   string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * ErrorState — shown when a React Query hook enters error state.
 * Preserves the existing dark glass aesthetic.
 */
export default function ErrorState({
  title   = 'Data Unavailable',
  message = 'Could not reach the Reqtrol backend. Start the server and refresh.',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            compact ? 8 : 16,
        padding:        compact ? '20px 16px' : '40px 24px',
        borderRadius:   12,
        background:     'rgba(239,68,68,0.06)',
        border:         '1px solid rgba(239,68,68,0.18)',
        textAlign:      'center',
        width:          '100%',
        boxSizing:      'border-box',
      }}
    >
      <div style={{
        width: compact ? 32 : 44, height: compact ? 32 : 44,
        borderRadius: '50%', background: 'rgba(239,68,68,0.12)',
        border: '1.5px solid rgba(239,68,68,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 18px rgba(239,68,68,0.18)',
      }}>
        <AlertTriangle size={compact ? 16 : 20} color="#ef4444" />
      </div>
      <div>
        <div style={{ fontSize: compact ? 12 : 14, fontWeight: 600, color: '#fca5a5', marginBottom: 4 }}>{title}</div>
        {!compact && (
          <div style={{ fontSize: 11, color: '#64748b', maxWidth: 320, lineHeight: 1.5 }}>{message}</div>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#fca5a5', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <RefreshCw size={11} /> Retry
        </button>
      )}
    </motion.div>
  );
}
