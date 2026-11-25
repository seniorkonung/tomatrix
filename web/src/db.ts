import Dexie, { type EntityTable } from 'dexie'

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
  createdAt: number
  activityIds: string[]
}

export const db = new Dexie('tomatrix') as Dexie & {
  activities: EntityTable<Activity, 'id'>
  pomodoros: EntityTable<Pomodoro, 'id'>
}

db.version(1).stores({
  activities: 'id, order',
  pomodoros: 'id, createdAt, *activityIds',
})
