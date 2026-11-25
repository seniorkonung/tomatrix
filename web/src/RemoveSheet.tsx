import { db, type Pomodoro, type Project } from './db'
import { ProjectChip } from './ProjectChip'
import { Sheet } from './Sheet'

const timeFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

// Общий помидор снимается только после подтверждения: видно, у каких проектов он пропадёт
export function RemoveSheet({ pomodoro, projects, onClose }: { pomodoro: Pomodoro; projects: Project[]; onClose: () => void }) {
  async function remove() {
    await db.pomodoros.delete(pomodoro.id)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="font-semibold">Снять общий помидор?</h2>
      <p className="mt-1 text-sm text-stone-500">Он пропадёт у всех проектов, которым посвящён · {timeFormat.format(pomodoro.createdAt)}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {projects.map((p) => (
          <ProjectChip key={p.id} project={p} />
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-stone-100 py-2.5">
          Отмена
        </button>
        <button type="button" onClick={() => void remove()} className="flex-1 rounded-xl bg-red-600 py-2.5 font-medium text-white">
          Снять
        </button>
      </div>
    </Sheet>
  )
}
