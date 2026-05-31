import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { istClock, istShortDate } from '@/utils/ist';

// Merge Tailwind classes safely //
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format large numbers: 1,924,000 → 1.92M /
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

//Format milliseconds //
export function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// Format uptime from hours //
export function formatUptime(hours: number): string {
  if (hours < 1 / 60) return `${Math.round(hours * 3600)}s`;
  if (hours < 1)      return `${Math.round(hours * 60)}m`;
  if (hours < 24)     return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/** Get current IST time string */
export function getISTTime(ts: string | Date = new Date()): string {
  return ts ? istClock(ts) : istClock();
}

/** Get current IST date string */
export function getISTDate(ts: string | Date = new Date()): string {
  return istShortDate(ts);
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Determine status color */
export function statusColor(allowed: boolean): string {
  return allowed ? 'var(--emerald)' : 'var(--red)';
}
