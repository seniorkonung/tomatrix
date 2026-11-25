import { useRef } from 'react'
import type { Activity, Pomodoro } from './db'
import { emptyCell, fillCell } from './pomodoros'

// Выбор ячеек, на которые потрачен один и тот же помидор. Пока выбор не применён, база не меняется
export type Linking = {
  pomodoroId: string
  // Занятие, в ячейке которого начат выбор
  activityId: string
  // id занятия → помидор, чья ячейка в нём выбрана
  selected: Record<string, string>
}

// Занятие в ленте: цель за период — пустые ячейки, потраченные помидоры их заполняют
export function ActivityCard({
  activity,
  pomodoros,
  linking,
  onEdit,
  onStartLinking,
  onToggleLink,
}: {
  activity: Activity
  // Помидоры занятия за текущий период
  pomodoros: Pomodoro[]
  linking: Linking | null
  onEdit: () => void
  onStartLinking: (pomodoro: Pomodoro) => void
  onToggleLink: (pomodoro: Pomodoro) => void
}) {
  const byIndex = new Map(pomodoros.map((p) => [p.cells[activity.id], p]))
  const size = Math.max(activity.goal, ...[...byIndex.keys()].map((i) => i + 1))
  const reached = pomodoros.length >= activity.goal
  // Когда все ячейки заполнены, помидор можно потратить сверх цели в следующей
  const total = pomodoros.length >= size ? size + 1 : size

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <button onClick={onEdit} disabled={!!linking} className="flex w-full items-baseline justify-between gap-3 text-left">
        <h2 className="truncate font-semibold">{activity.name}</h2>
        <span className={`shrink-0 text-sm tabular-nums ${reached ? 'text-emerald-600' : 'text-stone-400'}`}>
          {pomodoros.length} / {activity.goal} {activity.period === 'day' ? 'сегодня' : 'за неделю'}
        </span>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: total }, (_, index) => {
          const pomodoro = byIndex.get(index)
          const linked = !!linking && !!pomodoro && linking.selected[activity.id] === pomodoro.id
          // При выборе новые помидоры не создаются: выбираются только заполненные ячейки других занятий
          const active = !linking || (!!pomodoro && linking.activityId !== activity.id)
          return (
            <Cell
              key={index}
              pomodoro={pomodoro}
              extra={index >= size}
              linked={linked}
              dimmed={!active && !linked}
              disabled={!active}
              onTap={() => {
                if (linking) onToggleLink(pomodoro!)
                else if (pomodoro) void emptyCell(pomodoro, activity.id)
                else void fillCell(activity.id, index)
              }}
              onLongPress={pomodoro && !linking ? () => onStartLinking(pomodoro) : undefined}
            />
          )
        })}
      </div>
    </section>
  )
}

const LONG_PRESS_MS = 450

function Cell({
  pomodoro,
  extra,
  linked,
  dimmed,
  disabled,
  onTap,
  onLongPress,
}: {
  pomodoro: Pomodoro | undefined
  extra: boolean
  linked: boolean
  dimmed: boolean
  disabled: boolean
  onTap: () => void
  onLongPress?: () => void
}) {
  const timer = useRef<number>(undefined)
  // Долгое нажатие уже сработало — отпускание не считается касанием
  const fired = useRef(false)

  const cancel = () => clearTimeout(timer.current)
  const shared = pomodoro && Object.keys(pomodoro.cells).length > 1

  return (
    <button
      disabled={disabled}
      aria-label={pomodoro ? 'Помидор' : 'Пустая ячейка'}
      onPointerDown={() => {
        fired.current = false
        if (!onLongPress) return
        timer.current = window.setTimeout(() => {
          fired.current = true
          navigator.vibrate?.(15)
          onLongPress()
        }, LONG_PRESS_MS)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (!fired.current) onTap()
      }}
      className={`flex size-9 touch-manipulation items-center justify-center rounded-lg select-none [-webkit-touch-callout:none] transition-opacity ${dimmed ? 'opacity-30' : ''} ${
        pomodoro
          ? 'animate-pop bg-tomato'
          : extra
            ? 'text-lg text-stone-300'
            : 'border-2 border-dashed border-stone-300'
      } ${linked ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`}
    >
      {!pomodoro && extra && '+'}
      {/* Помидор поделён с другими занятиями */}
      {shared && <span className="size-2 rounded-full bg-white/80" />}
    </button>
  )
}
