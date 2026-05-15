export function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00.000';
  const sign = seconds < 0 ? '-' : '';
  const s = Math.abs(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const secStr = sec.toFixed(3).padStart(6, '0');
  return h > 0
    ? `${sign}${h}:${String(m).padStart(2, '0')}:${secStr}`
    : `${sign}${m}:${secStr}`;
}
