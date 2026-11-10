import { Hono } from 'hono'
import type { Env, FileRow, MaterialRow, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import { checkText, escapeLike, parseId, readJson } from '../validators/study'
import { downloadFromChannel } from '../utils/storage'

export const materialsRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

materialsRoute.use('*', authMiddleware)

const FORMATS = ['pdf', 'docx', 'pptx', 'txt', 'png', 'jpg']

export interface MaterialJoined extends MaterialRow {
  ext: string
  size_bytes: number
  file_name: string
  author_id: number
  author_name: string
  author_username: string | null
  favorites_count: number
  is_favorite: number
}

export const JOIN_SELECT = `
  SELECT m.*, f.ext, f.size_bytes, f.name AS file_name,
         u.id AS author_id, u.first_name AS author_name, u.username AS author_username,
         (SELECT COUNT(*) FROM favorites fav WHERE fav.material_id = m.id) AS favorites_count,
         EXISTS(SELECT 1 FROM favorites fav WHERE fav.material_id = m.id AND fav.user_id = ?) AS is_favorite
  FROM materials m
  JOIN files f ON f.id = m.file_id
  JOIN users u ON u.id = m.user_id`

function canView(user: UserRow, m: MaterialRow): boolean {
  if (m.user_id === user.id || user.role === 'admin') return true
  return m.visibility === 'public' && m.status === 'published'
}

async function loadJoined(c: { env: Env; get: (k: 'user') => UserRow }, id: number): Promise<MaterialJoined | null> {
  return c.env.DB.prepare(`${JOIN_SELECT} WHERE m.id = ?`).bind(c.get('user').id, id).first<MaterialJoined>()
}

materialsRoute.get('/', async (c) => {
  const userId = c.get('user').id
  const conditions = ["m.visibility = 'public'", "m.status = 'published'"]
  const binds: unknown[] = [userId]

  const q = c.req.query('q')
  if (q) {
    conditions.push("m.title LIKE ? ESCAPE '\\'")
    binds.push(`%${escapeLike(q)}%`)
  }
  const subject = c.req.query('subject')
  if (subject) {
    conditions.push("m.subject LIKE ? ESCAPE '\\'")
    binds.push(`%${escapeLike(subject)}%`)
  }
  const format = c.req.query('format')
  if (format) {
    if (!FORMATS.includes(format)) return c.json({ error: 'format_invalid' }, 400)
    conditions.push('f.ext = ?')
    binds.push(format)
  }

  const rows = await c.env.DB.prepare(
    `${JOIN_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY m.created_at DESC, m.id DESC`,
  )
    .bind(...binds)
    .all<MaterialJoined>()
  return c.json(rows.results)
})

materialsRoute.post('/', async (c) => {
  const userId = c.get('user').id
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)

  const fileId = body.file_id
  if (typeof fileId !== 'number' || !Number.isInteger(fileId) || fileId <= 0) {
    return c.json({ error: 'file_id_invalid' }, 400)
  }
  const file = await c.env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .bind(fileId, userId)
    .first<FileRow>()
  if (!file) return c.json({ error: 'file_not_found' }, 404)

  const title = checkText(body.title, 'title', 150, true)
  if ('error' in title) return c.json({ error: title.error }, 400)
  const description = checkText(body.description, 'description', 2000, false)
  if ('error' in description) return c.json({ error: description.error }, 400)

  // Публикация в общую библиотеку — явное действие; сменить приватность иначе нельзя.
  if (body.visibility !== 'public') return c.json({ error: 'visibility_invalid' }, 400)

  let subject = ''
  let subjectId: number | null = null
  if (typeof body.subject_id === 'number' && body.subject_id > 0) {
    const subj = await c.env.DB.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?')
      .bind(body.subject_id, userId)
      .first<{ name: string }>()
    if (!subj) return c.json({ error: 'subject_not_found' }, 404)
    subject = subj.name
    subjectId = body.subject_id
  } else {
    const r = checkText(body.subject, 'subject', 100, false)
    if ('error' in r) return c.json({ error: r.error }, 400)
    subject = r.value
  }

  const row = await c.env.DB.prepare(
    `INSERT INTO materials (file_id, user_id, subject_id, subject, title, description, visibility, status)
     VALUES (?, ?, ?, ?, ?, ?, 'public', 'published') RETURNING *`,
  )
    .bind(fileId, userId, subjectId, subject, title.value, description.value)
    .first<MaterialRow>()
  return c.json(row, 201)
})

