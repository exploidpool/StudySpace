import { Hono } from 'hono'
import type { Env, NoteRow, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import {
  UpdateBuilder,
  checkSubjectId,
  checkText,
  escapeLike,
  ownedRow,
  parseId,
  readJson,
  subjectOwned,
} from '../validators/study'

export const notesRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

notesRoute.use('*', authMiddleware)

notesRoute.get('/', async (c) => {
  const userId = c.get('user').id
  const q = (c.req.query('q') ?? '').trim()
  if (q.length > 200) return c.json({ error: 'q_too_long' }, 400)

  if (q) {
    const pattern = `%${escapeLike(q)}%`
    const rows = await c.env.DB.prepare(
      `SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
       ORDER BY updated_at DESC, id DESC`,
    )
      .bind(userId, pattern, pattern)
      .all<NoteRow>()
    return c.json(rows.results)
  }
  const rows = await c.env.DB.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC, id DESC')
    .bind(userId)
    .all<NoteRow>()
  return c.json(rows.results)
})

notesRoute.post('/', async (c) => {
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)
  const title = checkText(body.title, 'title', 200, true)
  if ('error' in title) return c.json({ error: title.error }, 400)
  const content = checkText(body.content, 'content', 50000, false)
  if ('error' in content) return c.json({ error: content.error }, 400)
  const subject = checkSubjectId(body.subject_id)
  if ('error' in subject) return c.json({ error: subject.error }, 400)
  if (subject.value !== null && !(await subjectOwned(c, subject.value))) {
    return c.json({ error: 'subject_not_found' }, 404)
  }

  const row = await c.env.DB.prepare(
    'INSERT INTO notes (user_id, subject_id, title, content) VALUES (?, ?, ?, ?) RETURNING *',
  )
    .bind(c.get('user').id, subject.value, title.value, content.value)
    .first<NoteRow>()
  return c.json(row, 201)
})

notesRoute.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<NoteRow>(c, 'notes', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)

  const ub = new UpdateBuilder()
  if ('title' in body) {
    const r = checkText(body.title, 'title', 200, true)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('title', r.value)
  }
  if ('content' in body) {
    const r = checkText(body.content, 'content', 50000, false)
    if ('error' in r) return c.json({ error: r.error }, 400)
    ub.put('content', r.value)
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

  const row = await c.env.DB.prepare(ub.sql('notes'))
    .bind(...ub.values, id, c.get('user').id)
    .first<NoteRow>()
  return c.json(row)
})

notesRoute.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await ownedRow<NoteRow>(c, 'notes', id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  await c.env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(id, c.get('user').id).run()
  return c.json({ ok: true })
})