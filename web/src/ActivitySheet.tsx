import { useState } from 'react'
import { db, type Activity, type Period } from './db'
import { pluralRu } from './plural'
import { Sheet } from './Sheet'

// Создание занятия, если activity не передано, иначе правка
export function ActivitySheet({ activity, onClose }: { activity?: Activity; onClose: () => void }) {
  const [name, setName] = useState(activity?.name ?? '')
  const [goal, setGoal] = useState(activity?.goal ?? 3)
  const [period, setPeriod] = useState<Period>(activity?.period ?? 'day')

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (activity) {
      await db.activities.update(activity.id, { name: trimmed, goal, period })
    } else {
      const last = await db.activities.orderBy('order').last()
      await db.activities.add({
        id: crypto.randomUUID(),
        name: trimmed,
        createdAt: Date.now(),
        order: (last?.order ?? 0) + 1,
        goal,
        period,
      })
    }
    onClose()
  }

  // Помидоры только этого занятия удаляются, у общих оно просто убирается из списка
  async function remove() {
    if (!activity || !confirm(`Удалить занятие «${activity.name}» вместе с его помидорами?`)) return
    await db.transaction('rw', db.activities, db.pomodoros, async () => {
      const pomodoros = await db.pomodoros.where('activityIds').equals(activity.id).toArray()
      await db.pomodoros.bulkDelete(pomodoros.filter((p) => p.activityIds.length === 1).map((p) => p.id))
      await db.pomodoros.bulkPut(
        pomodoros
          .filter((p) => p.activityIds.length > 1)
          .map((p) => ({ ...p, activityIds: p.activityIds.filter((id) => id !== activity.id) })),
      )
      await db.activities.delete(activity.id)
    })
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <input
          autoFocus={!activity}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название занятия"
          className="rounded-xl bg-stone-100 px-3 py-2.5 text-base outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setGoal((g) => Math.max(1, g - 1))} className="size-9 rounded-full bg-stone-100 text-lg">
              −
            </button>
            <span className="w-24 text-center tabular-nums">
              {goal} {pluralRu(goal, ['помидор', 'помидора', 'помидоров'])}
            </span>
            <button type="button" onClick={() => setGoal((g) => g + 1)} className="size-9 rounded-full bg-stone-100 text-lg">
              +
            </button>
          </div>
          <div className="flex rounded-full bg-stone-100 p-0.5 text-sm">
            {(['day', 'week'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1.5 ${period === p ? 'bg-white shadow-sm' : 'text-stone-500'}`}
              >
                {p === 'day' ? 'в день' : 'в неделю'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {activity && (
            <button type="button" onClick={() => void remove()} className="rounded-xl px-4 py-2.5 text-red-600">
              Удалить
            </button>
          )}
          <button type="submit" disabled={!name.trim()} className="flex-1 rounded-xl bg-stone-900 py-2.5 text-white disabled:opacity-40">
            {activity ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
