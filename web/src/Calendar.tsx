import type { ReactNode } from 'react'
import { addDays, startOfWeek } from './periods'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const monthTitle = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })

// Размеры для перехода между неделей и месяцем: строка выбранной недели месяца встаёт на место полосы недели
const STRIP_H = 60
const HEAD_H = 48 + 28
const ROW_H = 48
export const MONTH_H = HEAD_H + 6 * ROW_H
export const CALENDAR_RANGE = MONTH_H - STRIP_H

const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime()

// Календарь над лентой: свёрнут — неделя выбранной даты, раскрыт — месяц или годы.
// progress: 0 — свёрнут, 1 — раскрыт, между ними — пока страницу тянут пальцем
export function Calendar({
  selected,
  today,
  month,
  progress,
  dragging,
  years,
  onSelect,
  onMonth,
  onYears,
  onToggle,
}: {
  selected: Date
  today: Date
  // Первое число показанного месяца
  month: Date
  progress: number
  dragging: boolean
  // Вместо месяца выбираются годы
  years: boolean
  onSelect: (day: Date) => void
  onMonth: (month: Date) => void
  onYears: (years: boolean) => void
  onToggle: () => void
}) {
  const showYears = years && progress === 1

  const gridStart = startOfWeek(month)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const row = Math.max(0, Math.floor(days.findIndex((d) => sameDay(d, selected)) / 7))
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selected), i))

  const animate = dragging ? '' : 'transition-all duration-250 ease-out'
  const shiftMonth = (delta: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  return (
    <div data-calendar className="select-none">
      <div className={`relative overflow-hidden ${animate}`} style={{ height: STRIP_H + CALENDAR_RANGE * progress }}>
        <div
          className={`absolute inset-x-0 top-0 ${animate}`}
          style={{ opacity: progress, transform: `translateY(${-(HEAD_H + row * ROW_H) * (1 - progress)}px)`, pointerEvents: progress > 0.5 ? 'auto' : 'none' }}
        >
          <div className="flex h-12 items-center justify-between">
            <IconButton label="Назад" onClick={() => (showYears ? onMonth(new Date(month.getFullYear() - 12, month.getMonth(), 1)) : shiftMonth(-1))}>
              <path d="M15 6l-6 6 6 6" />
            </IconButton>
            <button onClick={() => onYears(!years)} className="flex items-center gap-1 rounded-xl px-3 py-1.5 font-semibold">
              {showYears ? `${yearsStart(month)}–${yearsStart(month) + 11}` : capitalize(monthTitle.format(month).replace(' г.', ''))}
              <svg viewBox="0 0 24 24" className={`size-4 fill-none stroke-current stroke-2 text-stone-400 ${showYears ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <IconButton label="Вперёд" onClick={() => (showYears ? onMonth(new Date(month.getFullYear() + 12, month.getMonth(), 1)) : shiftMonth(1))}>
              <path d="M9 6l6 6-6 6" />
            </IconButton>
          </div>
          {showYears ? (
            <div className="grid grid-cols-3" style={{ height: MONTH_H - 48 }}>
              {Array.from({ length: 12 }, (_, i) => yearsStart(month) + i).map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    onMonth(new Date(y, month.getMonth(), 1))
                    onYears(false)
                  }}
                  className={`m-1.5 rounded-xl text-lg ${y === month.getFullYear() ? 'bg-stone-200/70 font-semibold' : ''} ${y === today.getFullYear() ? 'text-tomato' : ''}`}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid h-7 grid-cols-7 text-center text-xs text-stone-400">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d) => (
                  <Day key={d.getTime()} day={d} selected={selected} today={today} muted={d.getMonth() !== month.getMonth()} onSelect={onSelect} />
                ))}
              </div>
            </>
          )}
        </div>
        <div
          className={`absolute inset-x-0 top-0 grid grid-cols-7 ${animate}`}
          style={{ height: STRIP_H, opacity: 1 - progress * 4, pointerEvents: progress < 0.5 ? 'auto' : 'none' }}
        >
          {week.map((d, i) => (
            <button
              key={d.getTime()}
              onClick={() => onSelect(d)}
              className={`m-0.5 flex flex-col items-center justify-center rounded-xl ${sameDay(d, selected) ? 'bg-stone-200/70' : ''}`}
            >
              <span className={`text-lg leading-tight ${sameDay(d, today) ? 'font-semibold text-tomato' : ''}`}>{d.getDate()}</span>
              <span className="text-xs text-stone-400">{WEEKDAYS[i]}</span>
            </button>
          ))}
        </div>
      </div>
      <button onClick={onToggle} aria-label={progress > 0.5 ? 'Свернуть календарь' : 'Раскрыть календарь'} className="flex w-full justify-center py-1 text-stone-300">
        <svg viewBox="0 0 32 12" className={`h-3 w-8 fill-none stroke-current stroke-[2.5] ${animate}`} style={{ transform: `scaleY(${1 - 2 * progress})` }}>
          <path d="M4 3l12 6 12-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

function Day({ day, selected, today, muted, onSelect }: { day: Date; selected: Date; today: Date; muted: boolean; onSelect: (day: Date) => void }) {
  const isSelected = sameDay(day, selected)
  const isToday = sameDay(day, today)
  return (
    <button onClick={() => onSelect(day)} className="flex items-center justify-center" style={{ height: ROW_H }}>
      <span
        className={`flex size-10 items-center justify-center rounded-xl text-lg ${
          isSelected ? (isToday ? 'bg-tomato font-semibold text-white' : 'bg-stone-200/70 font-semibold') : isToday ? 'font-semibold text-tomato' : muted ? 'text-stone-300' : ''
        }`}
      >
        {day.getDate()}
      </span>
    </button>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="flex size-10 items-center justify-center text-stone-400">
      <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
        {children}
      </svg>
    </button>
  )
}

// Страница из 12 лет, в которой лежит год месяца
function yearsStart(month: Date) {
  const y = month.getFullYear()
  return y - ((((y - 2020) % 12) + 12) % 12)
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
