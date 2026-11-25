import Dexie, { type EntityTable } from 'dexie'
import { periodStart } from './periods'

export type Period = 'day' | 'week'

// Важное занятие, между которыми распределяется внимание
export type Activity = {
  id: string
  name: string
  createdAt: number
  // Позиция в ленте
  order: number
  // Сколько помидоров хочется потратить на занятие за период
  goal: number
  period: Period
}

// Помидор — 20 минут внимания. Обычно потрачен на одно занятие, но может делиться между несколькими
export type Pomodoro = {
  id: string
  // Задаёт период, к которому помидор относится в каждом своём занятии
  createdAt: number
  // id занятия → номер ячейки, которую помидор занимает в нём за период
  cells: Record<string, number>
}

export const db = new Dexie('tomatrix') as Dexie & {
  activities: EntityTable<Activity, 'id'>
  pomodoros: EntityTable<Pomodoro, 'id'>
}

db.version(1).stores({
  activities: 'id, order',
  pomodoros: 'id, createdAt, *activityIds',
})

// Помидор занимает конкретную ячейку занятия: ячейки раскладываются по порядку времени внутри периода
db.version(2)
  .stores({ pomodoros: 'id, createdAt' })
  .upgrade(async (tx) => {
    const periods = new Map<string, Period>()
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
