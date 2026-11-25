import { db, type Activity, type Pomodoro } from './db'

const square = 'size-9 rounded-lg'

// Занятие в ленте: цель за период — пустые квадратики, потраченные помидоры их заполняют
export function ActivityCard({
  activity,
  pomodoros,
  onEdit,
  onOpenPomodoro,
}: {
  activity: Activity
  // Помидоры занятия за текущий период по времени
  pomodoros: Pomodoro[]
  onEdit: () => void
  onOpenPomodoro: (id: string) => void
}) {
  const empty = Math.max(0, activity.goal - pomodoros.length)
  const reached = empty === 0

  async function spend() {
    await db.pomodoros.add({ id: crypto.randomUUID(), createdAt: Date.now(), activityIds: [activity.id] })
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <button onClick={onEdit} className="flex w-full items-baseline justify-between gap-3 text-left">
        <h2 className="truncate font-semibold">{activity.name}</h2>
        <span className={`shrink-0 text-sm tabular-nums ${reached ? 'text-emerald-600' : 'text-stone-400'}`}>
          {pomodoros.length} / {activity.goal} {activity.period === 'day' ? 'сегодня' : 'за неделю'}
        </span>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {pomodoros.map((p) => (
          <button
            key={p.id}
            onClick={() => onOpenPomodoro(p.id)}
            className={`${square} animate-pop flex items-center justify-center bg-tomato`}
            aria-label="Помидор"
          >
            {/* Помидор поделён с другими занятиями */}
            {p.activityIds.length > 1 && <span className="size-2 rounded-full bg-white/80" />}
          </button>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <button key={i} onClick={() => void spend()} className={`${square} border-2 border-dashed border-stone-300`} aria-label="Потратить помидор" />
        ))}
        {/* Сверх цели помидор тоже можно потратить */}
        {reached && (
          <button onClick={() => void spend()} className={`${square} text-lg text-stone-300`} aria-label="Потратить помидор сверх цели">
            +
          </button>
        )}
      </div>
    </section>
  )
}
