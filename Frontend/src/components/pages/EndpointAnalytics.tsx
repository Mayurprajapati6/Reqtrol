import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Calendar, Gauge, GitBranch, Server, ShieldCheck } from 'lucide-react';

import { useEndpointCards, useEndpointHeatmap } from '@/hooks/useEndpoints';
import AnimatedBadge from '@/components/ui/AnimatedBadge';
import CenteredModal from '@/components/ui/CenteredModal';
import DataTable from '@/components/ui/DataTable';
import DarkTooltip from '@/components/charts/DarkTooltip';
import { SkeletonChartFrame, SkeletonEndpointCard, SkeletonTableRows } from '@/components/ui/SkeletonBlock';
import { useInitialQueryHydration } from '@/hooks/queryPolicy';
import { formatNumber, getISTDate } from '@/lib/utils';
import type { EndpointCardData, HeatmapRow } from '@/types/analytics.types';



// ─── Heatmap hours ─────────────────────────────────────────────────────────────
// Always show the full day: 00 through 23 IST. The X-axis represents the
// complete 24-hour range so users can compare any hour against any endpoint.
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

// ─── Date Picker Component ─────────────────────────────────────────────────────
const HeatmapDatePicker = memo(function HeatmapDatePicker({ value, onChange }: { value: string | undefined; onChange: (date: string | undefined) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const today = getISTDate();
  
  // Convert DD-MM-YYYY to Date object
  const parseDate = (dateStr: string): Date => {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 2) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date();
  };
  
  // Convert Date to DD-MM-YYYY
  const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };
  
  const displayDate = value || formatDate(new Date());
  
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
  };
  
  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.year, currentMonth.month, day);
    onChange(formatDate(newDate));
    setIsOpen(false);
  };
  
  const handlePreviousMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInMonth = getDaysInMonth(currentMonth.year, currentMonth.month);
  const firstDay = getFirstDayOfMonth(currentMonth.year, currentMonth.month);
  const todayDate = new Date();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [popupCoords, setPopupCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node) && triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const minWidth = 280;
      let left = rect.right - minWidth;
      if (left < 8) left = rect.left;
      if (left + minWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - minWidth - 8);
      const top = rect.bottom + 8;
      setPopupCoords({ top, left });
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const minWidth = 280;
      let left = rect.right - minWidth;
      if (left < 8) left = rect.left;
      if (left + minWidth > window.innerWidth - 8) left = Math.max(8, window.innerWidth - minWidth - 8);
      const top = rect.bottom + 8;
      setPopupCoords({ top, left });
    };

    updatePosition();
    const ro = new ResizeObserver(updatePosition);
    ro.observe(document.body);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);
  
  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px',
          background: '#080d1a',
          border: '1px solid rgba(6,182,212,0.25)',
          borderRadius: 8,
          height: 38,
          color: '#cbd5e1',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Calendar size={16} color="#06b6d4" />
        <span style={{ color: '#06b6d4' }}>{displayDate}</span>
      </div>
      
      {isOpen && createPortal(
        <div
          ref={wrapperRef}
          style={{
            position: 'fixed',
            top: popupCoords ? popupCoords.top : '50px',
            left: popupCoords ? popupCoords.left : '50px',
            background: '#080d1a',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 8,
            padding: 12,
            zIndex: 100,
            minWidth: 280,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            overflowY: 'auto',
            maxHeight: '420px',
            overscrollBehavior: 'contain',
          }}
          onWheel={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {/* Month Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button
              onClick={handlePreviousMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
              }}
            >
              ←
            </button>
            <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
              {monthNames[currentMonth.month]} {currentMonth.year}
            </span>
            <button
              onClick={handleNextMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
              }}
            >
              →
            </button>
          </div>
          
          {/* Day Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = value && formatDate(new Date(currentMonth.year, currentMonth.month, day)) === value;
              const isToday = day === todayDate.getDate() && currentMonth.month === todayDate.getMonth() && currentMonth.year === todayDate.getFullYear();
              
              return (
                <button
                  key={day}
                  onClick={() => handleDateSelect(day)}
                  style={{
                    background: isSelected ? '#06b6d4' : isToday ? 'rgba(6,182,212,0.15)' : 'transparent',
                    border: isSelected ? '1px solid #06b6d4' : isToday ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    padding: '6px 0',
                    color: isSelected ? '#080d1a' : '#cbd5e1',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(6,182,212,0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isToday ? 'rgba(6,182,212,0.15)' : 'transparent';
                    }
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>, document.body
      )}
    </div>
  );
});

// ─── Helpers ───────────────────────────────────────────────────────────────────
function hasLimiter(card: EndpointCardData): boolean {
  return Boolean(card.limiterName && card.limiterName !== 'No Limiter' && card.limiterName !== '');
}

function healthVariant(health: EndpointCardData['health']): 'allowed' | 'degraded' | 'blocked' {
  if (health === 'critical' || health === 'degraded') return 'blocked';
  if (health === 'warning') return 'degraded';
  return 'allowed';
}

function healthLabel(health: EndpointCardData['health']): string {
  if (health === 'critical') return 'Critical';
  if (health === 'degraded') return 'Degraded';
  if (health === 'warning') return 'Warning';
  return 'Healthy';
}

function densityColor(value: number): string {
  // Reqtrol dark-neon palette for production-grade heatmap
  // 0 requests: No Traffic - #0B1220 (Very dark)
  // 1-10 requests: Low - Blue
  // 11-50 requests: Medium - Cyan
  // 51-100 requests: High - Green
  // 101-200 requests: Very High - Orange
  // 200+ requests: Critical - Red
  if (value <= 0) return '#0B1220';
  if (value <= 10) return 'rgba(59,130,246,0.6)';
  if (value <= 50) return 'rgba(6,182,212,0.7)';
  if (value <= 100) return 'rgba(16,185,129,0.8)';
  if (value <= 200) return 'rgba(245,158,11,0.85)';
  return 'rgba(239,68,68,0.9)';
}

function getTrafficLevel(value: number): string {
  if (value <= 0) return 'No Traffic';
  if (value <= 10) return 'Low';
  if (value <= 50) return 'Medium';
  if (value <= 100) return 'High';
  if (value <= 200) return 'Very High';
  return 'Critical';
}

// ─── Panel wrapper ─────────────────────────────────────────────────────────────
const Panel = memo(function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{
      background: 'rgba(8,13,26,0.90)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      overflow: 'hidden',
      minHeight: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(2,6,23,0.45)',
      }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      {children}
    </section>
  );
});

// ─── Small metric tile inside an endpoint card ─────────────────────────────────
const Metric = memo(function Metric({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7, padding: '8px 9px', minWidth: 0 }}>
      <div style={{ color: '#475569', fontSize: 9, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 12, fontWeight: 800 }}>{value}</div>
      {hint && <div style={{ color: '#334155', fontSize: 8, marginTop: 3, lineHeight: 1.3 }}>{hint}</div>}
    </div>
  );
});

// ─── Endpoint card ─────────────────────────────────────────────────────────────
const EndpointCard = memo(function EndpointCard({ card }: { card: EndpointCardData }) {
  const withRateLimiter = hasLimiter(card);
  return (
    <div style={{
      background: 'rgba(5,8,22,0.78)',
      border: `1px solid ${card.color}30`,
      borderRadius: 8,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 190,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 7,
              background: `${card.color}18`, border: `1px solid ${card.color}35`,
              color: card.color, display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 900, fontSize: 12,
            }}>
              {card.icon}
            </span>
            <span style={{ color: card.color, fontSize: 13, fontWeight: 850, fontFamily: "'JetBrains Mono',monospace" }}>
              {card.path}
            </span>
          </div>
          <div style={{ color: '#64748b', fontSize: 10 }}>{card.label}</div>
        </div>
        <AnimatedBadge variant={healthVariant(card.health)} label={healthLabel(card.health)} />
      </div>

      <div>
        <div style={{ color: '#f1f5f9', fontSize: 30, fontWeight: 850, lineHeight: 1 }}>
          {formatNumber(card.requests)}
        </div>
        <div style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>
          total requests
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Metric
          label="Block Rate"
          value={`${card.blockRate.toFixed(1)}%`}
          color={card.blockRate >= 10 ? '#ef4444' : '#10b981'}
          hint="Blocked ÷ Total Requests"
        />
        <Metric
          label="Avg Latency"
          value={`${card.avgMs}ms`}
          color={card.avgMs >= 250 ? '#f59e0b' : '#cbd5e1'}
        />
        {/* Only show limiter usage if endpoint actually has a limiter */}
        {withRateLimiter ? (
          <Metric
            label="Current Window"
            value={`${card.limiterUsagePct !== undefined && card.limiterUsagePct !== null ? card.limiterUsagePct.toFixed(1) : '0'}%`}
            color={(card.limiterUsagePct ?? 0) >= 70 ? '#f59e0b' : '#cbd5e1'}
            hint="Current limiter window used"
          />
        ) : (
          <Metric
            label="Limiter"
            value="No Limiter"
            color="#475569"
            hint="Endpoint bypasses rate limiting"
          />
        )}
        <Metric
          label={withRateLimiter ? 'Limiter Rule' : 'Status'}
          value={withRateLimiter ? (card.limiterName || 'No Limiter') : 'Unrestricted'}
          color={withRateLimiter ? '#8b5cf6' : '#475569'}
        />
      </div>
    </div>
  );
});

