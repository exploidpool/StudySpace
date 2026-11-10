import { Hono } from 'hono'
import type { Env, SubjectRow, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import { UpdateBuilder, checkColor, checkText, ownedRow, parseId, readJson } from '../validators/study'

export const subjectsRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

subjectsRoute.use('*', authMiddleware)

subjectsRoute.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY name')
    .bind(c.get('user').id)
    .all<SubjectRow>()
  return c.json(rows.results)
})

subjectsRoute.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)
  const name = checkText(body.name, 'name', 100, true)
  if ('error' in name) return c.json({ error: name.error }, 400)
  const description = checkText(body.description, 'description', 2000, false)
  if ('error' in description) return c.json({ error: description.error }, 400)
  const color = checkColor(body.color)
  if ('error' in color) return c.json({ error: color.error }, 400)

  const row = await c.env.DB.prepare(
    'INSERT INTO subjects (user_id, name, description, color) VALUES (?, ?, ?, ?) RETURNING *',
  )
    .bind(c.get('user').id, name.value, description.value, color.value)
    .first<SubjectRow>()
  return c.json(row, 201)
})

subjectsRoute.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<SubjectRow>(c, 'subjects', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)

  const ub = new UpdateBuilder()
  if ('name' in body) {
    const r = checkText(body.name, 'name', 100, true)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('name', r.value)
  }
  if ('description' in body) {
    const r = checkText(body.description, 'description', 2000, false)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('description', r.value)
  }
  if ('color' in body) {
    const r = checkColor(body.color)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('color', r.value)
  }
  if (ub.empty) return c.json({ error: 'nothing_to_update' }, 400)

  const row = await c.env.DB.prepare(ub.sql('subjects'))
    .bind(...ub.values, id, c.get('user').id)
    .first<SubjectRow>()
  return c.json(row)
})

subjectsRoute.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<SubjectRow>(c, 'subjects', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const userId = c.get('user').id

  // Связанные записи сохраняем: снимаем только ссылку на предмет
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE lessons SET subject_id = NULL WHERE subject_id = ? AND user_id = ?').bind(id, userId),
    c.env.DB.prepare('UPDATE tasks SET subject_id = NULL WHERE subject_id = ? AND user_id = ?').bind(id, userId),
    c.env.DB.prepare('UPDATE notes SET subject_id = NULL WHERE subject_id = ? AND user_id = ?').bind(id, userId),
    c.env.DB.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?').bind(id, userId),
  ])
  return c.json({ ok: true })
})