import { useState } from 'react'
import { db, type Activity, type GoalKind, type Period } from './db'
import { pluralRu } from './plural'
import { emptyCell } from './pomodoros'
import { Sheet } from './Sheet'

// Создание занятия, если activity не передано, иначе правка
export function ActivitySheet({ activity, onClose }: { activity?: Activity; onClose: () => void }) {
  const [name, setName] = useState(activity?.name ?? '')
  const [goal, setGoal] = useState(activity?.goal ?? 3)
  const [goalKind, setGoalKind] = useState<GoalKind>(activity?.goalKind ?? 'min')
  const [period, setPeriod] = useState<Period>(activity?.period ?? 'day')

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (activity) {
      await db.activities.update(activity.id, { name: trimmed, goal, goalKind, period })
    } else {
      const last = await db.activities.orderBy('order').last()
      await db.activities.add({
        id: crypto.randomUUID(),
        name: trimmed,
        createdAt: Date.now(),
        order: (last?.order ?? 0) + 1,
        goal,
        goalKind,
        period,
      })
    }
    onClose()
  }

  // Помидоры только этого занятия удаляются, у общих оно просто убирается из списка
  async function remove() {
    if (!activity || !confirm(`Удалить занятие «${activity.name}» вместе с его помидорами?`)) return
    await db.transaction('rw', db.activities, db.pomodoros, async () => {
      const pomodoros = await db.pomodoros.filter((p) => activity.id in p.cells).toArray()
      for (const p of pomodoros) await emptyCell(p, activity.id)
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={goalKind}
            options={[
              ['min', 'не меньше'],
              ['max', 'не больше'],
            ]}
            onChange={setGoalKind}
          />
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
          <Segmented
            value={period}
            options={[
              ['day', 'в день'],
              ['week', 'в неделю'],
            ]}
            onChange={setPeriod}
          />
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

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <div className="flex rounded-full bg-stone-100 p-0.5 text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1.5 ${value === v ? 'bg-white shadow-sm' : 'text-stone-500'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
