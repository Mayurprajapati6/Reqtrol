import { useState } from 'react';

/**
 * UserAvatar
 * Shows profile image from Quby if available, else initials from userName/userId.
 * Quby sends avatarUrl + userName in reqtrolMiddleware.
 */

interface UserAvatarProps {
  userId:    string;
  userName?: string;
  avatarUrl?: string;
  size?:     number;
  severity?: string;
}

function initials(userId: string, userName?: string): string {
  if (userName && userName.trim()) {
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  // UUID or simulator id — use first 2 chars
  if (userId === 'anon') return 'AN';
  return userId.slice(0, 2).toUpperCase();
}

function displayName(userId: string, userName?: string): string {
  if (userName && userName.trim()) return userName.trim();
  // Truncate long UUID
  if (userId.length > 16) return userId.slice(0, 8) + '…' + userId.slice(-4);
  return userId;
}

function bgColor(severity?: string): string {
  if (severity === 'critical') return 'rgba(239,68,68,0.18)';
  if (severity === 'warning')  return 'rgba(245,158,11,0.15)';
  return 'rgba(16,185,129,0.12)';
}
function textColor(severity?: string): string {
  if (severity === 'critical') return '#ef4444';
  if (severity === 'warning')  return '#f59e0b';
  return '#10b981';
}

export function UserAvatar({ userId, userName, avatarUrl, size = 32, severity }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!imageFailed && avatarUrl && avatarUrl.trim() && avatarUrl.startsWith('http')) {
    return (
      <img
        src={avatarUrl}
        alt={displayName(userId, userName)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
        onError={() => setImageFailed(true)}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: bgColor(severity), color: textColor(severity),
      fontSize: Math.max(9, size * 0.35) + 'px', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${severity === 'critical' ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
      fontFamily: 'var(--font-display)',
    }}>
      {initials(userId, userName)}
    </div>
  );
}

export { displayName };
