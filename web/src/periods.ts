import type { Period } from './db'

export function startOfDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// Неделя начинается с понедельника
export function startOfWeek(now: Date) {
  const day = startOfDay(now)
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}

export function periodStart(period: Period, now: Date) {
  return (period === 'day' ? startOfDay(now) : startOfWeek(now)).getTime()
}
