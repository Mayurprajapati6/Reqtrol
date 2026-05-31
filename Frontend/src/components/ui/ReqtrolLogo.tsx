/**
 * ReqtrolLogo
 * -----------
 * Single source of truth for the Reqtrol brand mark.
 *
 * THE MARK: A shield containing a live ECG/heartbeat pulse.
 * - Shield  = protection, enforcement, rate-limit control
 * - Pulse   = real-time traffic monitoring, live API heartbeat
 * - Spike   = a request burst hitting the rate limit threshold
 * - Flat    = controlled, limited output after the gate
 *
 * Props:
 *   size         — icon box size in px (default 34)
 *   showWordmark — show "Reqtrol" + tagline beside icon
 *   inAvatar     — render as a circle (topbar avatar pill)
 *   animated     — framer-motion hover scale (default true)
 */

import { motion } from 'framer-motion';

interface ReqtrolLogoProps {
  size?: number;
  showWordmark?: boolean;
  inAvatar?: boolean;
  animated?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export default function ReqtrolLogo({
  size = 34,
  showWordmark = false,
  inAvatar = false,
  animated = true,
  style,
  className,
}: ReqtrolLogoProps) {
  const uid = 'rq';
  const borderR = inAvatar ? '50%' : `${Math.round(size * 0.26)}px`;

  // SVG internal canvas is always 140×140 — scaled via width/height props
  const IconSVG = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 140 140"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        {/* Brand gradient: electric cyan → vivid violet */}
        <linearGradient id={`${uid}-brand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>

        {/* Pulse wave: fades in/out on the ends */}
        <linearGradient id={`${uid}-wave`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#00d4ff" stopOpacity="0" />
          <stop offset="25%"  stopColor="#00d4ff" stopOpacity="0.95" />
          <stop offset="65%"  stopColor="#7c3aed" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>

        {/* Shield face — deep dark */}
        <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0d2040" />
          <stop offset="100%" stopColor="#060c1a" />
        </linearGradient>

        {/* Outer glow filter */}
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Small glow for pulse line */}
        <filter id={`${uid}-glow-sm`} x="-15%" y="-40%" width="130%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Rounded square bg (or circle for avatar) ── */}
      <rect
        width="140" height="140"
        rx={inAvatar ? 70 : 28}
        fill="#080e1e"
      />

      {/* ── Outer glow ring ── */}
      <ellipse cx="70" cy="72"
        rx="52" ry="58"
        fill="none"
        stroke={`url(#${uid}-brand)`}
        strokeWidth="1"
        opacity="0.18"
        filter={`url(#${uid}-glow)`}
      />

      {/* ── SHIELD BODY ── */}
      <path
        d="M 70 18 L 118 36 L 118 82 Q 118 122 70 138 Q 22 122 22 82 L 22 36 Z"
        fill={`url(#${uid}-face)`}
        stroke={`url(#${uid}-brand)`}
        strokeWidth="2.5"
        filter={`url(#${uid}-glow-sm)`}
      />

      {/* Shield inner inset (depth layer) */}
      <path
        d="M 70 28 L 108 43 L 108 81 Q 108 114 70 128 Q 32 114 32 81 L 32 43 Z"
        fill="rgba(4,8,20,0.55)"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1"
      />

      {/* ── PRECISION CORNER BRACKETS ── */}
      {/* top-left */}
      <path d="M 33 55 L 33 44 L 44 44"
        fill="none" stroke="#00d4ff" strokeWidth="1.5"
        strokeLinecap="round" opacity="0.65" />
      {/* top-right */}
      <path d="M 107 55 L 107 44 L 96 44"
        fill="none" stroke="#7c3aed" strokeWidth="1.5"
        strokeLinecap="round" opacity="0.65" />

      {/* ── RATE-LIMIT THRESHOLD LINE (dashed) ── */}
      <line x1="36" y1="62" x2="104" y2="62"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
        strokeDasharray="3 3" />

      {/* ── THE PULSE / ECG WAVE ── */}
      {/*
        Flat → small bump → sharp spike (request burst) →
        sharp drop → recovery bump → flat
        The spike tip kisses the threshold line = rate limit hit
      */}
      <polyline
        points="
          26,88
          38,88
          46,88
          52,80
          57,62
          63,116
          70,62
          76,88
          83,84
          87,92
          92,88
          114,88
        "
        fill="none"
        stroke={`url(#${uid}-wave)`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${uid}-glow-sm)`}
      />

      {/* Peak glow dots at spike tips */}
      <circle cx="57" cy="62" r="3.5" fill="#00d4ff"
        filter={`url(#${uid}-glow)`} />
      <circle cx="70" cy="62" r="3.5" fill="#7c3aed"
        filter={`url(#${uid}-glow)`} />

      {/* ── BOTTOM CENTER DOT ── */}
      <circle cx="70" cy="108" r="2.5"
        fill={`url(#${uid}-brand)`} opacity="0.5" />
      <circle cx="70" cy="108" r="5"
        fill="none"
        stroke={`url(#${uid}-brand)`}
        strokeWidth="0.8"
        opacity="0.25" />
    </svg>
  );

  const shadow = `0 0 ${Math.round(size * 0.7)}px rgba(0,212,255,0.22), 0 0 ${Math.round(size * 0.35)}px rgba(124,58,237,0.18)`;

  const iconEl = animated ? (
    <motion.div
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{ flexShrink: 0, lineHeight: 0, borderRadius: borderR, boxShadow: shadow }}
    >
      {IconSVG}
    </motion.div>
  ) : (
    <div style={{ flexShrink: 0, lineHeight: 0, borderRadius: borderR, boxShadow: shadow }}>
      {IconSVG}
    </div>
  );

  if (inAvatar) {
    return (
      <div className={className} style={style}>
        {iconEl}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(size * 0.32),
        ...style,
      }}
    >
      {iconEl}

      {showWordmark && (
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{
            fontSize: Math.round(size * 0.44),
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <span style={{ color: '#f0f6ff' }}>Req</span>
            <span style={{
              background: 'linear-gradient(90deg, #00d4ff, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>trol</span>
          </div>
          <div style={{
            fontSize: Math.round(size * 0.27),
            color: '#1e3a5a',
            marginTop: Math.round(size * 0.06),
            letterSpacing: '0.08em',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            Rate Limiting Intelligence
          </div>
        </div>
      )}
    </div>
  );
}
