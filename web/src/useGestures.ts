import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const DECIDE_PX = 10
const SWIPE_PX = 50
const TOGGLE_PX = 60

type Handlers = {
  expanded: boolean
  // Насколько от свёрнутого (0) до раскрытого (1) календарь, пока страницу тянут; null — палец отпущен
  onPull: (progress: number | null) => void
  onToggle: (expanded: boolean) => void
  // direction: 1 — вперёд (свайп влево), -1 — назад; inCalendar — свайп начат на календаре
  onSwipe: (direction: 1 | -1, inCalendar: boolean) => void
}

// Жесты страницы: потянуть вниз в начале страницы или по календарю — раскрыть его,
// вверх по календарю — свернуть; по странице вверх она просто листается.
// Свайп влево или вправо — сменить дату
export function useGestures(root: RefObject<HTMLElement | null>, range: number, handlers: Handlers) {
  const latest = useRef(handlers)
  useLayoutEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    const el = root.current
    if (!el) return
    let g: { x: number; y: number; mode: 'h' | 'pull' | 'none' | null; inCalendar: boolean; base: number } | null = null
    // Касание после жеста не должно нажать кнопку под пальцем
    let suppressClick = false

    const start = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        g = null
        return
      }
      const t = e.touches[0]
      const inCalendar = !!(e.target as Element).closest('[data-calendar]')
      g = { x: t.clientX, y: t.clientY, mode: null, inCalendar, base: latest.current.expanded ? 1 : 0 }
    }

    const move = (e: TouchEvent) => {
      if (!g) return
      const t = e.touches[0]
      const dx = t.clientX - g.x
      const dy = t.clientY - g.y
      const atTop = window.scrollY <= 0
      if (g.mode === null) {
        // Иначе браузер начнёт тянуть страницу раньше, чем жест распознан
        if (atTop && dy > 0 && e.cancelable) e.preventDefault()
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE_PX) return
        const opens = dy > 0 && g.base === 0 && (atTop || g.inCalendar)
        const closes = dy < 0 && g.base === 1 && g.inCalendar
        if (Math.abs(dx) > Math.abs(dy)) g.mode = 'h'
        else if (opens || closes) g.mode = 'pull'
        else g.mode = 'none'
      }
      if (g.mode === 'pull') {
        if (e.cancelable) e.preventDefault()
        latest.current.onPull(Math.min(1, Math.max(0, g.base + dy / range)))
      } else if (g.mode === 'h' && e.cancelable) e.preventDefault()
    }

    const end = (e: TouchEvent) => {
      if (!g) return
      const t = e.changedTouches[0]
      const dx = t.clientX - g.x
      const dy = t.clientY - g.y
      if (g.mode === 'pull') {
        latest.current.onPull(null)
        latest.current.onToggle(g.base === 0 ? dy > TOGGLE_PX : dy > -TOGGLE_PX)
      } else if (g.mode === 'h' && Math.abs(dx) > SWIPE_PX) {
        latest.current.onSwipe(dx < 0 ? 1 : -1, g.inCalendar)
      }
      if (g.mode === 'pull' || g.mode === 'h') {
        suppressClick = true
        setTimeout(() => (suppressClick = false), 400)
      }
      g = null
    }

    const click = (e: MouseEvent) => {
      if (!suppressClick) return
      e.preventDefault()
      e.stopPropagation()
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    el.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('click', click, true)
    }
  }, [root, range])
}
