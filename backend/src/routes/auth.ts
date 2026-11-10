import { Hono } from 'hono'
import type { Env, UserRow } from '../types'
import { authMiddleware } from '../middleware/auth'

export const authRoute = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>()

authRoute.use('*', authMiddleware)

authRoute.get('/me', async (c) => {
  const user = c.get('user')
  const profile = await c.env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(user.id).first()
  return c.json({ user, profile })
})