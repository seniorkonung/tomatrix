export type Unit = 'day' | 'week' | 'month' | 'year'

export function startOfDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// Неделя начинается с понедельника
export function startOfWeek(now: Date) {
  const day = startOfDay(now)
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}

// Начало периода для миграции версии 2, когда у занятий были цели на день или неделю
export function periodStart(period: 'day' | 'week', now: Date) {
  return (period === 'day' ? startOfDay(now) : startOfWeek(now)).getTime()
}

// Календарный период со сдвигом от текущего: [start, end)
export function periodOf(unit: Unit, offset: number, now: Date) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  switch (unit) {
    case 'day':
      return { start: new Date(y, m, d + offset), end: new Date(y, m, d + offset + 1) }
    case 'week': {
      const start = startOfWeek(now)
      start.setDate(start.getDate() + offset * 7)
      return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) }
    }
    case 'month':
      return { start: new Date(y, m + offset, 1), end: new Date(y, m + offset + 1, 1) }
    case 'year':
      return { start: new Date(y + offset, 0, 1), end: new Date(y + offset + 1, 0, 1) }
  }
}

const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const dayWithYearFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function periodLabel(unit: Unit, start: Date, end: Date, now: Date) {
  const thisYear = start.getFullYear() === now.getFullYear()
  switch (unit) {
    case 'day':
      return capitalize(weekdayFormat.format(start)) + (thisYear ? '' : ` ${start.getFullYear()}`)
    case 'week': {
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
      return `${dayFormat.format(start)} – ${(thisYear ? dayFormat : dayWithYearFormat).format(last)}`
    }
    case 'month':
      return capitalize(monthFormat.format(start).replace(' г.', ''))
    case 'year':
      return String(start.getFullYear())
  }
}