// ─── Heatmap ───────────────────────────────────────────────────────────────────
const EndpointHeatmap = memo(function EndpointHeatmap({ rows, selectedDate, onDateChange, isLoading }: { rows: HeatmapRow[]; selectedDate: string | undefined; onDateChange: (date: string | undefined) => void; isLoading: boolean }) {
  const [heatTooltip, setHeatTooltip] = useState<{ visible: boolean; x: number; y: number; endpoint?: string; hour?: string; value?: number }>({ visible: false, x: 0, y: 0 });
  
  const totalRequests = useMemo(() => {
    return rows.reduce((sum, row) => {
      return sum + Object.values(row.values).reduce((hourSum, val) => hourSum + val, 0);
    }, 0);
  }, [rows]);

  const formatDateForDisplay = useCallback((date: string | undefined): string => {
    if (!date) return 'Today';
    const parts = date.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD to DD-MM-YYYY
    }
    return date;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHeatTooltip({ visible: false, x: 0, y: 0 });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!el) return;
    const row = el.closest('[data-heat-row]') as HTMLElement | null;
    if (row?.dataset?.heatRow && row.dataset.heatHour) {
      setHeatTooltip({ visible: true, x: e.clientX, y: e.clientY, endpoint: row.dataset.heatRow, hour: row.dataset.heatHour, value: Number(row.dataset.heatValue ?? '0') });
      return;
    }
    setHeatTooltip({ visible: false, x: 0, y: 0 });
  }, []);

  return (
    <div style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(8,13,26,0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
        }}>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>Loading heatmap data...</div>
        </div>
      )}
      
      {/* Header with metadata */}
      <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginBottom: 2 }}>REQUEST DENSITY HEATMAP</h3>
            <div style={{ fontSize: 11, color: '#64748b' }}><span style={{ color: '#475569', fontWeight: 600 }}>Total Requests:</span> {formatNumber(totalRequests)}</div>
          </div>
          <HeatmapDatePicker value={selectedDate} onChange={onDateChange} />
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
        <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginRight: 8 }}>Traffic Density</span>
        {[
          { label: 'No Traffic', color: '#0B1220' },
          { label: 'Low', color: 'rgba(59,130,246,0.6)' },
          { label: 'Medium', color: 'rgba(6,182,212,0.7)' },
          { label: 'High', color: 'rgba(16,185,129,0.8)' },
          { label: 'Very High', color: 'rgba(245,158,11,0.85)' },
          { label: 'Critical', color: 'rgba(239,68,68,0.9)' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color, border: '1px solid rgba(255,255,255,0.1)' }} />
            <span style={{ color: '#94a3b8', fontSize: 10 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {rows.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: 13 }}>
          No traffic recorded for selected date.
        </div>
      )}

      {/* Skeleton grid for loading state */}
      {isLoading && (
        <div style={{ opacity: 0.5 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(24, minmax(0, 1fr))', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Hours</div>
            {HOURS.map((hour) => (
              <div key={hour} style={{ color: '#64748b', fontSize: 11, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap' }}>
                {hour.slice(0, 2)}
              </div>
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div key={rowIndex} style={{ display: 'grid', gridTemplateColumns: '140px repeat(24, minmax(0, 1fr))', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <div style={{ height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  style={{ height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.05)', animation: 'shimmer 1.5s ease-in-out infinite' }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', opacity: isLoading ? 0.3 : 1, transition: 'opacity 0.2s ease' }}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(24, minmax(0, 1fr))', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 800 }}>Hours</div>
          {HOURS.map((hour) => (
            <div key={hour} style={{ color: '#64748b', fontSize: 11, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap' }}>
              {hour.slice(0, 2)}
            </div>
          ))}
        </div>
        {rows.map(row => (
          <div key={row.hour} style={{ display: 'grid', gridTemplateColumns: '140px repeat(24, minmax(0, 1fr))', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: 12, fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8, paddingLeft: 6 }}>
              {row.hour}
            </div>
            {HOURS.map(hour => {
              const value = row.values[hour] ?? 0;
              return (
                <div
                  key={hour}
                  data-heat-row={row.hour}
                  data-heat-hour={hour}
                  data-heat-value={String(value)}
                  style={{ height: 18, borderRadius: 4, background: densityColor(value), transition: 'transform 0.06s ease' }}
                />
              );
            })}
          </div>
        ))}
      </div>

     

      {heatTooltip.visible && createPortal(
        <div style={{ position: 'fixed', left: heatTooltip.x + 12, top: heatTooltip.y + 12, zIndex: 2147483647, pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(5,8,22,0.96)',
            border: '1px solid rgba(6,182,212,0.35)',
            borderRadius: 8,
            boxShadow: '0 18px 50px rgba(0,0,0,0.65), 0 0 24px rgba(6,182,212,0.12)',
            padding: '10px 12px',
            color: '#e2e8f0',
            fontSize: 11,
            minWidth: 200,
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
          }}>
            <div style={{ color: '#06b6d4', fontWeight: 800, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{heatTooltip.endpoint}</div>
            <div style={{ color: '#94a3b8', marginBottom: 6, fontSize: 10 }}>Date: {formatDateForDisplay(selectedDate)}</div>
            <div style={{ color: '#94a3b8', marginBottom: 6, fontSize: 10 }}>Hour: {heatTooltip.hour} → {heatTooltip.hour?.replace(':00', ':59')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: '#94a3b8' }}>Requests:</span><span style={{ color: '#f8fafc', fontWeight: 800 }}>{String(heatTooltip.value ?? 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: '#94a3b8' }}>Traffic Level:</span><span style={{ color: '#f8fafc', fontWeight: 800 }}>{getTrafficLevel(heatTooltip.value ?? 0)}</span></div>
          </div>
        </div>, document.body
      )}
    </div>
  );
});

// ─── Full ranking modal ────────────────────────────────────────────────────────
const FullRankingModal = memo(function FullRankingModal({ rows, onClose }: { rows: EndpointCardData[]; onClose: () => void }) {
  return (
    <CenteredModal title="Full Endpoint Ranking" subtitle="Global historical endpoint analytics" onClose={onClose} maxWidth={1040} accent="#06b6d4">
      <div style={{ padding: 18 }}>
        <DataTable
          data={rows}
          keyField="id"
          maxHeight={520}
          stickyHeader
          columns={[
            { key: 'path', header: 'Endpoint' },
            { key: 'requests', header: 'Total Requests', width: 120, align: 'right', render: row => formatNumber(row.requests) },
            { key: 'allowed', header: 'Allowed', width: 100, align: 'right', render: row => <span style={{ color: '#10b981', fontWeight: 700 }}>{formatNumber(row.allowed)}</span> },
            { key: 'blocked', header: 'Blocked', width: 100, align: 'right', render: row => <span style={{ color: row.blocked > 0 ? '#ef4444' : '#64748b', fontWeight: 700 }}>{formatNumber(row.blocked)}</span> },
            { key: 'blockRate', header: 'Block Rate', width: 100, align: 'right', render: row => (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: row.blockRate >= 10 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{row.blockRate.toFixed(1)}%</div>
                <div style={{ color: '#475569', fontSize: 9 }}>Blocked ÷ Total</div>
              </div>
            )},
            { key: 'avgMs', header: 'Avg Latency', width: 110, align: 'right', render: row => `${row.avgMs}ms` },
            { key: 'limiterName', header: 'Limiter', width: 160, render: row => (
              <span style={{ color: hasLimiter(row) ? '#8b5cf6' : '#475569', fontStyle: hasLimiter(row) ? 'normal' : 'italic' }}>
                {hasLimiter(row) ? row.limiterName : 'No Limiter'}
              </span>
            )},
          ]}
        />
      </div>
    </CenteredModal>
  );
});

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function EndpointAnalytics() {
  const [showRanking, setShowRanking] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const cardsQuery = useEndpointCards();
  const heatmapQuery = useEndpointHeatmap('all', selectedDate);
  const cardsLoading = useInitialQueryHydration([cardsQuery], []);
  const heatmapLoading = useInitialQueryHydration([heatmapQuery], []) || heatmapQuery.isLoading;
  const cards = cardsLoading ? [] : cardsQuery.data ?? [];
  const heatmap = heatmapLoading ? [] : heatmapQuery.data ?? [];

  const ranked = cards;
  const topSix = useMemo(() => Array.from({ length: 6 }, (_, i) => ranked[i] ?? null), [ranked]);
  const totalRequests = useMemo(() => cards.reduce((sum, card) => sum + card.requests, 0), [cards]);
  const latencyData = cards;
  const busiest = ranked;

  // Pressure chart: only endpoints WITH a real limiter (excludes webhook/no-limiter)
  const pressureData = useMemo(() => cards
    .filter(card => hasLimiter(card))
    .map(card => ({
      endpoint: card.path,
      requests: card.requests,
      capacity: card.limiterCapacity ?? 0,
      color: card.color,
    })), [cards]);

  const distribution = useMemo(() => cards.map(card => ({
    name: card.path,
    value: card.distribution,
    requests: card.requests,
    blocked: card.blocked,
    allowed: card.allowed,
    color: card.color,
  })), [cards]);

  const handleDateChange = useCallback((date: string | undefined) => {
    setSelectedDate(date);
  }, []);

  const handleShowRanking = useCallback(() => {
    setShowRanking(true);
  }, []);

  const handleCloseRanking = useCallback(() => {
    setShowRanking(false);
  }, []);

  const [hoverPie, setHoverPie] = useState<number>(-1);
  const [pieTooltip, setPieTooltip] = useState<{ visible: boolean; x: number; y: number; index: number | null }>({ visible: false, x: 0, y: 0, index: null });

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.03em' }}>
          Endpoint Analytics
        </h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
          Global historical traffic, latency, and health per endpoint. Endpoints without a rate limiter show <em style={{ color: '#475569' }}>No Limiter</em> — no saturation metrics apply.
        </p>
      </div>

      {/* ── Endpoint summary cards ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {cardsLoading
          ? Array.from({ length: 6 }, (_, i) => <SkeletonEndpointCard key={i} />)
          : cards.slice(0, 6).map(card => <EndpointCard key={card.id} card={card} />)
        }
      </div>

      {/* ── Heatmap + ranking ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 14, alignItems: 'stretch' }}>
        <Panel title="Request Density Heatmap — Hour of Day" icon={<GitBranch size={14} color="#06b6d4" />}>
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '8px 14px' }}>
              <EndpointHeatmap rows={heatmap} selectedDate={selectedDate} onDateChange={handleDateChange} isLoading={heatmapLoading} />
            </div>
          </div>
        </Panel>

        <Panel title="Endpoint Ranking" icon={<Server size={14} color="#10b981" />}>
          <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {cardsLoading ? <SkeletonTableRows rows={6} height={39} /> : (
              <>
                {topSix.map((card, i) => (
                  <div key={card?.id ?? `empty-${i}`} style={{ display: 'grid', gridTemplateColumns: '26px 1fr 86px', gap: 8, alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', minHeight: 39 }}>
                    <span style={{ color: '#475569', fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    <span style={{ color: card ? '#94a3b8' : '#334155', fontSize: 11, fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card?.path ?? 'No endpoint data'}
                    </span>
                    <span style={{ color: card ? card.color : '#334155', fontSize: 11, fontWeight: 800, textAlign: 'right' }}>
                      {card ? formatNumber(card.requests) : '-'}
                    </span>
                  </div>
                ))}
                <button onClick={handleShowRanking} style={{ width: '100%', marginTop: 8, background: 'transparent', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '8px 0' }}>
                  View Full Ranking
                </button>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Latency + busiest + distribution ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Panel title="Avg Latency Comparison" icon={<Gauge size={14} color="#f59e0b" />}>
          {cardsLoading ? <SkeletonChartFrame height={190} /> : <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyData} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.09)" />
                <XAxis dataKey="path" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-40} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="ms" />
                <Tooltip
                  content={<DarkTooltip metaHints={{ avgMs: 'Average response time for all requests to this endpoint' }} />}
                  wrapperStyle={{ background: 'transparent', boxShadow: 'none' }}
                  contentStyle={{ background: 'transparent' }}
                  cursor={{ fill: 'rgba(6,182,212,0.06)' }}
                />
                <Bar dataKey="avgMs" name="Avg Latency" radius={[5, 5, 0, 0]}>
                  {latencyData.map(row => <Cell key={row.id} fill={row.avgMs >= 500 ? '#ef4444' : row.avgMs >= 250 ? '#f59e0b' : row.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>}
        </Panel>

        <Panel title="Top Busiest Endpoints" icon={<Server size={14} color="#3b82f6" />}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cardsLoading ? <SkeletonTableRows rows={6} height={39} /> : Array.from({ length: 6 }, (_, i) => busiest[i] ?? null).map((card, i) => {
              const pct = card && busiest[0]?.requests ? (card.requests / busiest[0].requests) * 100 : 0;
              return (
                <div key={card?.id ?? `busy-${i}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: card ? '#94a3b8' : '#334155', fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>{card?.path ?? 'No endpoint data'}</span>
                    <span style={{ color: card?.color ?? '#334155', fontSize: 11, fontWeight: 800 }}>{card ? formatNumber(card.requests) : '-'}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: card?.color ?? 'transparent', borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Traffic Distribution" icon={<GitBranch size={14} color="#8b5cf6" />}>
          {cardsLoading ? <SkeletonChartFrame height={228} /> : <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, alignItems: 'center' }}>
            <div
              style={{ position: 'relative', height: 200 }}
              onMouseLeave={() => { setHoverPie(-1); setPieTooltip({ visible: false, x: 0, y: 0, index: null }); }}
              onMouseMove={(e) => {
                const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
                let idx: number | null = null;
                let node = el;
                while (node) {
                  if (node.dataset?.pieIndex !== undefined && node.dataset.pieIndex !== '') {
                    idx = Number(node.dataset.pieIndex);
                    break;
                  }
                  node = node.parentElement;
                }
                if (idx !== null && !Number.isNaN(idx)) {
                  if (hoverPie !== idx) setHoverPie(idx);
                  setPieTooltip({ visible: true, x: e.clientX, y: e.clientY, index: idx });
                } else {
                  if (hoverPie !== -1) setHoverPie(-1);
                  if (pieTooltip.visible) setPieTooltip({ visible: false, x: 0, y: 0, index: null });
                }
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    innerRadius={42}
                    outerRadius={72}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    strokeWidth={0}
                    onMouseEnter={(_, index) => setHoverPie(index)}
                    onMouseLeave={() => setHoverPie(-1)}
                  >
                    {distribution.map((row, i) => (
                      <Cell
                        key={row.name}
                        fill={row.color}
                        data-pie-index={String(i)}
                        stroke={hoverPie === i ? '#ffffff22' : 'transparent'}
                        strokeWidth={hoverPie === i ? 3 : 0}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 6, pointerEvents: 'none' }}>
                <span style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 850 }}>{formatNumber(totalRequests)}</span>
                <span style={{ color: '#475569', fontSize: 8 }}>total requests</span>
              </div>
              {pieTooltip.visible && pieTooltip.index !== null && createPortal(
                <div style={{ position: 'fixed', left: pieTooltip.x + 12, top: pieTooltip.y + 12, zIndex: 2147483647, pointerEvents: 'none' }}>
                  <div style={{
                    background: 'rgba(5,8,22,0.96)', border: '1px solid rgba(6,182,212,0.35)', borderRadius: 8,
                    boxShadow: '0 18px 50px rgba(0,0,0,0.65)', padding: '9px 10px', color: '#e2e8f0',
                    fontSize: 11, minWidth: 140, maxWidth: 320, backdropFilter: 'blur(18px)', pointerEvents: 'none',
                  }}>
                    <div style={{ color: '#06b6d4', fontWeight: 800, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>{distribution[pieTooltip.index].name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Total Requests</span><span style={{ color: '#f8fafc', fontWeight: 800 }}>{formatNumber(distribution[pieTooltip.index].requests)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#10b981' }}>Allowed</span><span style={{ color: '#f8fafc', fontWeight: 800 }}>{formatNumber(distribution[pieTooltip.index].allowed)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#ef4444' }}>Blocked</span><span style={{ color: '#f8fafc', fontWeight: 800 }}>{formatNumber(distribution[pieTooltip.index].blocked)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Share of Traffic</span><span style={{ color: '#f8fafc', fontWeight: 800 }}>{distribution[pieTooltip.index].value.toFixed(1)}%</span></div>
                    </div>
                  </div>
                </div>, document.body
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 200, overflow: 'auto' }}>
              {distribution.map(row => (
                <div key={row.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: '#94a3b8', fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{row.name}</span>
                  <span style={{ color: row.color, fontSize: 10, fontWeight: 800 }}>{row.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>}
        </Panel>
      </div>

      {/* ── Limiter pressure + endpoint health ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel title="Limiter Traffic" icon={<Gauge size={14} color="#ef4444" />}>
          {cardsLoading ? (
            <SkeletonChartFrame height={380} />
          ) : pressureData.length === 0 ? (
            <div style={{ minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
              No rate-limited endpoints to compare
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 360, padding: '10px 10px 0px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pressureData} margin={{ top: 10, right: 15, left: 15, bottom: 10 }} barCategoryGap="15%">
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
                    <XAxis 
                      dataKey="endpoint" 
                      tick={{ fill: '#64748b', fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false} 
                      interval={0} 
                      angle={-25} 
                      textAnchor="end" 
                      height={50}
                      label={{ value: 'Rate Limited Endpoints', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    />
                    <YAxis 
                      width={40}
                      tick={{ fill: '#64748b', fontSize: 10 }} 
                      tickLine={false} 
                      axisLine={false}
                      ticks={[0, 80, 160, 240, 320]}
                      domain={[0, 'auto']}
                      label={{ value: 'Total Requests', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload;
                          const totalRequests = pressureData.reduce((sum, item) => sum + item.requests, 0);
                          const share = totalRequests > 0 ? ((data.requests / totalRequests) * 100).toFixed(1) : '0.0';
                          return (
                            <div style={{ background: '#080d1a', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 6, padding: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                              <div style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{data.endpoint}</div>
                              <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>Total Requests</div>
                              <div style={{ color: '#06b6d4', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>{formatNumber(data.requests)}</div>
                              <div style={{ color: '#64748b', fontSize: 10 }}>{share}% of limiter traffic</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                      wrapperStyle={{ background: 'transparent', boxShadow: 'none' }}
                      cursor={{ fill: 'rgba(6,182,212,0.06)' }}
                    />
                    <Bar 
                      dataKey="requests" 
                      name="Total Requests" 
                      fill="#06b6d4" 
                      radius={[5, 5, 0, 0]}
                      maxBarSize={110}
                    >
                      {pressureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
            </div>
          )}
        </Panel>

        <Panel title="Endpoint Health" icon={<ShieldCheck size={14} color="#10b981" />}>
          <DataTable
            data={cardsLoading ? [] : cards}
            keyField="id"
            emptyLabel={cardsLoading ? 'Loading endpoint health...' : 'No endpoint health data'}
            columns={[
              { key: 'path', header: 'Endpoint' },
              { key: 'blockRate', header: 'Block Rate', width: 100, align: 'right', render: row => (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: row.blockRate >= 10 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{row.blockRate.toFixed(1)}%</div>
                  <div style={{ color: '#475569', fontSize: 9 }}>Blocked ÷ Total</div>
                </div>
              )},
              { key: 'avgMs', header: 'Avg Latency', width: 110, align: 'right', render: row => `${row.avgMs}ms` },
              { key: 'limiterName', header: 'Limiter', width: 130, render: row => (
                <span style={{ color: hasLimiter(row) ? '#8b5cf6' : '#475569', fontStyle: hasLimiter(row) ? 'normal' : 'italic' }}>
                  {hasLimiter(row) ? row.limiterName : 'No Limiter'}
                </span>
              )},
              { key: 'health', header: 'Health', width: 116, align: 'center', render: row => <AnimatedBadge variant={healthVariant(row.health)} label={healthLabel(row.health)} /> },
            ]}
          />
        </Panel>
      </div>

      {/* ── Full performance details ──────────────────────────────────────── */}
      <Panel title="Endpoint Performance Details" icon={<Server size={14} color="#06b6d4" />}>
        <DataTable
          data={cardsLoading ? [] : cards}
          keyField="id"
          emptyLabel={cardsLoading ? 'Loading endpoint performance...' : 'No endpoint performance data'}
          columns={[
            { key: 'path', header: 'Endpoint' },
            { key: 'requests', header: 'Total Requests', width: 120, align: 'right', render: row => formatNumber(row.requests) },
            { key: 'allowed', header: 'Allowed', width: 100, align: 'right', render: row => <span style={{ color: '#10b981', fontWeight: 700 }}>{formatNumber(row.allowed)}</span> },
            { key: 'blocked', header: 'Blocked', width: 100, align: 'right', render: row => <span style={{ color: row.blocked > 0 ? '#ef4444' : '#64748b', fontWeight: 700 }}>{formatNumber(row.blocked)}</span> },
            { key: 'blockRate', header: 'Block Rate', width: 100, align: 'right', render: row => (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: row.blockRate >= 10 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{row.blockRate.toFixed(1)}%</div>
                <div style={{ color: '#475569', fontSize: 9 }}>Blocked ÷ Total</div>
              </div>
            )},
            { key: 'avgMs', header: 'Avg Latency', width: 110, align: 'right', render: row => `${row.avgMs}ms` },
            { key: 'limiterName', header: 'Limiter', width: 160, render: row => (
              <span style={{ color: hasLimiter(row) ? '#8b5cf6' : '#475569', fontStyle: hasLimiter(row) ? 'normal' : 'italic' }}>
                {hasLimiter(row) ? row.limiterName : 'No Limiter'}
              </span>
            )},
          ]}
        />
      </Panel>

      {showRanking && <FullRankingModal rows={ranked} onClose={() => setShowRanking(false)} />}
    </div>
  );
}

function ChartBox({ children }: { children: React.ReactNode }) {
  return <div style={{ height: 250, padding: '14px 10px 12px' }}>{children}</div>;
}
