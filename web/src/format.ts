export const POMODORO_MINUTES = 20

// Цвет помидора; тот же, что --color-tomato в index.css
export const TOMATO = '#e5483b'

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} ч`, m && `${m} мин`].filter(Boolean).join(' ') || '0 мин'
}

// Штриховка параллельного помидора: у всех проектов, что шли в нём вместе, клетка одинаково полосатая
export function hatch(color: string) {
  return `repeating-linear-gradient(-45deg, ${color} 0 3px, color-mix(in srgb, ${color} 25%, white) 3px 6px)`
}
