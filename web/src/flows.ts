// Номера помидоров потока, которые занимал проект: по возрастанию, от 0 до длины потока
export type Slots = Record<string, number[]>

// Клетка — один помидор проекта в потоке. Параллельный — в нём шли и другие проекты; так он отмечен у всех них
export type Cell<F> = { flow: F; slot: number; parallel: boolean }

// Сколько проектов занимало каждый помидор потока
export function coverage(slots: Slots, length: number) {
  const cover = Array<number>(length).fill(0)
  for (const list of Object.values(slots)) for (const i of list) cover[i]++
  return cover
}

// Помидоры, которые не занимал ни один проект, убираются, а следующие за ними сдвигаются:
// поток укорачивается, как будто этого времени не было. Проекты без помидоров выпадают из потока
export function compact(slots: Slots, length: number): { slots: Slots; length: number } {
  const cover = coverage(slots, length)
  // Новый номер каждого помидора — сколько занятых помидоров перед ним
  const shift = [0]
  for (let i = 0; i < length; i++) shift.push(shift[i] + (cover[i] > 0 ? 1 : 0))
  return {
    slots: Object.fromEntries(Object.entries(slots).flatMap(([id, list]) => (list.length ? [[id, list.map((i) => shift[i])]] : []))),
    length: shift[length],
  }
}

export function cellsOf<F extends { slots: Slots; length: number }>(flow: F, projectId: string): Cell<F>[] {
  const cover = coverage(flow.slots, flow.length)
  return flow.slots[projectId].map((slot) => ({ flow, slot, parallel: cover[slot] > 1 }))
}

// Все помидоры потока каждому проекту: проекты шли параллельно всё время
export function allSlots(projectIds: string[], length: number): Slots {
  return Object.fromEntries(projectIds.map((id) => [id, Array.from({ length }, (_, i) => i)]))
}

// Отрезки подряд по убыванию длины; не уместившиеся в поток прижимаются к его концу и идут параллельно.
// Только для миграции версии 6, когда у потоков были числа помидоров
export function layoutCounts(counts: Record<string, number>, length: number): Record<string, [number, number]> {
  let cursor = 0
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => {
        const start = Math.min(cursor, length - count)
        cursor += count
        return [id, [start, start + count]]
      }),
  )
}
