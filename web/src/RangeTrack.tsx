import { useRef } from 'react'
import type { Span } from './flows'

// Захват края отрезка: не меньше этого в пикселях, даже когда помидоры на шкале узкие
const EDGE_PX = 14

// Шкала потока с отрезком проекта. Край тянется — отрезок длиннее или короче, середина — отрезок сдвигается,
// касание мимо отрезка дотягивает до этого места ближний край. Всё по целым помидорам
export function RangeTrack({ length, span, color, onChange }: { length: number; span: Span; color: string; onChange: (span: Span) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'start' | 'end' | 'move'; x: number; span: Span } | null>(null)
  const [start, end] = span

  // Положение пальца на шкале в помидорах и ширина помидора в пикселях
  const measure = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    return { at: ((clientX - rect.left) / rect.width) * length, slot: rect.width / length }
  }
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  function apply(mode: 'start' | 'end' | 'move', clientX: number, from: Span, x0: number) {
    const { at, slot } = measure(clientX)
    if (mode === 'start') onChange([clamp(Math.round(at), 0, from[1] - 1), from[1]])
    else if (mode === 'end') onChange([from[0], clamp(Math.round(at), from[0] + 1, length)])
    else {
      const delta = clamp(Math.round((clientX - x0) / slot), -from[0], length - from[1])
      onChange([from[0] + delta, from[1] + delta])
    }
  }

  return (
    <div
      ref={track}
      className="relative h-9 touch-none select-none"
      onPointerDown={(e) => {
        const { at, slot } = measure(e.clientX)
        const edge = Math.max(EDGE_PX, slot / 3) / slot
        let mode: 'start' | 'end' | 'move'
        if (Math.abs(at - start) <= edge && at < (start + end) / 2) mode = 'start'
        else if (Math.abs(at - end) <= edge) mode = 'end'
        else if (at > start && at < end) mode = 'move'
        else mode = at < start ? 'start' : 'end'
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { mode, x: e.clientX, span }
        // Касание мимо отрезка сразу дотягивает до помидора под пальцем
        if (mode === 'start' && at < start) onChange([Math.floor(at), end])
        if (mode === 'end' && at > end) onChange([start, Math.ceil(at)])
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (d) apply(d.mode, e.clientX, d.span, d.x)
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="absolute inset-y-1.5 inset-x-0 flex gap-0.5">
        {Array.from({ length }, (_, i) => (
          <span key={i} className="flex-1 rounded-sm bg-stone-100" />
        ))}
      </div>
      <div
        className="absolute inset-y-1 flex items-center justify-between rounded-md px-1"
        style={{ left: `${(start / length) * 100}%`, width: `${((end - start) / length) * 100}%`, background: color }}
      >
        {/* Ручки краёв */}
        <span className="h-4 w-1 rounded-full bg-white/80" />
        <span className="h-4 w-1 rounded-full bg-white/80" />
      </div>
    </div>
  )
}
