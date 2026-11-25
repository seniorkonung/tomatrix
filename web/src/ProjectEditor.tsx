import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { archiveProject, db, deleteProject, projectColors, restoreProject, type Project } from './db'
import { pluralRu } from './plural'
import { useProjectTabs } from './projectTabs'

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

export function ProjectEditor({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const tabs = useProjectTabs()
  const pomodoros = useLiveQuery(() => db.pomodoros.where('projectIds').equals(projectId).toArray(), [projectId])
  if (!project || !tabs || !pomodoros) return null
  // Категории в порядке вкладок выбора проектов
  const categories = tabs.flatMap((t) => (t.kind === 'category' ? [t.category] : []))
  // Помидоры только этого проекта при удалении пропадают, общие остаются у других проектов
  const own = pomodoros.filter((p) => p.projectIds.length === 1).length
  return <Form key={project.id} project={project} categories={categories} count={pomodoros.length} own={own} onClose={onClose} />
}

type FormProps = {
  project: Project
  categories: { id: string; name: string }[]
  count: number
  own: number
  onClose: () => void
}

function Form({ project, categories, count, own, onClose }: FormProps) {
  const [name, setName] = useState(project.name)
  const [color, setColor] = useState(project.color)
  const [categoryId, setCategoryId] = useState(project.categoryId ?? '')
  const active = project.status === 'active'

  async function remove() {
    const shared = count - own
    const note = [
      own ? `${own} ${pluralRu(own, ['помидор', 'помидора', 'помидоров'])} только этого проекта удалятся.` : '',
      shared ? `С ${shared} ${pluralRu(shared, ['общего помидора', 'общих помидоров', 'общих помидоров'])} проект просто снимется.` : '',
    ]
      .filter(Boolean)
      .join(' ')
    if (!window.confirm(`Удалить проект «${project.name}» безвозвратно? ${note} Для проекта, который больше не нужен, есть архив.`)) return
    await deleteProject(project.id)
    onClose()
  }

  async function save() {
    await db.projects.update(project.id, { name: name.trim(), color, ...(active ? { categoryId: categoryId || null } : {}) })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-xl flex-col justify-end bg-black/30" onClick={onClose}>
      <div className="flex max-h-[90dvh] flex-col rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button type="button" className="text-sm text-stone-500" onClick={onClose}>
            Отмена
          </button>
          <h2 className="font-semibold">Проект</h2>
          <button type="button" className="text-sm font-medium text-tomato disabled:text-stone-300" disabled={!name.trim()} onClick={() => void save()}>
            Сохранить
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-2">
          <label className="mb-1 block text-xs text-stone-500">Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded-2xl bg-stone-100 px-3 py-2 outline-none" />

          <label className="mb-1.5 block text-xs text-stone-500">Цвет</label>
          <div className="mb-4 flex flex-wrap gap-2">
            {projectColors.map((c, i) => (
              <button
                key={c.dot}
                type="button"
                aria-label={`Цвет ${i + 1}`}
                onClick={() => setColor(i)}
                className={`flex size-9 items-center justify-center rounded-full ${color === i ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`}
                style={{ background: c.bg }}
              >
                <span className="size-3.5 rounded-full" style={{ background: c.dot }} />
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs text-stone-500">Категория</label>
          {active ? (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mb-4 w-full rounded-2xl bg-stone-100 px-3 py-2">
              <option value="">Без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mb-4 px-1 text-stone-700">{project.frozenCategoryName ? `Была «${project.frozenCategoryName}»` : 'Без категории'}</p>
          )}

          <div className="rounded-2xl bg-stone-50 p-4 text-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'}`}>
                {active || !project.archivedAt ? 'Активный' : `В архиве с ${dateFormat.format(project.archivedAt)}`}
              </span>
              <span className="text-stone-500">
                {count} {pluralRu(count, ['помидор', 'помидора', 'помидоров'])}
              </span>
            </div>
            <button
              type="button"
              className="w-full rounded-xl bg-stone-900 py-2.5 font-medium text-white"
              onClick={() => void (active ? archiveProject(project) : restoreProject(project))}
            >
              {active ? 'Убрать в архив' : 'Вернуть из архива'}
            </button>
          </div>

          <button type="button" className="mt-4 w-full rounded-2xl bg-red-50 py-2.5 font-medium text-red-700" onClick={() => void remove()}>
            Удалить проект
          </button>
        </div>
      </div>
    </div>
  )
}
