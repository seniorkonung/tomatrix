import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const DECIDE_PX = 10
const SWIPE_PX = 50

// Свайп влево или вправо по странице; direction: 1 — вперёд (свайп влево), -1 — назад
export function useSwipe(root: RefObject<HTMLElement | null>, onSwipe: (direction: 1 | -1) => void) {
  const latest = useRef(onSwipe)
  useLayoutEffect(() => {
    latest.current = onSwipe
  })

  useEffect(() => {
    const el = root.current
    if (!el) return
    let g: { x: number; y: number; horizontal: boolean | null } | null = null
    // Отпускание пальца после свайпа не должно нажать клетку под ним
    let suppressClick = false

    const start = (e: TouchEvent) => {
      // Новое касание — уже не отпускание после свайпа
      suppressClick = false
      const t = e.touches[0]
      g = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, horizontal: null } : null
    }
    const move = (e: TouchEvent) => {
      if (!g) return
      const dx = e.touches[0].clientX - g.x
      const dy = e.touches[0].clientY - g.y
      if (g.horizontal === null && Math.max(Math.abs(dx), Math.abs(dy)) >= DECIDE_PX) g.horizontal = Math.abs(dx) > Math.abs(dy)
      if (g.horizontal && e.cancelable) e.preventDefault()
    }
    const end = (e: TouchEvent) => {
      if (!g?.horizontal) return
      const dx = e.changedTouches[0].clientX - g.x
      g = null
      suppressClick = true
      setTimeout(() => (suppressClick = false), 400)
      if (Math.abs(dx) > SWIPE_PX) latest.current(dx < 0 ? 1 : -1)
    }
    const click = (e: MouseEvent) => {
      if (!suppressClick) return
      e.preventDefault()
      e.stopPropagation()
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('click', click, true)
    }
  }, [root])
}