materialsRoute.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const row = await loadJoined(c, id)
  if (!row || !canView(c.get('user'), row)) return c.json({ error: 'not_found' }, 404)
  return c.json(row)
})

materialsRoute.get('/:id/download', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const row = await loadJoined(c, id)
  if (!row || !canView(c.get('user'), row)) return c.json({ error: 'not_found' }, 404)
  const file = await c.env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(row.file_id).first<FileRow>()
  if (!file) return c.json({ error: 'not_found' }, 404)

  const upstream = await downloadFromChannel(c.env, file.telegram_file_id)
  if (!upstream?.ok || !upstream.body) return c.json({ error: 'storage_download_failed' }, 502)
  return new Response(upstream.body, {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'no-store',
    },
  })
})

materialsRoute.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const user = c.get('user')
  const existing = await c.env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first<MaterialRow>()
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const isAuthor = existing.user_id === user.id
  const isAdmin = user.role === 'admin'
  if (!isAuthor && !isAdmin) return c.json({ error: 'not_found' }, 404)

  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)

  const sets: string[] = []
  const values: unknown[] = []
  if (isAdmin && 'status' in body) {
    if (body.status !== 'published' && body.status !== 'hidden') return c.json({ error: 'status_invalid' }, 400)
    sets.push('status = ?')
    values.push(body.status)
  }
  if (isAuthor) {
    if ('title' in body) {
      const r = checkText(body.title, 'title', 150, true)
      if ('error' in r) return c.json({ error: r.error }, 400)
      sets.push('title = ?'); values.push(r.value)
    }
    if ('description' in body) {
      const r = checkText(body.description, 'description', 2000, false)
      if ('error' in r) return c.json({ error: r.error }, 400)
      sets.push('description = ?'); values.push(r.value)
    }
    if ('subject' in body) {
      const r = checkText(body.subject, 'subject', 100, false)
      if ('error' in r) return c.json({ error: r.error }, 400)
      sets.push('subject = ?'); values.push(r.value)
    }
  }
  if (sets.length === 0) return c.json({ error: 'nothing_to_update' }, 400)

  const row = await c.env.DB.prepare(
    `UPDATE materials SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? RETURNING *`,
  )
    .bind(...values, id)
    .first<MaterialRow>()
  return c.json(row)
})

materialsRoute.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const user = c.get('user')
  const existing = await c.env.DB.prepare('SELECT * FROM materials WHERE id = ?').bind(id).first<MaterialRow>()
  if (!existing) return c.json({ error: 'not_found' }, 404)
  if (existing.user_id !== user.id && user.role !== 'admin') return c.json({ error: 'not_found' }, 404)
  await c.env.DB.prepare('DELETE FROM materials WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

materialsRoute.post('/:id/favorite', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const row = await loadJoined(c, id)
  if (!row || !canView(c.get('user'), row)) return c.json({ error: 'not_found' }, 404)
  await c.env.DB.prepare('INSERT OR IGNORE INTO favorites (user_id, material_id) VALUES (?, ?)')
    .bind(c.get('user').id, id)
    .run()
  return c.json({ ok: true })
})

materialsRoute.delete('/:id/favorite', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  await c.env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND material_id = ?')
    .bind(c.get('user').id, id)
    .run()
  return c.json({ ok: true })
})

materialsRoute.post('/:id/report', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const userId = c.get('user').id
  const row = await loadJoined(c, id)
  if (!row || !canView(c.get('user'), row)) return c.json({ error: 'not_found' }, 404)
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)
  const reason = checkText(body.reason, 'reason', 1000, true)
  if ('error' in reason) return c.json({ error: reason.error }, 400)

  const dup = await c.env.DB.prepare(
    "SELECT id FROM reports WHERE user_id = ? AND material_id = ? AND status = 'open'",
  )
    .bind(userId, id)
    .first()
  if (dup) return c.json({ error: 'already_reported' }, 400)

  const report = await c.env.DB.prepare(
    'INSERT INTO reports (user_id, material_id, reason) VALUES (?, ?, ?) RETURNING *',
  )
    .bind(userId, id, reason.value)
    .first()
  return c.json(report, 201)
})