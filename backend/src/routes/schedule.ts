import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { authMiddleware } from '../middleware/auth'
import type { Env, UserRow } from '../types'
import { GROUP_CODE, monday, parseDraft, today, validDate } from '../schedule/model'
import type { Lesson, WeekRow } from '../schedule/model'
import { publishDraft } from '../schedule/publish'

export const scheduleRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()
scheduleRoute.use('*', authMiddleware)
scheduleRoute.use('*', bodyLimit({ maxSize: 256 * 1024, onError: (c) => c.json({ error: 'body_too_large' }, 413) }))
scheduleRoute.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.get('user').role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  await next()
})

async function published(db: D1Database, weekStart: string) {
  const week = await db.prepare("SELECT id, week_start, status FROM schedule_weeks WHERE group_code = ? AND week_start = ? AND status = 'published'").bind(GROUP_CODE, weekStart).first<WeekRow>()
  if (!week) return null
  const rows = await db.prepare('SELECT day_of_week, start_time, end_time, subject_name, classroom, teacher, subgroup, position FROM lessons WHERE schedule_week_id = ? ORDER BY day_of_week, start_time, position, subgroup').bind(week.id).all<Lesson>()
  return { ...week, lessons: rows.results }
}

scheduleRoute.get('/week', async (c) => {
  const weekStart = c.req.query('week_start') ?? monday(today())
  if (!validDate(weekStart) || monday(weekStart) !== weekStart) return c.json({ error: 'invalid_week_start' }, 400)
  return c.json({ week: await published(c.env.DB, weekStart) })
})
scheduleRoute.get('/today', async (c) => {
  const date = today()
  const week = await published(c.env.DB, monday(date))
  const day = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7 + 1
  return c.json({ date, lessons: week?.lessons.filter((lesson) => lesson.day_of_week === day) ?? [] })
})

function insertLessons(db: D1Database, id: string, rows: Lesson[]) {
  // The guard also protects against editing a draft concurrently published by another admin.
  return db.prepare(`INSERT INTO lessons (schedule_week_id, day_of_week, start_time, end_time, subject_name, classroom, teacher, subgroup, position)
    SELECT ?, json_extract(value, '$.day_of_week'), json_extract(value, '$.start_time'),
      json_extract(value, '$.end_time'), json_extract(value, '$.subject_name'), json_extract(value, '$.classroom'),
      json_extract(value, '$.teacher'), json_extract(value, '$.subgroup'), json_extract(value, '$.position')
    FROM json_each(?) WHERE EXISTS (SELECT 1 FROM schedule_weeks WHERE id = ? AND status = 'draft')`)
    .bind(id, JSON.stringify(rows), id)
}
scheduleRoute.post('/drafts', async (c) => {
  const draft = parseDraft(await c.req.json().catch(() => null))
  if (!draft) return c.json({ error: 'invalid_schedule' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO schedule_weeks (id, group_code, week_start, created_by) VALUES (?, ?, ?, ?)').bind(id, GROUP_CODE, draft.week_start, c.get('user').id),
    insertLessons(c.env.DB, id, draft.lessons),
  ])
  return c.json({ id }, 201)
})
scheduleRoute.put('/drafts/:id', async (c) => {
  const draft = parseDraft(await c.req.json().catch(() => null))
  if (!draft) return c.json({ error: 'invalid_schedule' }, 400)
  const id = c.req.param('id')
  const result = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE schedule_weeks SET week_start = ?, updated_at = datetime('now') WHERE id = ? AND status = 'draft'").bind(draft.week_start, id),
    c.env.DB.prepare("DELETE FROM lessons WHERE schedule_week_id = ? AND EXISTS (SELECT 1 FROM schedule_weeks WHERE id = ? AND status = 'draft')").bind(id, id),
    insertLessons(c.env.DB, id, draft.lessons),
  ])
  if (!result[0].meta.changes) return c.json({ error: 'draft_not_found_or_published' }, 409)
  return c.json({ id })
})
scheduleRoute.post('/drafts/:id/publish', async (c) => {
  const id = c.req.param('id')
  if (!await publishDraft(c.env.DB, id)) return c.json({ error: 'draft_not_found_or_published' }, 409)
  return c.json({ id })
})
