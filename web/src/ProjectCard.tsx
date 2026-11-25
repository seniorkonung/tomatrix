import { useState } from 'react'
import type { Pomodoro, Project } from './db'
import { ProjectChip } from './ProjectChip'

// Сколько клеток видно без разворота, если их слишком много
const COLLAPSE_OVER = 30
const COLLAPSED = 20

function percent(count: number, total: number) {
  const value = (count / total) * 100
  return value < 1 ? '<1%' : `${Math.round(value)}%`
}

// Проект за период: доля от всех помидоров и по клетке на каждый его помидор
export function ProjectCard({
  project,
  pomodoros,
  total,
  onEdit,
  onAdd,
  onRemove,
}: {
  project: Project
  // Помидоры проекта за период по времени
  pomodoros: Pomodoro[]
  // Все помидоры за период: общий помидор в нём один раз
  total: number
  onEdit: () => void
  // Помидор только этому проекту: вернуть случайно снятый там же, где его сняли
  onAdd: () => void
  onRemove: (pomodoro: Pomodoro) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const count = pomodoros.length
  const collapsible = count > COLLAPSE_OVER
  const shown = collapsible && !expanded ? pomodoros.slice(0, COLLAPSED) : pomodoros

  return (
    <li className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <ProjectChip project={project} onClick={onEdit} />
          {project.status === 'archived' && <span className="ml-2 text-xs text-stone-400">в архиве</span>}
        </span>
        <span className="shrink-0 font-medium tabular-nums">{count}</span>
        <span className="w-10 shrink-0 text-right text-sm text-stone-500 tabular-nums">{percent(count, total)}</span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-tomato" style={{ width: `${(count / total) * 100}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label="Снять помидор"
            onClick={() => onRemove(p)}
            className="flex aspect-square items-center justify-center rounded-md bg-tomato"
          >
            {/* Помидор посвящён и другим проектам */}
            {p.projectIds.length > 1 && <span className="size-1.5 rounded-full bg-white/80" />}
          </button>
        ))}
        <button
          type="button"
          aria-label={`Добавить помидор в «${project.name}»`}
          onClick={onAdd}
          className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-stone-300 text-stone-400"
        >
          +
        </button>
      </div>
      {collapsible && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 w-full py-1 text-sm text-stone-500">
          {expanded ? 'Свернуть' : `Показать все · ещё ${count - COLLAPSED}`}
        </button>
      )}
    </li>
  )
}
