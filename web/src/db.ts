import Dexie, { type EntityTable } from 'dexie'
import { periodStart } from './periods'

export type ProjectStatus = 'active' | 'archived'

// Проект — пометка, которой помидоры группируются по цели или постоянному занятию, как тег в tallystick.
// Цель это или постоянное занятие — соглашение пользователя, приложение их не различает
export type Project = {
  id: string
  name: string
  createdAt: number
  // Индекс в палитре projectColors
  color: number
  status: ProjectStatus
  categoryId: string | null
  // Название категории на момент ухода в архив: проект в архиве её замораживает
  frozenCategoryName: string | null
  archivedAt: number | null
}

// Группа активных проектов, как папка в Телеграме; во вкладках выбора проектов
export type Category = {
  id: string
  name: string
  createdAt: number
}

// Помидор — 20 минут внимания, посвящённые одному или нескольким проектам сразу
export type Pomodoro = {
  id: string
  createdAt: number
  projectIds: string[]
}

// Настройки приложения по ключу
export type Setting =
  // Порядок вкладок выбора проектов: 'all', 'archived' и id категорий
  | { id: 'projectTabOrder'; value: string[] }
  // Категории, проекты которых показывает главный экран; null — проекты без категории, пустой список — все
  | { id: 'statsCategories'; value: (string | null)[] }

// Цвет проекта: точка, текст и фон плашки
export const projectColors = [
  { dot: '#4A9168', text: '#3D7A57', bg: '#E6EFE4' },
  { dot: '#D9773F', text: '#A64B1F', bg: '#F6E5DA' },
  { dot: '#4B6FC2', text: '#3557A6', bg: '#E3E9F5' },
  { dot: '#7A5AC9', text: '#5B3FA3', bg: '#ECE6F6' },
  { dot: '#2F8F8A', text: '#2F6F6C', bg: '#DFEDEB' },
  { dot: '#8A6D3B', text: '#6E5528', bg: '#F0E8DA' },
  { dot: '#C04A7A', text: '#9A3560', bg: '#F5E1EA' },
  { dot: '#B8912F', text: '#8A6A17', bg: '#F5EDD6' },
  { dot: '#5C6B7A', text: '#47535F', bg: '#E5E9ED' },
]

export const db = new Dexie('tomatrix') as Dexie & {
  projects: EntityTable<Project, 'id'>
  categories: EntityTable<Category, 'id'>
  pomodoros: EntityTable<Pomodoro, 'id'>
  settings: EntityTable<Setting, 'id'>
}

db.version(1).stores({
  activities: 'id, order',
  pomodoros: 'id, createdAt, *activityIds',
})

// Помидор занимает конкретную ячейку занятия: ячейки раскладываются по порядку времени внутри периода
db.version(2)
  .stores({ pomodoros: 'id, createdAt' })
  .upgrade(async (tx) => {
    const periods = new Map<string, 'day' | 'week'>()
    await tx.table('activities').each((a) => periods.set(a.id, a.period))
    const taken = new Map<string, number>()
    const pomodoros = await tx.table('pomodoros').orderBy('createdAt').toArray()
    for (const p of pomodoros) {
      p.cells = {}
      for (const id of p.activityIds as string[]) {
        const key = `${id}:${periodStart(periods.get(id) ?? 'day', new Date(p.createdAt))}`
        const index = taken.get(key) ?? 0
        taken.set(key, index + 1)
        p.cells[id] = index
      }
      delete p.activityIds
    }
    await tx.table('pomodoros').bulkPut(pomodoros)
  })

// У цели появился вид; прежние цели означали «не меньше»
db.version(3)
  .stores({})
  .upgrade(async (tx) => {
    await tx.table('activities').toCollection().modify((activity) => {
      activity.goalKind ??= 'min'
    })
  })

// Занятия с целями на период стали проектами, которые только копят помидоры. Помидор больше не занимает
// ячейку, а просто посвящён проектам
db.version(4)
  .stores({
    activities: null,
    projects: 'id, status',
    categories: 'id, createdAt',
    settings: 'id',
    pomodoros: 'id, createdAt, *projectIds',
  })
  .upgrade(async (tx) => {
    const activities = await tx.table('activities').orderBy('order').toArray()
    await tx.table('projects').bulkAdd(
      activities.map((a, i) => ({
        id: a.id,
        name: a.name,
        createdAt: a.createdAt,
        color: i % projectColors.length,
        status: 'active',
        categoryId: null,
        frozenCategoryName: null,
        archivedAt: null,
      })),
    )
    await tx.table('pomodoros').toCollection().modify((p) => {
      p.projectIds = Object.keys(p.cells)
      delete p.cells
    })
  })

// Новый проект получает цвет, который реже всего встречается у активных проектов, — соседние не сливаются
export async function createProject(name: string, categoryId: string | null) {
  const active = await db.projects.where('status').equals('active').toArray()
  const uses = projectColors.map((_, i) => active.filter((p) => p.color === i).length)
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    color: uses.indexOf(Math.min(...uses)),
    status: 'active',
    categoryId,
    frozenCategoryName: null,
    archivedAt: null,
  }
  await db.projects.add(project)
  return project
}

export async function archiveProject(project: Project) {
  await db.transaction('rw', db.projects, db.categories, async () => {
    const category = project.categoryId ? await db.categories.get(project.categoryId) : undefined
    await db.projects.update(project.id, { status: 'archived', archivedAt: Date.now(), frozenCategoryName: category?.name ?? null })
  })
}

// Проект возвращается из архива в прежнюю категорию, если она ещё есть
export async function restoreProject(project: Project) {
  await db.transaction('rw', db.projects, db.categories, async () => {
    const category = project.categoryId ? await db.categories.get(project.categoryId) : undefined
    await db.projects.update(project.id, { status: 'active', archivedAt: null, categoryId: category?.id ?? null, frozenCategoryName: null })
  })
}

// Проект снимается со всех помидоров; помидор только этого проекта удаляется — без проекта его не бывает
export async function deleteProject(projectId: string) {
  await db.transaction('rw', db.projects, db.pomodoros, async () => {
    const pomodoros = await db.pomodoros.where('projectIds').equals(projectId).toArray()
    await db.pomodoros.bulkDelete(pomodoros.filter((p) => p.projectIds.length === 1).map((p) => p.id))
    await db.pomodoros.bulkPut(
      pomodoros.filter((p) => p.projectIds.length > 1).map((p) => ({ ...p, projectIds: p.projectIds.filter((id) => id !== projectId) })),
    )
    await db.projects.delete(projectId)
  })
}

// Проекты удалённой категории остаются без категории
export async function deleteCategory(categoryId: string) {
  await db.transaction('rw', db.projects, db.categories, async () => {
    await db.projects.filter((p) => p.categoryId === categoryId).modify({ categoryId: null })
    await db.categories.delete(categoryId)
  })
}

// Помидоры в выбранный день получают нынешнее время суток этого дня.
// Проекты из архива, которым посвящён помидор, возвращаются из него
export async function addPomodoros(count: number, projects: Project[], day: Date) {
  const now = new Date()
  const time = now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const projectIds = projects.map((p) => p.id)
  await db.transaction('rw', db.pomodoros, db.projects, db.categories, async () => {
    // Миллисекунда между помидорами сохраняет их порядок
    await db.pomodoros.bulkAdd(Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), createdAt: day.getTime() + time + i, projectIds })))
    for (const p of projects) if (p.status === 'archived') await restoreProject(p)
  })
}
