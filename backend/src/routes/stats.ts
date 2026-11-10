import { Hono } from 'hono'
import type { Env, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'

export const statsRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

statsRoute.use('*', authMiddleware)

statsRoute.get('/', async (c) => {
  const userId = c.get('user').id
  const row = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM subjects WHERE user_id = ?) AS subjects,
       (SELECT COUNT(*) FROM notes WHERE user_id = ?) AS notes,
       (SELECT COUNT(*) FROM tasks WHERE user_id = ?) AS tasks_total,
       (SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'done') AS tasks_done,
       (SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status != 'done') AS tasks_active,
       (SELECT COUNT(*) FROM materials WHERE user_id = ? AND visibility = 'public' AND status = 'published') AS materials_published`,
  )
    .bind(userId, userId, userId, userId, userId, userId)
    .first<{ subjects: number; notes: number; tasks_total: number; tasks_done: number; tasks_active: number; materials_published: number }>()

  const total = row?.tasks_total ?? 0
  const done = row?.tasks_done ?? 0
  return c.json({
    subjects: row?.subjects ?? 0,
    notes: row?.notes ?? 0,
    tasks_total: total,
    tasks_done: done,
    tasks_active: row?.tasks_active ?? 0,
    materials_published: row?.materials_published ?? 0,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
  })
})