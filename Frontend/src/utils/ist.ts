const LOCALE = 'en-IN';
const TZ     = 'Asia/Kolkata';

export const istHHMMSS = (ts: string | Date): string =>
  new Date(ts).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: TZ,
  });

export const istHHMM = (ts: string | Date): string =>
  new Date(ts).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: TZ,
  });

export const istDateKey = (ts: string | Date): string =>
  new Date(ts).toLocaleDateString(LOCALE, {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  });

export const istShortDate = (ts: string | Date): string =>
  new Date(ts).toLocaleDateString(LOCALE, {
    day: '2-digit', month: 'short', timeZone: TZ,
  });

export const istClock = (ts: string | Date = new Date()): string => istHHMMSS(ts);

export const istTodayKey = (): string => istDateKey(new Date());

export const istFull = (ts: string | Date): string => {
  const d = new Date(ts);
  const date = d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', timeZone: TZ });
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ });
  return `${date} ${time}`;
};

export const relativeIST = (ts: string | Date): string => {
  const diffMs = Date.now() - new Date(ts).getTime();
  const secs   = Math.floor(diffMs / 1000);
  if (secs < 10)  return 'just now';
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hrs  = Math.floor(mins / 60);
  return `${hrs}h ago`;
};
