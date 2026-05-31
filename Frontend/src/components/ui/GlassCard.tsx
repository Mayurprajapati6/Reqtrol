import React from 'react';

interface GlassCardProps {
  children:  React.ReactNode;
  className?: string;
  style?:     React.CSSProperties;
  accent?:    string;         // optional top-border accent color
  hover?:     boolean;        // enable hover glow
  glowColor?: string;         // rgba glow color
  padding?:   string | number;
  onClick?:   () => void;
}

export default function GlassCard({
  children, className, style, accent,
  hover = true, glowColor = 'rgba(59,130,246,0.15)',
  padding = '18px', onClick,
}: GlassCardProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={{
        background: 'rgba(15,26,46,0.8)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${hovered && hover ? 'rgba(59,130,246,0.20)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14,
        padding,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered && hover ? `0 0 40px ${glowColor}` : '0 4px 24px rgba(0,0,0,0.3)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {/* Accent top border */}
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent)`,
        }} />
      )}

      {/* Subtle inner glow on hover */}
      {hover && hovered && (
        <div style={{
          position: 'absolute', top: -60, left: -20,
          width: 140, height: 140,
          background: glowColor,
          borderRadius: '50%', filter: 'blur(40px)',
          pointerEvents: 'none', opacity: 0.5,
        }} />
      )}

      {children}
    </div>
  );
}
