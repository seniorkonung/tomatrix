import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addPomodoros, createProject, db, type Project } from './db'
import { formatMinutes, POMODORO_MINUTES } from './format'
import { pluralRu } from './plural'
import { ProjectChip } from './ProjectChip'
import { ProjectEditor } from './ProjectEditor'
import { tabKey, useProjectTabs } from './projectTabs'
import { ProjectTabsSheet } from './ProjectTabsSheet'

const archivedFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })

// Единственное место, где добавляются помидоры: сколько и каким проектам они посвящены
export function AddSheet({ day, onClose }: { day: Date; onClose: () => void }) {
  const projects = useLiveQuery(() => db.projects.toArray())
  const tabs = useProjectTabs()
  const [count, setCount] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tabId, setTabId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingTabs, setEditingTabs] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  if (!projects || !tabs) return null

  const categories = tabs.flatMap((t) => (t.kind === 'category' ? [t.category] : []))
  // Открывается первая вкладка; если выбранную категорию удалили — тоже
  const tab = tabs.find((t) => tabKey(t) === tabId) ?? tabs[0]
  const activeCategory = tab.kind === 'category' ? tab.category : undefined
  const q = query.trim().toLowerCase()
  // Поиск идёт по всем проектам, без поиска — по выбранной вкладке
  const shown = projects
    .filter((p) => {
      if (q) return p.name.toLowerCase().includes(q)
      if (tab.kind === 'archived') return p.status === 'archived'
      if (p.status !== 'active') return false
      return tab.kind === 'all' || p.categoryId === activeCategory?.id
    })
    .sort((a, b) =>
      a.status !== b.status
        ? a.status === 'active'
          ? -1
          : 1
        : a.status === 'archived'
          ? (b.archivedAt ?? 0) - (a.archivedAt ?? 0)
          : a.name.localeCompare(b.name, 'ru'),
    )
  const canCreate = q !== '' && !projects.some((p) => p.name.toLowerCase() === q)
  const selected = selectedIds.flatMap((id) => projects.find((p) => p.id === id) ?? [])

  const toggle = (project: Project) =>
    setSelectedIds((ids) => (ids.includes(project.id) ? ids.filter((id) => id !== project.id) : [...ids, project.id]))

  async function create() {
    const project = await createProject(query.trim(), activeCategory?.id ?? null)
    setQuery('')
    toggle(project)
  }

  async function add() {
    await addPomodoros(count, selected, day)
    onClose()
  }

  const tabClass = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`
  const stepClass = 'flex size-10 items-center justify-center rounded-full bg-stone-100 text-xl disabled:opacity-30'

  // Вложенные панели — не внутри подложки: нажатие на их подложку не должно закрывать и эту
  return (
    <>
      <div className="fixed inset-0 z-10 mx-auto flex max-w-xl flex-col justify-end bg-black/30" onClick={onClose}>
        <div className="flex h-[90dvh] flex-col rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <button type="button" className="text-sm text-stone-500" onClick={onClose}>
              Отмена
            </button>
            <h2 className="font-semibold">Помидоры на {dayFormat.format(day)}</h2>
            <span className="w-12" />
          </div>

          <div className="flex items-center justify-center gap-4 py-3">
            <button type="button" aria-label="Меньше" className={stepClass} disabled={count === 1} onClick={() => setCount(count - 1)}>
              −
            </button>
            <div className="w-32 text-center">
              <div className="text-3xl font-semibold tabular-nums">{count}</div>
              <div className="text-xs text-stone-400">
                {pluralRu(count, ['помидор', 'помидора', 'помидоров'])} · {formatMinutes(count * POMODORO_MINUTES)}
              </div>
            </div>
            <button type="button" aria-label="Больше" className={stepClass} onClick={() => setCount(count + 1)}>
              +
            </button>
          </div>

          <div className="flex min-h-9 flex-wrap items-center gap-1.5 px-4 pb-2">
            {selected.length === 0 ? (
              <span className="text-sm text-stone-400">Выберите проекты, которым посвящены помидоры</span>
            ) : (
              selected.map((p) => <ProjectChip key={p.id} project={p} onClick={() => toggle(p)} />)
            )}
          </div>

          <div className="px-4 pb-2">
            <input
              value={query}
              placeholder="Найти или создать проект"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (canCreate) void create()
                else if (shown[0]) toggle(shown[0])
              }}
              className="w-full rounded-2xl bg-stone-100 px-3 py-2 outline-none"
            />
          </div>

          {!q && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2">
              {tabs.map((t) => (
                <button key={tabKey(t)} type="button" className={tabClass(t === tab)} onClick={() => setTabId(tabKey(t))}>
                  {t.kind === 'category' ? t.category.name : t.kind === 'all' ? 'Все' : 'Архив'}
                </button>
              ))}
              {/* Пунктир и без заливки: действие, а не ещё одна категория */}
              <button
                type="button"
                aria-label="Изменить вкладки"
                className="flex shrink-0 items-center rounded-full border border-dashed border-stone-300 px-3 text-stone-500"
                onClick={() => setEditingTabs(true)}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
            </div>
          )}

          <ul className="flex-1 overflow-y-auto px-2">
            {canCreate && (
              <li>
                <button type="button" className="w-full rounded-2xl px-3 py-3 text-left text-tomato" onClick={() => void create()}>
                  Создать «{query.trim()}»{activeCategory ? ` в «${activeCategory.name}»` : ''}
                </button>
              </li>
            )}
            {shown.map((project) => {
              const isSelected = selectedIds.includes(project.id)
              const categoryName =
                project.status === 'archived' ? project.frozenCategoryName : categories.find((c) => c.id === project.categoryId)?.name
              return (
                <li key={project.id} className="flex items-center">
                  <button
                    type="button"
                    className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${isSelected ? 'bg-stone-100' : ''}`}
                    onClick={() => toggle(project)}
                  >
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                        isSelected ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                    <span className="flex min-w-0 flex-col items-start">
                      <ProjectChip project={project} />
                      {(categoryName || project.status === 'archived') && (
                        <span className="mt-0.5 truncate text-xs text-stone-400">
                          {project.status === 'archived' && project.archivedAt ? `в архиве с ${archivedFormat.format(project.archivedAt)}` : ''}
                          {project.status === 'archived' && categoryName ? ' · ' : ''}
                          {categoryName}
                        </span>
                      )}
                    </span>
                  </button>
                  <button type="button" className="px-3 py-3 text-sm text-stone-500" onClick={() => setEditingId(project.id)}>
                    Изменить
                  </button>
                </li>
              )
            })}
            {shown.length === 0 && !canCreate && (
              <li className="px-3 py-4 text-sm text-stone-400">
                {tab.kind === 'archived' ? 'В архиве проектов нет' : 'Проектов нет — введите название, чтобы создать'}
              </li>
            )}
          </ul>

          <div className="px-4 pt-2">
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => void add()}
              className="w-full rounded-2xl bg-tomato py-3 font-medium text-white disabled:opacity-40"
            >
              Добавить {count} {pluralRu(count, ['помидор', 'помидора', 'помидоров'])}
            </button>
          </div>
        </div>
      </div>
      {editingTabs && <ProjectTabsSheet tabs={tabs} onClose={() => setEditingTabs(false)} />}
      {editingId && <ProjectEditor projectId={editingId} onClose={() => setEditingId(null)} />}
    </>
  )
}
