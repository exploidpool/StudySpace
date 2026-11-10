import { Hono } from 'hono'
import type { Env, FileRow, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import { parseId } from '../validators/study'
import {
  MAX_FILES_PER_USER,
  MAX_FILE_BYTES,
  deleteFromChannel,
  detectFormat,
  downloadFromChannel,
  uploadToChannel,
} from '../utils/storage'

export const filesRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

filesRoute.use('*', authMiddleware)

const PUBLIC_COLS =
  'id, name, mime, ext, size_bytes, created_at, ' +
  "(SELECT COUNT(*) FROM materials m WHERE m.file_id = files.id AND m.visibility = 'public' AND m.status = 'published') AS published"

filesRoute.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT ${PUBLIC_COLS} FROM files WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
  )
    .bind(c.get('user').id)
    .all()
  return c.json(rows.results)
})

filesRoute.post('/', async (c) => {
  const userId = c.get('user').id
  if (!c.env.TELEGRAM_STORAGE_CHANNEL_ID) return c.json({ error: 'storage_not_configured' }, 503)

  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) return c.json({ error: 'file_required' }, 400)

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length === 0) return c.json({ error: 'file_empty' }, 400)
  if (bytes.length > MAX_FILE_BYTES) return c.json({ error: 'file_too_large' }, 400)

  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM files WHERE user_id = ?')
    .bind(userId)
    .first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_FILES_PER_USER) return c.json({ error: 'files_limit' }, 400)

  const format = detectFormat(file.name, file.type, bytes)
  if ('error' in format) return c.json({ error: format.error }, 400)

  const stored = await uploadToChannel(c.env, bytes, file.name, format.value.mime)
  if (!stored) return c.json({ error: 'storage_upload_failed' }, 502)

  const row = await c.env.DB.prepare(
    `INSERT INTO files (user_id, telegram_file_id, telegram_message_id, name, mime, ext, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING ${PUBLIC_COLS}`,
  )
    .bind(userId, stored.file_id, stored.message_id, file.name, format.value.mime, format.value.ext, bytes.length)
    .first()
  return c.json(row, 201)
})

filesRoute.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const row = await c.env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM files WHERE id = ? AND user_id = ?`)
    .bind(id, c.get('user').id)
    .first()
  if (!row) return c.json({ error: 'not_found' }, 404)
  return c.json(row)
})

filesRoute.get('/:id/download', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const row = await c.env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .bind(id, c.get('user').id)
    .first<FileRow>()
  if (!row) return c.json({ error: 'not_found' }, 404)

  const upstream = await downloadFromChannel(c.env, row.telegram_file_id)
  if (!upstream?.ok || !upstream.body) return c.json({ error: 'storage_download_failed' }, 502)
  return new Response(upstream.body, {
    headers: {
      'Content-Type': row.mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'Cache-Control': 'no-store',
    },
  })
})

filesRoute.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const row = await c.env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .bind(id, c.get('user').id)
    .first<FileRow>()
  if (!row) return c.json({ error: 'not_found' }, 404)

  await c.env.DB.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').bind(id, c.get('user').id).run()
  if (row.telegram_message_id !== null) await deleteFromChannel(c.env, row.telegram_message_id)
  return c.json({ ok: true })
})