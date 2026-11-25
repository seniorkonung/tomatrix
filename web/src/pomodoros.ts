import { db, type Pomodoro } from './db'

export async function fillCell(activityId: string, index: number) {
  await db.pomodoros.add({ id: crypto.randomUUID(), createdAt: Date.now(), cells: { [activityId]: index } })
}

// Общий помидор остаётся в других занятиях; помидор без ячеек удаляется
export async function emptyCell(pomodoro: Pomodoro, activityId: string) {
  const { [activityId]: _, ...cells } = pomodoro.cells
  if (Object.keys(cells).length === 0) await db.pomodoros.delete(pomodoro.id)
  else await db.pomodoros.update(pomodoro.id, { cells })
}

// Делает выбранные ячейки одним помидором. selected: id занятия → помидор, чья ячейка выбрана.
// Ячейка, с которой выбор сняли, остаётся заполненной отдельным помидором
export async function linkCells(sharedId: string, selected: Record<string, string>) {
  await db.transaction('rw', db.pomodoros, async () => {
    const shared = await db.pomodoros.get(sharedId)
    if (!shared) return
    const cells: Record<string, number> = {}
    let createdAt = shared.createdAt
    for (const [activityId, index] of Object.entries(shared.cells)) {
      if (selected[activityId] === shared.id) cells[activityId] = index
      else await db.pomodoros.add({ id: crypto.randomUUID(), createdAt: shared.createdAt, cells: { [activityId]: index } })
    }
    for (const [activityId, occupantId] of Object.entries(selected)) {
      if (occupantId === shared.id) continue
      // Перечитывается: предыдущий шаг мог забрать у него ячейку другого занятия
      const occupant = await db.pomodoros.get(occupantId)
      if (!occupant || !(activityId in occupant.cells)) continue
      cells[activityId] = occupant.cells[activityId]
      // Самое позднее время оставляет каждую ячейку в текущем периоде её занятия
      createdAt = Math.max(createdAt, occupant.createdAt)
      await emptyCell(occupant, activityId)
    }
    await db.pomodoros.update(shared.id, { cells, createdAt })
  })
}
