export const CATEGORIES = ['explore', 'learn', 'build', 'integrate', 'reflect', 'office-hours', 'other'];
export const PRIORITIES  = ['high', 'medium', 'low'];

export const CATEGORY_COLORS = {
  explore:        '#7c5cff',
  learn:          '#3b82f6',
  build:          '#10b981',
  integrate:      '#f59e0b',
  reflect:        '#ec4899',
  'office-hours': '#6366f1',
  other:          '#64748b',
};

export const PRIORITY_COLORS = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#22c55e',
};

export function fmtMinutes(mins) {
  if (!mins && mins !== 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
