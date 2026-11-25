import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { addFlow, createProject, db, projectColors, type Project } from './db'
import { coverage, spanLength, type Span, type Spans } from './flows'
import { formatMinutes, POMODORO_MINUTES } from './format'
import { pluralRu } from './plural'
import { ProjectChip } from './ProjectChip'
import { ProjectEditor } from './ProjectEditor'
import { tabKey, useProjectTabs } from './projectTabs'
import { ProjectTabsSheet } from './ProjectTabsSheet'
import { RangeTrack } from './RangeTrack'

const archivedFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayWithYearFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

const addDays = (day: Date, days: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + days)
const pad = (n: number) => String(n).padStart(2, '0')
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function dayLabel(day: Date, today: Date) {
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000)
  const date = (day.getFullYear() === today.getFullYear() ? dayFormat : dayWithYearFormat).format(day).replace(' г.', '')
  return diff === 0 ? `Сегодня, ${date}` : diff === 1 ? `Вчера, ${date}` : date
}

// Добавление потока: сколько он длился, в какой день и какой отрезок его шкалы занимал каждый проект.
// По умолчанию — сегодня; можно выбрать прошлый день, но не будущий
export function AddSheet({ today, onClose }: { today: Date; onClose: () => void }) {
  const projects = useLiveQuery(() => db.projects.toArray())
  const tabs = useProjectTabs()
  const [length, setLength] = useState(1)
  const [day, setDay] = useState(today)
  const dateInput = useRef<HTMLInputElement>(null)
  // Проекты потока в порядке выбора и их отрезки на шкале потока
  const [parts, setParts] = useState<{ id: string; span: Span }[]>([])
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
  const selected = parts.flatMap((part) => {
    const project = projects.find((p) => p.id === part.id)
    return project ? [{ project, span: part.span }] : []
  })
  const spans: Spans = Object.fromEntries(selected.map((part) => [part.project.id, part.span]))
  const cover = coverage(spans, length)
  const uncovered = cover.filter((c) => c === 0).length
  const parallel = cover.reduce((sum, c) => sum + Math.max(0, c - 1), 0)

  // Новый проект занимает первый непокрытый промежуток потока, а если всё покрыто — последний помидор
  const toggle = (project: Project) =>
    setParts((list) => {
      if (list.some((part) => part.id === project.id)) return list.filter((part) => part.id !== project.id)
      const covered = coverage(Object.fromEntries(list.map((part) => [part.id, part.span])), length)
      const gap = covered.indexOf(0)
      let gapEnd = gap
      while (gap !== -1 && gapEnd < length && covered[gapEnd] === 0) gapEnd++
      const span: Span = gap === -1 ? [length - 1, length] : [gap, gapEnd]
      return [...list, { id: project.id, span }]
    })
  const setSpan = (id: string, span: Span) => setParts((list) => list.map((part) => (part.id === id ? { ...part, span } : part)))
  // Отрезки, доходившие до конца потока, идут за ним при удлинении; при укорачивании обрезаются
  const changeLength = (next: number) => {
    setParts((list) =>
      list.map(({ id, span: [start, end] }) => {
        const e = end === length ? next : Math.min(end, next)
        return { id, span: [Math.min(start, e - 1), e] as Span }
      }),
    )
    setLength(next)
  }

  async function create() {
    const project = await createProject(query.trim(), activeCategory?.id ?? null)
    setQuery('')
    toggle(project)
  }

  async function add() {
    await addFlow(length, spans, selected.map((part) => part.project), day)
    onClose()
  }

  const tabClass = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`
  const arrowClass = 'flex size-9 items-center justify-center rounded-full text-stone-500 disabled:opacity-30'
  const stepClass = 'flex size-10 items-center justify-center rounded-full bg-stone-100 text-xl disabled:opacity-30'

  // Вложенные панели — не внутри подложки: нажатие на их подложку не должно закрывать и эту
  return (
    <>
      <div className="fixed inset-0 z-10 mx-auto flex max-w-xl flex-col justify-end bg-black/30" onClick={onClose}>
        <div className="flex h-[90dvh] flex-col rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 px-3 pt-3">
            <button type="button" className="w-16 text-left text-sm text-stone-500" onClick={onClose}>
              Отмена
            </button>
            <span className="flex-1" />
            <button type="button" aria-label="Предыдущий день" className={arrowClass} onClick={() => setDay(addDays(day, -1))}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            {/* Нажатие открывает выбор даты системы: так быстрее уйти далеко в прошлое */}
            <button type="button" className="relative rounded-xl px-2 py-1.5 font-semibold whitespace-nowrap" onClick={() => dateInput.current?.showPicker()}>
              {dayLabel(day, today)}
              <input
                ref={dateInput}
                type="date"
                tabIndex={-1}
                aria-hidden
                max={isoDay(today)}
                value={isoDay(day)}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  if (!y) return
                  const picked = new Date(y, m - 1, d)
                  setDay(picked > today ? today : picked)
                }}
                className="pointer-events-none absolute inset-0 opacity-0"
              />
            </button>
            <button type="button" aria-label="Следующий день" className={arrowClass} disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <span className="flex-1" />
            {/* Противовес «Отмене», чтобы дата стояла по центру */}
            <span className="w-16" />
          </div>

          <div className="flex items-center justify-center gap-4 py-3">
            <button type="button" aria-label="Короче" className={stepClass} disabled={length === 1} onClick={() => changeLength(length - 1)}>
              −
            </button>
            <div className="w-32 text-center">
              <div className="text-3xl font-semibold tabular-nums">{length}</div>
              <div className="text-xs text-stone-400">поток · {formatMinutes(length * POMODORO_MINUTES)}</div>
            </div>
            <button type="button" aria-label="Длиннее" className={stepClass} onClick={() => changeLength(length + 1)}>
              +
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pb-2">
              {selected.length === 0 ? (
                <p className="py-1 text-sm text-stone-400">Выберите проекты и отметьте на шкале, какую часть потока занимал каждый</p>
              ) : (
                <>
                  {/* Покрытие потока: пустые помидоры ещё не отданы проектам, штрихованные — параллельные */}
                  <div className="flex h-3 gap-0.5">
                    {cover.map((c, i) => (
                      <span
                        key={i}
                        className={`flex-1 rounded-sm ${c === 0 ? 'border border-dashed border-amber-500' : c === 1 ? 'bg-tomato' : 'bg-tomato-hatch'}`}
                      />
                    ))}
                  </div>
                  <p className={`mt-1 mb-2 text-sm ${uncovered ? 'text-amber-700' : 'text-stone-500'}`}>
                    {uncovered
                      ? `Не отмечено ${uncovered} ${pluralRu(uncovered, ['помидор', 'помидора', 'помидоров'])}`
                      : parallel
                        ? `Весь поток отмечен · ${parallel} параллельно`
                        : 'Весь поток отмечен'}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {selected.map(({ project, span }) => (
                      <li key={project.id}>
                        <div className="flex items-center justify-between">
                          <ProjectChip project={project} onClick={() => toggle(project)} />
                          <span className="text-sm text-stone-500 tabular-nums">
                            {spanLength(span)} {pluralRu(spanLength(span), ['помидор', 'помидора', 'помидоров'])}
                          </span>
                        </div>
                        <RangeTrack
                          length={length}
                          span={span}
                          color={projectColors[project.color % projectColors.length].dot}
                          onChange={(next) => setSpan(project.id, next)}
                        />
                      </li>
                    ))}
                  </ul>
                </>
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

            <ul className="px-2">
              {canCreate && (
                <li>
                  <button type="button" className="w-full rounded-2xl px-3 py-3 text-left text-tomato" onClick={() => void create()}>
                    Создать «{query.trim()}»{activeCategory ? ` в «${activeCategory.name}»` : ''}
                  </button>
                </li>
              )}
              {shown.map((project) => {
                const isSelected = parts.some((part) => part.id === project.id)
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
          </div>

          <div className="px-4 pt-2">
            {/* Поток добавляется, только когда каждый его помидор отмечен хотя бы у одного проекта */}
            <button
              type="button"
              disabled={selected.length === 0 || uncovered > 0}
              onClick={() => void add()}
              className="w-full rounded-2xl bg-tomato py-3 font-medium text-white disabled:opacity-40"
            >
              Добавить поток · {length} {pluralRu(length, ['помидор', 'помидора', 'помидоров'])}
            </button>
          </div>
        </div>
      </div>
      {editingTabs && <ProjectTabsSheet tabs={tabs} onClose={() => setEditingTabs(false)} />}
      {editingId && <ProjectEditor projectId={editingId} onClose={() => setEditingId(null)} />}
    </>
  )
}
