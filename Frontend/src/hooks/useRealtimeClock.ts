import { useSyncExternalStore } from 'react';

const TZ = 'Asia/Kolkata';

interface RealtimeClockSnapshot {
  currentTime: Date;
  currentMinute: number;
  currentHour: number;
  currentSecond: number;
}

interface RealtimeMinuteSnapshot {
  currentMinute: number;
  currentHour: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function readClock(): RealtimeClockSnapshot {
  const currentTime = new Date();
  const parts = partsFormatter.formatToParts(currentTime);
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
  const currentHour = hour === 24 ? 0 : hour;

  return {
    currentTime,
    currentHour,
    currentMinute: currentHour * 60 + minute,
    currentSecond: currentTime.getSeconds(),
  };
}

let secondSnapshot = readClock();
let minuteSnapshot: RealtimeMinuteSnapshot = {
  currentMinute: secondSnapshot.currentMinute,
  currentHour: secondSnapshot.currentHour,
};
const secondListeners = new Set<() => void>();
const minuteListeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  const next = readClock();
  const minuteChanged =
    next.currentMinute !== minuteSnapshot.currentMinute ||
    next.currentHour !== minuteSnapshot.currentHour;

  secondSnapshot = next;
  secondListeners.forEach(listener => listener());

  if (minuteChanged) {
    minuteSnapshot = {
      currentMinute: next.currentMinute,
      currentHour: next.currentHour,
    };
    minuteListeners.forEach(listener => listener());
  }
}

function ensureTimer() {
  if (timer !== undefined) return;
  tick();
  timer = window.setInterval(tick, 1_000);
}

function cleanupTimer() {
  if (secondListeners.size > 0 || minuteListeners.size > 0 || timer === undefined) return;
  window.clearInterval(timer);
  timer = undefined;
}

function subscribeSecond(listener: () => void) {
  secondListeners.add(listener);
  ensureTimer();
  return () => {
    secondListeners.delete(listener);
    cleanupTimer();
  };
}

function subscribeMinute(listener: () => void) {
  minuteListeners.add(listener);
  ensureTimer();
  return () => {
    minuteListeners.delete(listener);
    cleanupTimer();
  };
}

export function useRealtimeClock() {
  return useSyncExternalStore(subscribeSecond, () => secondSnapshot, () => secondSnapshot);
}

export function useRealtimeMinuteClock() {
  return useSyncExternalStore(subscribeMinute, () => minuteSnapshot, () => minuteSnapshot);
}
