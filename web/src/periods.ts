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

export function startOfMonth(day: Date) {
  return new Date(day.getFullYear(), day.getMonth(), 1)
}

export function addDays(day: Date, days: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days)
}

export function periodStart(period: Period, now: Date) {
  return (period === 'day' ? startOfDay(now) : startOfWeek(now)).getTime()
}
