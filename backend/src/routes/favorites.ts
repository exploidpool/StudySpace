import { Hono } from 'hono'
import type { Env, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'
import { JOIN_SELECT, type MaterialJoined } from './materials'

export const favoritesRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

favoritesRoute.use('*', authMiddleware)

favoritesRoute.get('/', async (c) => {
  const userId = c.get('user').id
  const rows = await c.env.DB.prepare(
    `${JOIN_SELECT}
     JOIN favorites fav ON fav.material_id = m.id AND fav.user_id = ?
     WHERE m.visibility = 'public' AND m.status = 'published'
     ORDER BY fav.created_at DESC, m.id DESC`,
  )
    .bind(userId, userId)
    .all<MaterialJoined>()
  return c.json(rows.results)
})