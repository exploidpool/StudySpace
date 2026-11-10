import { Hono } from 'hono'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
  return c.json({ status: 'ok', database: row?.ok === 1 })
})

app.notFound((c) => c.json({ error: 'not_found' }, 404))

export default app