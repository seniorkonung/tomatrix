import { db, type Activity, type Pomodoro } from './db'
import { Sheet } from './Sheet'

const time = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

// Помидор можно поделить между несколькими занятиями, если занимался ими параллельно
export function PomodoroSheet({ pomodoro, activities, onClose }: { pomodoro: Pomodoro; activities: Activity[]; onClose: () => void }) {
  async function toggle(id: string) {
    const ids = pomodoro.activityIds.includes(id) ? pomodoro.activityIds.filter((a) => a !== id) : [...pomodoro.activityIds, id]
    await db.pomodoros.update(pomodoro.id, { activityIds: ids })
  }

  async function remove() {
    await db.pomodoros.delete(pomodoro.id)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="text-sm text-stone-500 first-letter:uppercase">{time.format(pomodoro.createdAt)}</div>
        <div className="flex flex-wrap gap-2">
          {activities.map((a) => {
            const on = pomodoro.activityIds.includes(a.id)
            return (
              <button
                key={a.id}
                // Последнее занятие не снять: помидор без занятия — это удаление
                disabled={on && pomodoro.activityIds.length === 1}
                onClick={() => void toggle(a.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${on ? 'bg-tomato text-white' : 'bg-stone-100 text-stone-600'}`}
              >
                {a.name}
              </button>
            )
          })}
        </div>
        <button onClick={() => void remove()} className="mt-1 self-start rounded-xl py-2 text-red-600">
          Удалить помидор
        </button>
      </div>
    </Sheet>
  )
}
