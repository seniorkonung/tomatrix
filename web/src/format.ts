export const POMODORO_MINUTES = 20

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} ч`, m && `${m} мин`].filter(Boolean).join(' ') || '0 мин'
}
