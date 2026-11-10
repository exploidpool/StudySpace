import { Hono } from 'hono'
import type { Env, LessonRow, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import {
  UpdateBuilder,
  checkInt,
  checkSubjectId,
  checkText,
  checkTime,
  ownedRow,
  parseId,
  readJson,
  subjectOwned,
} from '../validators/study'

export const lessonsRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

lessonsRoute.use('*', authMiddleware)

lessonsRoute.get('/', async (c) => {
  const userId = c.get('user').id
  const weekdayRaw = c.req.query('weekday')
  if (weekdayRaw !== undefined) {
    const weekday = Number(weekdayRaw)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return c.json({ error: 'weekday_invalid' }, 400)
    }
    const rows = await c.env.DB.prepare(
      'SELECT * FROM lessons WHERE user_id = ? AND weekday = ? ORDER BY start_time',
    )
      .bind(userId, weekday)
      .all<LessonRow>()
    return c.json(rows.results)
  }
  const rows = await c.env.DB.prepare('SELECT * FROM lessons WHERE user_id = ? ORDER BY weekday, start_time')
    .bind(userId)
    .all<LessonRow>()
  return c.json(rows.results)
})

lessonsRoute.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)
  const title = checkText(body.title, 'title', 100, true)
  if ('error' in title) return c.json({ error: title.error }, 400)
  const weekday = checkInt(body.weekday, 'weekday', 0, 6)
  if ('error' in weekday) return c.json({ error: weekday.error }, 400)
  const start = checkTime(body.start_time, 'start_time')
  if ('error' in start) return c.json({ error: start.error }, 400)
  const end = checkTime(body.end_time, 'end_time')
  if ('error' in end) return c.json({ error: end.error }, 400)
  if (end.value <= start.value) return c.json({ error: 'time_order_invalid' }, 400)
  const room = checkText(body.room, 'room', 50, false)
  if ('error' in room) return c.json({ error: room.error }, 400)
  const teacher = checkText(body.teacher, 'teacher', 100, false)
  if ('error' in teacher) return c.json({ error: teacher.error }, 400)
  const subject = checkSubjectId(body.subject_id)
  if ('error' in subject) return c.json({ error: subject.error }, 400)
  if (subject.value !== null && !(await subjectOwned(c, subject.value))) {
    return c.json({ error: 'subject_not_found' }, 404)
  }

  const row = await c.env.DB.prepare(
    `INSERT INTO lessons (user_id, subject_id, title, weekday, start_time, end_time, room, teacher)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(c.get('user').id, subject.value, title.value, weekday.value, start.value, end.value, room.value, teacher.value)
    .first<LessonRow>()
  return c.json(row, 201)
})

lessonsRoute.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<LessonRow>(c, 'lessons', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)

  const ub = new UpdateBuilder()
  let start = existing.start_time
  let end = existing.end_time
  if ('title' in body) {
    const r = checkText(body.title, 'title', 100, true)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('title', r.value)
  }
  if ('weekday' in body) {
    const r = checkInt(body.weekday, 'weekday', 0, 6)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('weekday', r.value)
  }
  if ('start_time' in body) {
    const r = checkTime(body.start_time, 'start_time')
    if ('error' in r) return c.json({ error: r.error }, 400)
    start = r.value
    ub.put('start_time', r.value)
  }
  if ('end_time' in body) {
    const r = checkTime(body.end_time, 'end_time')
    if ('error' in r) return c.json({ error: r.error }, 400)
    end = r.value
    ub.put('end_time', r.value)
  }
  if (end <= start) return c.json({ error: 'time_order_invalid' }, 400)
  if ('room' in body) {
    const r = checkText(body.room, 'room', 50, false)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('room', r.value)
  }
  if ('teacher' in body) {
    const r = checkText(body.teacher, 'teacher', 100, false)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('teacher', r.value)
  }
  if ('subject_id' in body) {
    const r = checkSubjectId(body.subject_id)
    if ('error' in r) return c.json({ error: r.error }, 400)
    if (r.value !== null && !(await subjectOwned(c, r.value))) {
      return c.json({ error: 'subject_not_found' }, 404)
    }
    ub.put('subject_id', r.value)
  }
  if (ub.empty) return c.json({ error: 'nothing_to_update' }, 400)

  const row = await c.env.DB.prepare(ub.sql('lessons'))
    .bind(...ub.values, id, c.get('user').id)
    .first<LessonRow>()
  return c.json(row)
})

lessonsRoute.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<LessonRow>(c, 'lessons', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  await c.env.DB.prepare('DELETE FROM lessons WHERE id = ? AND user_id = ?').bind(id, c.get('user').id).run()
  return c.json({ ok: true })
})