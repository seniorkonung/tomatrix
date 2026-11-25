// Отрезок проекта на шкале потока в помидорах: [start, end), 0 ≤ start < end ≤ длина потока
export type Span = [start: number, end: number]

export type Spans = Record<string, Span>

// Клетка — один помидор проекта в потоке; параллельный не добавляет времени
export type Cell<F> = { flow: F; parallel: boolean }

export const spanLength = ([start, end]: Span) => end - start

// Сколько проектов покрывает каждый помидор потока
export function coverage(spans: Spans, length: number) {
  const cover = Array<number>(length).fill(0)
  for (const [start, end] of Object.values(spans)) for (let i = start; i < end; i++) cover[i]++
  return cover
}

// Помидоры, которые не покрыл ни один проект, убираются, а отрезки после них сдвигаются:
// поток укорачивается, как будто этого времени не было
export function compact(spans: Spans, length: number): { spans: Spans; length: number } {
  const cover = coverage(spans, length)
  // Новое место каждой границы — сколько покрытых помидоров перед ней
  const shift = [0]
  for (let i = 0; i < length; i++) shift.push(shift[i] + (cover[i] > 0 ? 1 : 0))
  return {
    spans: Object.fromEntries(Object.entries(spans).map(([id, [start, end]]) => [id, [shift[start], shift[end]]])),
    length: shift[length],
  }
}

// Отрезки подряд по убыванию длины; не уместившиеся в поток прижимаются к его концу и идут параллельно.
// Для потоков, у которых были только числа помидоров
export function layoutCounts(counts: Record<string, number>, length: number): Spans {
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

// Клетки проекта по помидорам его отрезка. Помидор, где шли несколько проектов, сплошной у главного из них —
// с самым длинным отрезком, при равных раньше выбранного, — у остальных штрихованный. Так сплошных клеток
// всех проектов ровно столько, сколько помидоров в потоке
export function cellsOf<F extends { spans: Spans }>(flow: F, projectId: string): Cell<F>[] {
  const order = Object.entries(flow.spans).sort((a, b) => spanLength(b[1]) - spanLength(a[1]))
  const [start, end] = flow.spans[projectId]
  const cells: Cell<F>[] = []
  for (let i = start; i < end; i++) {
    const main = order.find(([, [s, e]]) => s <= i && i < e)?.[0]
    cells.push({ flow, parallel: main !== projectId })
  }
  return cells
}
