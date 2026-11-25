import type { Flow } from './db'

// Клетка — один помидор проекта в потоке; параллельный не добавляет времени
export type Cell = { flow: Flow; parallel: boolean }

// Время потока заполняют проекты с большим числом помидоров; что не уместилось в длину потока —
// помидоры, которые шли параллельно. При равных числах раньше выбранный проект идёт первым
export function splitFlow(flow: Flow) {
  let left = flow.length
  return Object.entries(flow.counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]): [string, { solid: number; parallel: number }] => {
      const solid = Math.min(count, left)
      left -= solid
      return [id, { solid, parallel: count - solid }]
    })
}
