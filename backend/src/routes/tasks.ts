import { Hono } from 'hono'
import type { Env, TaskRow, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import {
  UpdateBuilder,
  checkDue,
  checkStatus,
  checkSubjectId,
  checkText,
  ownedRow,
  parseId,
  readJson,
  subjectOwned,
} from '../validators/study'

export const tasksRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

tasksRoute.use('*', authMiddleware)

tasksRoute.get('/', async (c) => {
  const userId = c.get('user').id
  const conditions = ['user_id = ?']
  const values: unknown[] = [userId]

  const status = c.req.query('status')
  if (status !== undefined) {
    if (status !== 'new' && status !== 'in_progress' && status !== 'done') {
      return c.json({ error: 'status_invalid' }, 400)
    }
    conditions.push('status = ?')
    values.push(status)
  }
  const subjectRaw = c.req.query('subject_id')
  if (subjectRaw !== undefined) {
    const subjectId = Number(subjectRaw)
    if (!Number.isInteger(subjectId) || subjectId <= 0) return c.json({ error: 'subject_id_invalid' }, 400)
    conditions.push('subject_id = ?')
    values.push(subjectId)
  }

  const rows = await c.env.DB.prepare(
    `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY (due_at IS NULL), due_at, id`,
  )
    .bind(...values)
    .all<TaskRow>()
  return c.json(rows.results)
})

tasksRoute.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)
  const title = checkText(body.title, 'title', 200, true)
  if ('error' in title) return c.json({ error: title.error }, 400)
  const description = checkText(body.description, 'description', 5000, false)
  if ('error' in description) return c.json({ error: description.error }, 400)
  const status = checkStatus(body.status)
  if ('error' in status) return c.json({ error: status.error }, 400)
  const due = checkDue(body.due_at)
  if ('error' in due) return c.json({ error: due.error }, 400)
  const subject = checkSubjectId(body.subject_id)
  if ('error' in subject) return c.json({ error: subject.error }, 400)
  if (subject.value !== null && !(await subjectOwned(c, subject.value))) {
    return c.json({ error: 'subject_not_found' }, 404)
  }

  const row = await c.env.DB.prepare(
    `INSERT INTO tasks (user_id, subject_id, title, description, status, due_at)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
  )
    .bind(c.get('user').id, subject.value, title.value, description.value, status.value, due.value)
    .first<TaskRow>()
  return c.json(row, 201)
})

tasksRoute.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<TaskRow>(c, 'tasks', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)

  const ub = new UpdateBuilder()
  if ('title' in body) {
    const r = checkText(body.title, 'title', 200, true)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('title', r.value)
  }
  if ('description' in body) {
    const r = checkText(body.description, 'description', 5000, false)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('description', r.value)
  }
  if ('status' in body) {
    const r = checkStatus(body.status)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('status', r.value)
  }
  if ('due_at' in body) {
    const r = checkDue(body.due_at)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('due_at', r.value)
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

  const row = await c.env.DB.prepare(ub.sql('tasks'))
    .bind(...ub.values, id, c.get('user').id)
    .first<TaskRow>()
  return c.json(row)
})

tasksRoute.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<TaskRow>(c, 'tasks', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(id, c.get('user').id).run()
  return c.json({ ok: true })
})