import { Hono } from 'hono'
import type { Env } from './types'
import { authRoute } from './routes/auth'
import { subjectsRoute } from './routes/subjects'
import { lessonsRoute } from './routes/lessons'
import { tasksRoute } from './routes/tasks'
import { notesRoute } from './routes/notes'
import { statsRoute } from './routes/stats'
import { filesRoute } from './routes/files'
import { materialsRoute } from './routes/materials'
import { favoritesRoute } from './routes/favorites'
import { adminRoute } from './routes/admin'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
  return c.json({ status: 'ok', database: row?.ok === 1 })
})

app.route('/api/auth', authRoute)
app.route('/api/subjects', subjectsRoute)
app.route('/api/lessons', lessonsRoute)
app.route('/api/tasks', tasksRoute)
app.route('/api/notes', notesRoute)
app.route('/api/stats', statsRoute)
app.route('/api/files', filesRoute)
app.route('/api/materials', materialsRoute)
app.route('/api/favorites', favoritesRoute)
app.route('/api/admin', adminRoute)

app.notFound((c) => c.json({ error: 'not_found' }, 404))

export default app