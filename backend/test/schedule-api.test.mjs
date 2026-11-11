import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

// Execute the actual TypeScript routes under Node without changing production imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL?.includes('/backend/src/') && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(specifier + '.ts', context)
  }
  return nextResolve(specifier, context)
} })
const { default: app } = await import('../src/index.ts')

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys=ON')
  for (const file of ['0001_init.sql', '0002_schedule.sql']) {
    sqlite.exec(readFileSync(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8'))
  }
  const db = { prepare(sql) {
    let params = []
    const prepared = {
      bind(...values) { params = values; return prepared },
      async first() { return sqlite.prepare(sql).get(...params) ?? null },
      async all() { return { results: sqlite.prepare(sql).all(...params) } },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } } },
    }
    return prepared
  }, async batch(statements) {
    sqlite.exec('BEGIN')
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      sqlite.exec('COMMIT')
      return results
    } catch (error) { sqlite.exec('ROLLBACK'); throw error }
  } }
  return { db, sqlite }
}

const token = 'synthetic-local-test-token'
function authorization(id) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now()/1000)), user: JSON.stringify({ id, first_name: 'Synthetic' }) })
  const content = [...params].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', createHmac('sha256', secret).update(content).digest('hex'))
  return `tma ${params}`
}

test('actual API routes enforce Telegram auth, admin rights, drafts and replacement publication', async () => {
  const { db, sqlite } = database()
  try {
    const env = { DB: db, TELEGRAM_BOT_TOKEN: token }
    const request = (path, method='GET', user=1, body) => app.request(`/api/schedule${path}`, {
      method, headers: { ...(user ? { Authorization: authorization(user) } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, env)
    assert.equal((await request('/week', 'GET', null)).status, 401)
    assert.equal((await request('/week')).status, 200)
    const draft = { week_start: '2026-11-09', lessons: [{ day_of_week: 1, start_time: '08:30', end_time: '10:05', subject_name: 'Synthetic lesson', classroom: '10301', teacher: null, subgroup: 1, position: 0 }] }
    for (const [path, method] of [['/drafts','POST'], ['/drafts/missing','PUT'], ['/drafts/missing/publish','POST']]) {
      assert.equal((await request(path, method, 1, draft)).status, 403)
    }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM schedule_weeks').get().n, 0)
    await request('/week', 'GET', 2)
    sqlite.prepare("UPDATE users SET role='admin' WHERE telegram_id=2").run()
    assert.equal((await request('/drafts','POST',2,{...draft,week_start:'2026-11-10'})).status,400)
    const response = await request('/drafts','POST',2,draft)
    assert.equal(response.status,201)
    const { id } = await response.json()
    assert.equal((await (await request('/week?week_start=2026-11-09')).json()).week, null)
    assert.equal((await request(`/drafts/${id}/publish`,'POST',2)).status,200)
    const published = (await (await request('/week?week_start=2026-11-09')).json()).week
    assert.equal(published.id,id)
    assert.equal(published.lessons[0].classroom,'10301')
    assert.equal((await request(`/drafts/${id}`,'PUT',2,draft)).status,409)
    const second = await (await request('/drafts','POST',2,{...draft,lessons:[]})).json()
    assert.equal((await request(`/drafts/${second.id}/publish`,'POST',2)).status,200)
    assert.equal((await request(`/drafts/${id}/publish`,'POST',2)).status,409)
    assert.equal((await (await request('/week?week_start=2026-11-09')).json()).week.id,second.id)
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM schedule_weeks WHERE status='published'").get().n,1)
    assert.equal((await request('/today')).status,200)
  } finally { sqlite.close() }
})
