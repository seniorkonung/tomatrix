import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { ActivityCard } from './ActivityCard'
import { ActivitySheet } from './ActivitySheet'
import { db, type Activity } from './db'
import { periodStart, startOfDay, startOfWeek } from './periods'
import { pluralRu } from './plural'

const POMODORO_MINUTES = 20

const today = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

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
  const dayStart = startOfDay(now).getTime()
  const weekStart = startOfWeek(now).getTime()

  const activities = useLiveQuery(() => db.activities.orderBy('order').toArray())
  // Неделя начинается не позже дня, поэтому её помидоров хватает обоим периодам
  const pomodoros = useLiveQuery(() => db.pomodoros.where('createdAt').aboveOrEqual(weekStart).sortBy('createdAt'), [weekStart])

  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  // Долгое нажатие на ячейку: какие ячейки других занятий — тот же помидор
  const [linkingIds, setLinkingIds] = useState<{ pomodoroId: string; activityId: string } | null>(null)
  const linkingPomodoro = pomodoros?.find((p) => p.id === linkingIds?.pomodoroId)
  const linking = linkingIds && linkingPomodoro ? { pomodoro: linkingPomodoro, activityId: linkingIds.activityId } : null

  if (!activities || !pomodoros) return null

  const todayCount = pomodoros.filter((p) => p.createdAt >= dayStart).length

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-3 px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="px-1">
        <div className="text-sm text-stone-500 first-letter:uppercase">{today.format(now)}</div>
        <div className="text-xl font-semibold">
          {todayCount} {pluralRu(todayCount, ['помидор', 'помидора', 'помидоров'])}
          <span className="ml-2 text-base font-normal text-stone-400">{formatMinutes(todayCount * POMODORO_MINUTES)}</span>
        </div>
      </header>

      {activities.length === 0 && (
        <p className="px-1 py-6 text-stone-500">
          Добавьте важные занятия и сколько помидоров хотите на них тратить. Один помидор — {POMODORO_MINUTES} минут внимания.
        </p>
      )}

      {activities.map((a) => {
        const since = periodStart(a.period, now)
        return (
          <ActivityCard
            key={a.id}
            activity={a}
            pomodoros={pomodoros.filter((p) => p.createdAt >= since && a.id in p.cells)}
            linking={linking}
            onEdit={() => setEditing(a)}
            onStartLinking={(p) => setLinkingIds({ pomodoroId: p.id, activityId: a.id })}
          />
        )
      })}

      <button onClick={() => setEditing('new')} disabled={!!linking} className="rounded-2xl border-2 border-dashed border-stone-200 py-3 text-stone-500">
        Добавить занятие
      </button>

      {editing && <ActivitySheet activity={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {linking && (
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mt-auto flex items-center gap-3 rounded-2xl bg-stone-900 p-3 pl-4 text-sm text-white shadow-lg">
          <span className="flex-1">Отметьте ячейки других занятий, на которые потрачен этот же помидор</span>
          <button onClick={() => setLinkingIds(null)} className="rounded-xl bg-white px-4 py-2 font-medium text-stone-900">
            Готово
          </button>
        </div>
      )}
    </div>
  )
}
