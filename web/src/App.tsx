import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { AddSheet } from './AddSheet'
import { addPomodoros, db, type Pomodoro } from './db'
import { formatMinutes, POMODORO_MINUTES } from './format'
import { periodLabel, periodOf, startOfDay, type Unit } from './periods'
import { pluralRu } from './plural'
import { ProjectCard } from './ProjectCard'
import { ProjectEditor } from './ProjectEditor'
import { useProjectTabs } from './projectTabs'
import { RemoveSheet } from './RemoveSheet'
import { useSwipe } from './useSwipe'

const unitLabels: Record<Unit, string> = { day: 'День', week: 'Неделя', month: 'Месяц', year: 'Год' }
const unitTotals: Record<Unit, string> = { day: 'за день', week: 'за неделю', month: 'за месяц', year: 'за год' }

// Текущее время раз в минуту: в полночь текущий период сменяется без перезагрузки
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// Помидоры за день, неделю, месяц или год по проектам; добавляются одной кнопкой «+»
export default function App() {
  const now = useNow()
  const [unit, setUnit] = useState<Unit>('day')
  // Сдвиг от текущего периода; будущие периоды не показываются
  const [offset, setOffset] = useState(0)
  const { start, end } = periodOf(unit, offset, now)
  const shift = (delta: number) => setOffset((o) => Math.min(0, o + delta))

  const root = useRef<HTMLDivElement>(null)
  useSwipe(root, shift)

  const pomodoros = useLiveQuery(
    () => db.pomodoros.where('createdAt').between(start.getTime(), end.getTime(), true, false).sortBy('createdAt'),
    [start.getTime(), end.getTime()],
  )
  const projects = useLiveQuery(() => db.projects.toArray())
  const tabs = useProjectTabs()
  const savedCategories = useLiveQuery(async () => {
    const setting = await db.settings.get('statsCategories')
    return setting?.id === 'statsCategories' ? setting.value : []
  })

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Pomodoro | null>(null)

  // Корень рисуется и до загрузки данных: к нему с первой отрисовки привязан свайп
  if (!pomodoros || !projects || !tabs || !savedCategories) return <div ref={root} className="min-h-dvh" />

  // Категории в порядке вкладок выбора проектов; выбранные, но уже удалённые, не считаются
  const categories = tabs.flatMap((t) => (t.kind === 'category' ? [t.category] : []))
  const chosen = savedCategories.filter((id) => id === null || categories.some((c) => c.id === id))
  const toggleCategory = (id: string | null) =>
    db.settings.put({ id: 'statsCategories', value: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] })

  const total = pomodoros.length
  const byProject = new Map<string, Pomodoro[]>()
  for (const p of pomodoros) for (const id of p.projectIds) byProject.set(id, [...(byProject.get(id) ?? []), p])
  // Проекты в архиве хранят категорию, поэтому отбираются так же, как активные
  const rows = projects
    .filter((project) => chosen.length === 0 || chosen.includes(project.categoryId))
    .flatMap((project) => {
      const own = byProject.get(project.id)
      return own ? [{ project, pomodoros: own }] : []
    })
    .sort((a, b) => b.pomodoros.length - a.pomodoros.length || a.project.name.localeCompare(b.project.name, 'ru'))
  const projectsById = new Map(projects.map((p) => [p.id, p]))

  // В режиме «День» помидоры ложатся в показанный день, иначе — в сегодня
  const addDay = unit === 'day' ? start : startOfDay(now)

  function remove(pomodoro: Pomodoro) {
    if (pomodoro.projectIds.length > 1) setRemoving(pomodoro)
    else void db.pomodoros.delete(pomodoro.id)
  }

  const tabClass = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`
  const arrowClass = 'flex size-9 items-center justify-center rounded-full disabled:opacity-30'

  return (
    <div
      ref={root}
      className="mx-auto flex min-h-dvh max-w-xl touch-pan-y flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex gap-2">
        {(Object.keys(unitLabels) as Unit[]).map((u) => (
          <button
            key={u}
            type="button"
            className={tabClass(unit === u)}
            onClick={() => {
              setUnit(u)
              setOffset(0)
            }}
          >
            {unitLabels[u]}
          </button>
        ))}
      </div>

      <div className="-mx-2 flex items-center gap-2 py-2">
        <button type="button" aria-label="Предыдущий период" className={arrowClass} onClick={() => shift(-1)}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {/* Нажатие возвращает к текущему периоду */}
        <button type="button" className="flex-1 text-center font-medium" onClick={() => setOffset(0)}>
          {periodLabel(unit, start, end, now)}
          {offset === 0 && unit === 'day' && <span className="ml-2 rounded-md bg-tomato/10 px-1.5 py-0.5 text-sm text-tomato">Сегодня</span>}
        </button>
        <button type="button" aria-label="Следующий период" className={arrowClass} disabled={offset === 0} onClick={() => shift(1)}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
        <span className="block text-3xl font-semibold tabular-nums">{total}</span>
        <span className="text-sm text-stone-500">
          {pluralRu(total, ['помидор', 'помидора', 'помидоров'])} {unitTotals[unit]} · {formatMinutes(total * POMODORO_MINUTES)}
        </span>
      </div>

      {total > 0 && categories.length > 0 && (
        <div className="mt-4 -mb-1 flex gap-1.5 overflow-x-auto">
          <button type="button" className={tabClass(chosen.length === 0)} onClick={() => db.settings.put({ id: 'statsCategories', value: [] })}>
            Все проекты
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" className={tabClass(chosen.includes(c.id))} onClick={() => void toggleCategory(c.id)}>
              {c.name}
            </button>
          ))}
          <button type="button" className={tabClass(chosen.includes(null))} onClick={() => void toggleCategory(null)}>
            Без категории
          </button>
        </div>
      )}

      {total === 0 ? (
        <p className="px-1 py-8 text-center text-stone-400">
          {projects.length === 0 ? 'Нажмите +, чтобы добавить первые помидоры и проекты, которым они посвящены' : 'Помидоров за этот период нет'}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map(({ project, pomodoros }) => (
            <ProjectCard
              key={project.id}
              project={project}
              pomodoros={pomodoros}
              total={total}
              onEdit={() => setEditingId(project.id)}
              onAdd={() => void addPomodoros(1, [project], addDay)}
              onRemove={remove}
            />
          ))}
          {rows.length === 0 && <li className="py-4 text-center text-sm text-stone-400">У проектов выбранных категорий нет помидоров за период</li>}
        </ul>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 mx-auto flex max-w-xl justify-end px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label="Добавить помидоры"
          onClick={() => setAdding(true)}
          className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-tomato text-3xl text-white shadow-lg"
        >
          +
        </button>
      </div>

      {adding && <AddSheet day={addDay} onClose={() => setAdding(false)} />}
      {editingId && <ProjectEditor projectId={editingId} onClose={() => setEditingId(null)} />}
      {removing && (
        <RemoveSheet
          pomodoro={removing}
          projects={removing.projectIds.flatMap((id) => projectsById.get(id) ?? [])}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}
