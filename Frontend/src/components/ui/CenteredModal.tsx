import React from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface CenteredModalProps {
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: number;
}

function CenteredModalInner({
  title,
  subtitle,
  accent = '#3b82f6',
  children,
  onClose,
  maxWidth = 840,
}: CenteredModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth,
          background: 'rgba(8,13,26,0.98)',
          border: `1px solid ${accent}35`,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: `0 0 80px ${accent}25, 0 40px 100px rgba(0,0,0,0.8)`,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{
          padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${accent}22`,
          background: `linear-gradient(90deg, ${accent}12, transparent)`,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono',monospace", marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#64748b', display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export default function CenteredModal(props: CenteredModalProps) {
  if (typeof document === 'undefined') return <CenteredModalInner {...props} />;
  return createPortal(<CenteredModalInner {...props} />, document.body);
}

