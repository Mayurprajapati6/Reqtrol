/** Reqtrol Design Token Constants — reference these in JS/TS components */

export const COLORS = {
  /* Backgrounds */
  bgBase:     '#050816',
  bgSurface:  '#080d1a',
  bgElevated: '#0d1526',
  bgCard:     '#0f1a2e',
  bgHover:    '#142035',

  /* Accent palette */
  cyan:    '#06b6d4',
  blue:    '#3b82f6',
  emerald: '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
  purple:  '#a855f7',
  violet:  '#8b5cf6',
  pink:    '#ec4899',

  /* Text scale */
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',
  textFaint:     '#334155',

  /* Borders */
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderLight:  'rgba(255,255,255,0.10)',
  borderMedium: 'rgba(255,255,255,0.16)',
} as const;

export const GRADIENTS = {
  cyan:    'linear-gradient(135deg, #06b6d4, #3b82f6)',
  emerald: 'linear-gradient(135deg, #10b981, #059669)',
  red:     'linear-gradient(135deg, #ef4444, #dc2626)',
  purple:  'linear-gradient(135deg, #a855f7, #8b5cf6)',
  amber:   'linear-gradient(135deg, #f59e0b, #d97706)',
  blue:    'linear-gradient(135deg, #3b82f6, #2563eb)',
  global:  'linear-gradient(135deg, #050816 0%, #0b1023 50%, #020617 100%)',
} as const;

export const GLOWS = {
  blue:    '0 0 40px rgba(59,130,246,0.15)',
  cyan:    '0 0 40px rgba(6,182,212,0.15)',
  emerald: '0 0 40px rgba(16,185,129,0.15)',
  red:     '0 0 40px rgba(239,68,68,0.15)',
  purple:  '0 0 40px rgba(168,85,247,0.15)',
  amber:   '0 0 40px rgba(245,158,11,0.15)',
} as const;

export const SHADOWS = {
  card:    '0 4px 24px rgba(0,0,0,0.4)',
  modal:   '0 24px 80px rgba(0,0,0,0.7)',
  tooltip: '0 12px 40px rgba(0,0,0,0.8)',
} as const;

export const GLASS = {
  bg:     'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  blur:   'blur(24px)',
} as const;

/** Chart tooltip base style */
export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background:   '#080d1a',
  border:       '1px solid rgba(59,130,246,0.22)',
  borderRadius: '10px',
  fontSize:     12,
  color:        '#f1f5f9',
  boxShadow:    '0 12px 40px rgba(0,0,0,0.8)',
  padding:      '12px 16px',
  fontFamily:   "'Inter', sans-serif",
};

/** Recharts cartesian grid style */
export const CHART_GRID_STYLE = {
  strokeDasharray: '3 3',
  stroke:          'rgba(255,255,255,0.04)',
};

/** Common axis tick style */
export const AXIS_TICK_STYLE = {
  fill:     '#334155',
  fontSize: 10,
  fontFamily: "'Inter', sans-serif",
};
