// Интеграционная проверка авторизации против запущенного `wrangler dev`.
// Запуск: node scripts/verify-initdata.mjs (из папки backend)
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const token = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
  .match(/TELEGRAM_BOT_TOKEN=(.+)/)[1]
  .trim()

const TEST_USER = { id: 999000111, first_name: 'Local', last_name: 'Test', username: 'local_test' }
const BASE = 'http://localhost:8787'
const now = Math.floor(Date.now() / 1000)

function signedParams(authDate, botToken = token) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'AAH-local-test',
    user: JSON.stringify(TEST_USER),
  })
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'))
  return params
}

let passed = 0
let failed = 0
let firstUserId = null

async function check(name, params, expectedStatus, { noHeader = false } = {}) {
  const headers = noHeader ? {} : { Authorization: `tma ${params.toString()}` }
  const res = await fetch(`${BASE}/api/auth/me`, { headers })
  const body = await res.json()
  let ok = res.status === expectedStatus
  if (ok && expectedStatus === 200) {
    ok = body.user?.telegram_id === TEST_USER.id && body.profile?.user_id === body.user?.id
    if (firstUserId === null) firstUserId = body.user.id
    else ok = ok && body.user.id === firstUserId
  }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (HTTP ${res.status})`)
  ok ? passed++ : failed++
}

const valid = signedParams(now)

const tampered = signedParams(now)
const hash = tampered.get('hash')
tampered.set('hash', hash.slice(0, -1) + (hash.endsWith('0') ? '1' : '0'))

await check('корректный initData -> 200, пользователь создан', valid, 200)
await check('повторный вход -> тот же пользователь (upsert)', signedParams(now), 200)
await check('подделанный hash -> 401', tampered, 401)
await check('устаревший auth_date -> 401', signedParams(now - 90000), 401)
await check('auth_date из будущего -> 401', signedParams(now + 3600), 401)
await check('подпись чужим токеном -> 401', signedParams(now, '123456:wrong-token'), 401)
await check('без заголовка Authorization -> 401', valid, 401, { noHeader: true })

console.log(`\nИтог: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)