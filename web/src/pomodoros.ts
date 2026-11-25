import { db, type Period, type Pomodoro } from './db'
import { startOfDay } from './periods'

// Помидор в выбранный день получает нынешнее время суток этого дня
export async function fillCell(activityId: string, index: number, day: Date) {
  const now = new Date()
  const createdAt = day.getTime() + (now.getTime() - startOfDay(now).getTime())
  await db.pomodoros.add({ id: crypto.randomUUID(), createdAt, cells: { [activityId]: index } })
}

// Общий помидор остаётся в других занятиях; помидор без ячеек удаляется
export async function emptyCell(pomodoro: Pomodoro, activityId: string) {
  const { [activityId]: _, ...cells } = pomodoro.cells
  if (Object.keys(cells).length === 0) await db.pomodoros.delete(pomodoro.id)
  else await db.pomodoros.update(pomodoro.id, { cells })
}

// Делает выбранные ячейки одним помидором. selected: id занятия → помидор, чья ячейка выбрана.
// Ячейка, с которой выбор сняли, остаётся заполненной отдельным помидором
// periods: id занятия → его период
export async function linkCells(sharedId: string, selected: Record<string, string>, periods: Record<string, Period>) {
  await db.transaction('rw', db.pomodoros, async () => {
    const shared = await db.pomodoros.get(sharedId)
    if (!shared) return
    const cells: Record<string, number> = {}
    // Ячейки занятий на день все в выбранном дне, на неделю — в его неделе. Время из ячейки
    // занятия на день оставляет каждую ячейку в показанном периоде её занятия
    let createdAt: number | undefined
    const dayTime = (activityId: string, p: Pomodoro) => (periods[activityId] === 'day' ? p.createdAt : undefined)
    for (const [activityId, index] of Object.entries(shared.cells)) {
      if (selected[activityId] === shared.id) {
        cells[activityId] = index
        createdAt ??= dayTime(activityId, shared)
      }      else await db.pomodoros.add({ id: crypto.randomUUID(), createdAt: shared.createdAt, cells: { [activityId]: index } })
    }
    for (const [activityId, occupantId] of Object.entries(selected)) {
      if (occupantId === shared.id) continue
      // Перечитывается: предыдущий шаг мог забрать у него ячейку другого занятия
      const occupant = await db.pomodoros.get(occupantId)
      if (!occupant || !(activityId in occupant.cells)) continue
      cells[activityId] = occupant.cells[activityId]
      createdAt ??= dayTime(activityId, occupant)
      await emptyCell(occupant, activityId)
    }
    await db.pomodoros.update(shared.id, { cells, createdAt: createdAt ?? shared.createdAt })
  })
}
