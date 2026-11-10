import { Hono } from 'hono'
import type { Env, ReportRow, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import { parseId, readJson } from '../validators/study'

export const adminRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

adminRoute.use('*', authMiddleware)
adminRoute.use('*', async (c, next) => {
  if (c.get('user').role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  await next()
})

adminRoute.get('/reports', async (c) => {
  const status = c.req.query('status') ?? 'open'
  if (!['open', 'resolved', 'all'].includes(status)) return c.json({ error: 'status_invalid' }, 400)
  const where = status === 'all' ? '' : 'WHERE r.status = ?'
  const stmt = c.env.DB.prepare(
    `SELECT r.*, m.title AS material_title, u.first_name AS reporter_name, u.username AS reporter_username
     FROM reports r
     JOIN materials m ON m.id = r.material_id
     JOIN users u ON u.id = r.user_id
     ${where}
     ORDER BY r.created_at DESC, r.id DESC`,
  )
  const rows = status === 'all' ? await stmt.all() : await stmt.bind(status).all()
  return c.json(rows.results)
})

adminRoute.patch('/reports/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'id_invalid' }, 400)
  const existing = await c.env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first<ReportRow>()
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_json' }, 400)
  if (body.status !== 'open' && body.status !== 'resolved') return c.json({ error: 'status_invalid' }, 400)
  const row = await c.env.DB.prepare(
    "UPDATE reports SET status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
  )
    .bind(body.status, id)
    .first<ReportRow>()
  return c.json(row)
})