import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { ActivityCard, type Linking } from './ActivityCard'
import { ActivitySheet } from './ActivitySheet'
import { Calendar, CALENDAR_RANGE } from './Calendar'
import { db, type Activity } from './db'
import { addDays, periodStart, startOfDay, startOfMonth, startOfWeek } from './periods'
import { pluralRu } from './plural'
import { linkCells } from './pomodoros'
import { useGestures } from './useGestures'

const POMODORO_MINUTES = 20

const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' })
const longDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

// Текущее время раз в минуту: в полночь и в понедельник периоды сменяются без перезагрузки
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} ч`, m && `${m} мин`].filter(Boolean).join(' ') || '0 мин'
}

export default function App() {
  const now = useNow()
  const today = startOfDay(now)
  // null — сегодня: после полуночи выбранной становится новая дата
  const [picked, setPicked] = useState<Date | null>(null)
  const selected = picked ?? today
  const isToday = selected.getTime() === today.getTime()
  const select = (day: Date) => setPicked(day.getTime() === today.getTime() ? null : day)

  // Календарь: раскрыт ли, насколько вытянут пальцем, какой месяц показан (null — месяц выбранной даты)
  const [expanded, setExpanded] = useState(false)
  const [pull, setPull] = useState<number | null>(null)
  const [month, setMonth] = useState<Date | null>(null)
  const [years, setYears] = useState(false)
  // Свёрнутый календарь в следующий раз раскрывается месяцем выбранной даты
  const toggleCalendar = (open: boolean) => {
    setExpanded(open)
    if (open) return
    setMonth(null)
    setYears(false)
  }

  const root = useRef<HTMLDivElement>(null)
  useGestures(root, CALENDAR_RANGE, {
    expanded,
    onPull: setPull,
    onToggle: toggleCalendar,
    onSwipe: (direction, inCalendar) => {
      if (inCalendar && expanded) {
        const m = month ?? startOfMonth(selected)
        setMonth(new Date(m.getFullYear(), m.getMonth() + direction, 1))
      } else select(addDays(selected, inCalendar ? 7 * direction : direction))
    },
  })

  const weekStart = startOfWeek(selected).getTime()
  const weekEnd = addDays(startOfWeek(selected), 7).getTime()
  const activities = useLiveQuery(() => db.activities.orderBy('order').toArray())
  // Неделя выбранной даты содержит и её день, поэтому её помидоров хватает обоим периодам
  const pomodoros = useLiveQuery(() => db.pomodoros.where('createdAt').between(weekStart, weekEnd).sortBy('createdAt'), [weekStart, weekEnd])

  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  // Долгое нажатие на ячейку: какие ячейки других занятий — тот же помидор
  const [linking, setLinking] = useState<Linking | null>(null)

  const dayStart = selected.getTime()
  const dayEnd = addDays(selected, 1).getTime()
  const dayCount = pomodoros?.filter((p) => p.createdAt >= dayStart && p.createdAt < dayEnd).length ?? 0

  return (
    <div
      ref={root}
      className="mx-auto flex min-h-dvh max-w-xl touch-pan-y flex-col gap-3 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <Calendar
        selected={selected}
        today={today}
        month={month ?? startOfMonth(selected)}
        progress={pull ?? (expanded ? 1 : 0)}
        dragging={pull !== null}
        years={years}
        onSelect={select}
        onMonth={setMonth}
        onYears={setYears}
        onToggle={() => toggleCalendar(!expanded)}
      />

      <header className="px-1">
        <div className="flex items-center gap-2 text-stone-500">
          <span className="first-letter:uppercase">{weekday.format(selected)}</span>
          {isToday ? (
            <span className="rounded-md bg-tomato/10 px-1.5 py-0.5 text-sm text-tomato">Сегодня</span>
          ) : (
            <button onClick={() => select(today)} className="rounded-md bg-stone-200/70 px-1.5 py-0.5 text-sm text-stone-600">
              К сегодня
            </button>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{longDate.format(selected).replace(' г.', '')}</h1>
        <div className="mt-1 text-stone-500">
          {dayCount} {pluralRu(dayCount, ['помидор', 'помидора', 'помидоров'])} · {formatMinutes(dayCount * POMODORO_MINUTES)}
        </div>
      </header>

      {activities && pomodoros && (
        <>
          {activities.length === 0 && (
            <p className="px-1 py-6 text-stone-500">
              Добавьте важные занятия и сколько помидоров хотите на них тратить. Один помидор — {POMODORO_MINUTES} минут внимания.
            </p>
          )}

          {activities.map((a) => {
            const since = periodStart(a.period, selected)
            const until = a.period === 'day' ? dayEnd : weekEnd
            return (
              <ActivityCard
                key={a.id}
                activity={a}
                pomodoros={pomodoros.filter((p) => p.createdAt >= since && p.createdAt < until && a.id in p.cells)}
                day={selected}
                linking={linking}
                onEdit={() => setEditing(a)}
                onStartLinking={(p) =>
                  setLinking({ pomodoroId: p.id, activityId: a.id, selected: Object.fromEntries(Object.keys(p.cells).map((id) => [id, p.id])) })
                }
                onToggleLink={(p) =>
                  setLinking((l) => {
                    if (!l) return l
                    // В занятии выбирается одна ячейка: повторное нажатие снимает выбор, другая ячейка его переносит
                    const { [a.id]: current, ...rest } = l.selected
                    return { ...l, selected: current === p.id ? rest : { ...rest, [a.id]: p.id } }
                  })
                }
              />
            )
          })}

          <button onClick={() => setEditing('new')} disabled={!!linking} className="rounded-2xl border-2 border-dashed border-stone-200 py-3 text-stone-500">
            Добавить занятие
          </button>
        </>
      )}

      {editing && <ActivitySheet activity={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {linking && (
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mt-auto flex items-center gap-3 rounded-2xl bg-stone-900 p-3 pl-4 text-sm text-white shadow-lg">
          <span className="flex-1">Выберите ячейки других занятий, на которые потрачен этот же помидор</span>
          <button onClick={() => setLinking(null)} className="rounded-xl px-2 py-2 text-stone-300">
            Отмена
          </button>
          <button
            onClick={() => {
              void linkCells(linking.pomodoroId, linking.selected, Object.fromEntries(activities!.map((a) => [a.id, a.period])))
              setLinking(null)
            }}
            className="rounded-xl bg-white px-4 py-2 font-medium text-stone-900"
          >
            Готово
          </button>
        </div>
      )}
    </div>
  )
}
