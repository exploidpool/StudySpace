import { createMiddleware } from 'hono/factory'
import type { Env, UserRow } from '../types'
import { validateInitData } from '../utils/telegram'

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: { user: UserRow } }>(
  async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('tma ')) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const tgUser = await validateInitData(
      header.slice(4),
      c.env.TELEGRAM_BOT_TOKEN,
      Math.floor(Date.now() / 1000),
    )
    if (!tgUser) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const row = await c.env.DB.prepare(
      `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(telegram_id) DO UPDATE SET
         username = excluded.username,
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         photo_url = excluded.photo_url,
         updated_at = datetime('now')
       RETURNING *`,
    )
      .bind(tgUser.id, tgUser.username ?? null, tgUser.first_name, tgUser.last_name ?? null, tgUser.photo_url ?? null)
      .first<UserRow>()
    if (!row) {
      return c.json({ error: 'internal' }, 500)
    }

    await c.env.DB.prepare('INSERT OR IGNORE INTO profiles (user_id) VALUES (?)').bind(row.id).run()
    c.set('user', row)
    await next()
  },
)