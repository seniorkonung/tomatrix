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

// Связывает ячейку занятия с общим помидором или отвязывает её от него.
// occupant — помидор, который сейчас в этой ячейке
export async function toggleLink(shared: Pomodoro, activityId: string, index: number, occupant: Pomodoro | undefined) {
  await db.transaction('rw', db.pomodoros, async () => {
    if (occupant?.id === shared.id) {
      // Отвязанная ячейка остаётся заполненной отдельным помидором
      await emptyCell(shared, activityId)
      await db.pomodoros.add({ id: crypto.randomUUID(), createdAt: shared.createdAt, cells: { [activityId]: index } })
      return
    }
    if (occupant) await emptyCell(occupant, activityId)
    // Самое позднее время оставляет каждую ячейку в текущем периоде её занятия
    await db.pomodoros.update(shared.id, {
      createdAt: Math.max(shared.createdAt, occupant?.createdAt ?? Date.now()),
      cells: { ...shared.cells, [activityId]: index },
    })
  })
}
