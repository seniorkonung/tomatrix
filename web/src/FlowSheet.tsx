import { projectColors, type Project } from './db'
import { coverage, type Slots } from './flows'
import { formatMinutes, POMODORO_MINUTES } from './format'
import { pluralRu } from './plural'
import { ProjectChip } from './ProjectChip'

// Столбцов в ряду клеток: при длинном потоке клетки переносятся, но помидор с одним номером у всех проектов
// стоит в одном столбце — пересечения видны по вертикали
const COLUMNS = 10

// Второй шаг добавления: какие помидоры потока занимал каждый проект. Клетка заполняется и очищается касанием;
// помидор, отмеченный у нескольких проектов, — параллельный, у всех них с точкой
export function FlowSheet({
  length,
  projects,
  slots,
  onSlots,
  onBack,
  onAdd,
}: {
  length: number
  projects: Project[]
  slots: Slots
  onSlots: (slots: Slots) => void
  onBack: () => void
  onAdd: () => Promise<void>
}) {
  const cover = coverage(slots, length)
  const uncovered = cover.filter((c) => c === 0).length
  const marked = Object.values(slots).reduce((sum, list) => sum + list.length, 0)
  const parallel = cover.filter((c) => c > 1).length

  const toggle = (id: string, slot: number) => {
    const list = slots[id] ?? []
    onSlots({ ...slots, [id]: list.includes(slot) ? list.filter((i) => i !== slot) : [...list, slot].sort((a, b) => a - b) })
  }
  const grid = { gridTemplateColumns: `repeat(${Math.min(length, COLUMNS)}, minmax(0, 1fr))` }

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-xl flex-col justify-end bg-black/30" onClick={onBack}>
      <div className="flex max-h-[90dvh] flex-col rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button type="button" className="text-sm text-stone-500" onClick={onBack}>
            Назад
          </button>
          <h2 className="font-semibold">
            Поток · {length} {pluralRu(length, ['помидор', 'помидора', 'помидоров'])}
          </h2>
          <span className="w-12" />
        </div>

        <div className="overflow-y-auto px-4">
          {/* Покрытие потока: пустая клетка — помидор ещё ни у кого не отмечен, с точкой — параллельный */}
          <div className="grid gap-1" style={grid}>
            {cover.map((c, i) => (
              <span
                key={i}
                className={`flex aspect-square items-center justify-center rounded-md ${c === 0 ? 'border-2 border-dashed border-amber-400' : 'bg-tomato'}`}
              >
                {c > 1 && <span className="size-1.5 rounded-full bg-white/80" />}
              </span>
            ))}
          </div>
          <p className={`mt-1.5 text-sm ${uncovered ? 'text-amber-700' : 'text-stone-500'}`}>
            Отмечено {marked} · {formatMinutes(length * POMODORO_MINUTES)}
            {parallel > 0 && ` · ${parallel} параллельно`}
            {uncovered > 0 && ` · не отмечено ${uncovered}`}
          </p>

          <ul className="mt-3 flex flex-col gap-3">
            {projects.map((project) => {
              const list = slots[project.id] ?? []
              const color = projectColors[project.color % projectColors.length].dot
              return (
                <li key={project.id}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <ProjectChip project={project} />
                    <span className="text-sm text-stone-500 tabular-nums">{list.length}</span>
                  </div>
                  <div className="grid gap-1" style={grid}>
                    {cover.map((c, i) => {
                      const on = list.includes(i)
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-label={`${project.name}: помидор ${i + 1}`}
                          aria-pressed={on}
                          onClick={() => toggle(project.id, i)}
                          className={`flex aspect-square items-center justify-center rounded-md ${on ? '' : 'bg-stone-100'}`}
                          style={on ? { background: color } : undefined}
                        >
                          {on && c > 1 && <span className="size-1.5 rounded-full bg-white/80" />}
                        </button>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="px-4 pt-4">
          {/* Поток добавляется, только когда каждый его помидор отмечен хотя бы у одного проекта */}
          <button
            type="button"
            disabled={uncovered > 0}
            onClick={() => void onAdd()}
            className="w-full rounded-2xl bg-tomato py-3 font-medium text-white disabled:opacity-40"
          >
            Добавить поток
          </button>
        </div>
      </div>
    </div>
  )
}
