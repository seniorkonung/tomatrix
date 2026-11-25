import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteCategory, type Category } from './db'

// Вкладка выбора проектов: все активные, одна категория или архив
export type ProjectTab = { kind: 'all' } | { kind: 'archived' } | { kind: 'category'; category: Category }

export function tabKey(tab: ProjectTab) {
  return tab.kind === 'category' ? tab.category.id : tab.kind
}

// Вкладки в порядке пользователя. Без сохранённого порядка — «Все», категории по времени создания, «Архив»
export async function loadProjectTabs() {
  const [categories, order] = await Promise.all([db.categories.orderBy('createdAt').toArray(), db.settings.get('projectTabOrder')])
  const keys = order?.id === 'projectTabOrder' ? order.value : []
  const tabs: ProjectTab[] = [{ kind: 'all' }, ...categories.map((category) => ({ kind: 'category' as const, category })), { kind: 'archived' }]
  // Вкладки, которых нет в порядке, идут в конце
  const position = (tab: ProjectTab) => {
    const i = keys.indexOf(tabKey(tab))
    return i === -1 ? keys.length : i
  }
  return tabs.sort((a, b) => position(a) - position(b))
}

export function useProjectTabs() {
  return useLiveQuery(loadProjectTabs)
}

// Сохраняет все вкладки разом: порядок, названия и новые категории; проекты удалённых категорий остаются без категории
export async function saveProjectTabs(tabs: ProjectTab[], deletedIds: string[]) {
  await db.transaction('rw', db.projects, db.categories, db.settings, async () => {
    for (const id of deletedIds) await deleteCategory(id)
    await db.categories.bulkPut(tabs.flatMap((t) => (t.kind === 'category' ? [{ ...t.category, name: t.category.name.trim() }] : [])))
    await db.settings.put({ id: 'projectTabOrder', value: tabs.map(tabKey) })
  })
}
