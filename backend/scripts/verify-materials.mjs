// Интеграционная проверка Этапа 4 против запущенного `wrangler dev`.
// Запуск: node scripts/verify-materials.mjs (из папки backend)
// Файловые проверки выполняются только если настроен канал-хранилище
// (TELEGRAM_STORAGE_CHANNEL_ID в .dev.vars). Иначе они честно пропускаются.
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { execSync } from 'node:child_process'

const token = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
  .match(/TELEGRAM_BOT_TOKEN=(.+)/)[1]
  .trim()

const BASE = 'http://localhost:8787'
const USER_A = { id: 999000444, first_name: 'Owner', username: 'owner_test' }
const USER_B = { id: 999000555, first_name: 'Reader', username: 'reader_test' }
const ADMIN = { id: 999000666, first_name: 'Admin', username: 'admin_test' }

function initData(user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAH-materials-test',
    user: JSON.stringify(user),
  })
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'))
  return params.toString()
}

async function req(method, path, { user = USER_A, body } = {}) {
  const headers = user ? { Authorization: `tma ${initData(user)}` } : {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

async function upload(user, name, type, bytes) {
  const form = new FormData()
  form.append('file', new File([bytes], name, { type }))
  const res = await fetch(`${BASE}/api/files`, {
    method: 'POST',
    headers: { Authorization: `tma ${initData(user)}` },
    body: form,
  })
  return { status: res.status, body: await res.json() }
}

let passed = 0
let failed = 0
let skipped = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  ok ? passed++ : failed++
}
function skip(name) {
  console.log(`SKIP ${name} (канал-хранилище не настроен)`)
  skipped++
}

const pdfBytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')
const suffix = Date.now()
const createdFiles = []

// Базовые проверки доступа (не требуют хранилища)
const noAuth = await req('GET', '/files', { user: null })
check('без Authorization -> 401', noAuth.status === 401, `HTTP ${noAuth.status}`)

const pubNoFile = await req('POST', '/materials', { body: { file_id: 'x', title: 'T', visibility: 'public' } })
check('невалидный file_id -> 400', pubNoFile.status === 400, `HTTP ${pubNoFile.status}`)

const reportMissing = await req('POST', '/materials/999999/report', { user: USER_B, body: { reason: 'спам' } })
const favMissing = await req('POST', '/materials/999999/favorite', { user: USER_B })
const dlMissing = await req('GET', '/materials/999999/download', { user: USER_B })
check('жалоба/избранное/скачивание несуществующего -> 404', reportMissing.status === 404 && favMissing.status === 404 && dlMissing.status === 404, `HTTP ${reportMissing.status}/${favMissing.status}/${dlMissing.status}`)

const reportsAsStudent = await req('GET', '/admin/reports', { user: USER_B })
check('модерация недоступна студенту -> 403', reportsAsStudent.status === 403, `HTTP ${reportsAsStudent.status}`)

// Пробуем загрузку, чтобы понять, настроено ли хранилище
const probe = await upload(USER_A, `probe-${suffix}.pdf`, 'application/pdf', pdfBytes)
const storageConfigured = probe.status !== 503
if (probe.status === 201) createdFiles.push(probe.body.id)

if (!storageConfigured) {
  skip('загрузка/скачивание/публикация/избранное/жалобы/модерация')
} else {
  check('загрузка PDF -> 201', probe.status === 201 && probe.body.ext === 'pdf', `HTTP ${probe.status}`)

  const badExt = await upload(USER_A, 'virus.exe', 'application/octet-stream', pdfBytes)
  const badContent = await upload(USER_A, 'fake.pdf', 'application/pdf', new TextEncoder().encode('MZ exe bytes'))
  check('неподдерживаемое расширение/содержимое -> 400', badExt.status === 400 && badContent.status === 400, `HTTP ${badExt.status}/${badContent.status}`)

  const file = probe.body
  const listA = await req('GET', '/files')
  const listB = await req('GET', '/files', { user: USER_B })
  check('личные файлы изолированы', listA.body.some((f) => f.id === file.id) && !listB.body.some((f) => f.id === file.id))

  const dl = await fetch(`${BASE}/api/files/${file.id}/download`, { headers: { Authorization: `tma ${initData(USER_A)}` } })
  const dlBytes = new Uint8Array(await dl.arrayBuffer())
  const dlIdor = await req('GET', `/files/${file.id}/download`, { user: USER_B })
  check('скачивание владельцем = исходные байты, IDOR -> 404', dl.status === 200 && Buffer.from(dlBytes).equals(Buffer.from(pdfBytes)) && dlIdor.status === 404, `HTTP ${dl.status}/${dlIdor.status}`)

  const pub = await req('POST', '/materials', { body: { file_id: file.id, title: `Конспект ${suffix}`, description: 'описание', subject: 'Математика', visibility: 'public' } })
  check('публикация в библиотеку -> 201', pub.status === 201, `HTTP ${pub.status}`)
  const mat = pub.body

  const pubForeign = await req('POST', '/materials', { user: USER_B, body: { file_id: file.id, title: 'чужой', visibility: 'public' } })
  const pubPrivate = await req('POST', '/materials', { body: { file_id: file.id, title: 'приватный', visibility: 'private' } })
  check('чужой файл -> 404, private-публикация -> 400', pubForeign.status === 404 && pubPrivate.status === 400, `HTTP ${pubForeign.status}/${pubPrivate.status}`)

  const libB = await req('GET', '/materials', { user: USER_B })
  const searchHit = await req('GET', `/materials?q=${encodeURIComponent(`Конспект ${suffix}`)}`, { user: USER_B })
  const searchFmt = await req('GET', '/materials?format=pdf', { user: USER_B })
  check('библиотека видна всем + поиск + фильтр формата', libB.body.some((m) => m.id === mat.id) && searchHit.body.some((m) => m.id === mat.id) && searchFmt.body.some((m) => m.id === mat.id))

  const fav = await req('POST', `/materials/${mat.id}/favorite`, { user: USER_B })
  const favList = await req('GET', '/favorites', { user: USER_B })
  check('избранное добавляется и видно в списке', fav.status === 200 && favList.body.some((m) => m.id === mat.id && m.is_favorite === 1))
  const unfav = await req('DELETE', `/materials/${mat.id}/favorite`, { user: USER_B })
  const favList2 = await req('GET', '/favorites', { user: USER_B })
  check('избранное удаляется', unfav.status === 200 && !favList2.body.some((m) => m.id === mat.id))

  const rep = await req('POST', `/materials/${mat.id}/report`, { user: USER_B, body: { reason: 'неподходящий контент' } })
  const repDup = await req('POST', `/materials/${mat.id}/report`, { user: USER_B, body: { reason: 'ещё раз' } })
  check('жалоба -> 201, повторная -> 400', rep.status === 201 && repDup.status === 400, `HTTP ${rep.status}/${repDup.status}`)

  // Админ: повышаем роль через D1, затем модерация
  await req('GET', '/files', { user: ADMIN })
  execSync(`npx wrangler d1 execute studyspace --local --command "UPDATE users SET role='admin' WHERE telegram_id=${ADMIN.id}"`, { stdio: 'ignore' })
  const adminReports = await req('GET', '/admin/reports', { user: ADMIN })
  check('админ видит открытые жалобы', adminReports.status === 200 && adminReports.body.some((r) => r.material_id === mat.id), `HTTP ${adminReports.status}`)

  const hide = await req('PATCH', `/materials/${mat.id}`, { user: ADMIN, body: { status: 'hidden' } })
  const hiddenB = await req('GET', `/materials/${mat.id}`, { user: USER_B })
  const hiddenDlB = await req('GET', `/materials/${mat.id}/download`, { user: USER_B })
  const hiddenA = await req('GET', `/materials/${mat.id}`, { user: USER_A })
  check('скрытие модерацией: читатель теряет доступ, автор видит', hide.status === 200 && hiddenB.status === 404 && hiddenDlB.status === 404 && hiddenA.status === 200, `HTTP ${hide.status}/${hiddenB.status}/${hiddenDlB.status}/${hiddenA.status}`)

  const resolve = await req('PATCH', `/admin/reports/${rep.body.id}`, { user: ADMIN, body: { status: 'resolved' } })
  check('жалоба закрывается админом', resolve.status === 200 && resolve.body.status === 'resolved')

  const republish = await req('PATCH', `/materials/${mat.id}`, { user: ADMIN, body: { status: 'published' } })
  const visibleB = await req('GET', `/materials/${mat.id}`, { user: USER_B })
  check('возврат в библиотеку восстанавливает доступ', republish.status === 200 && visibleB.status === 200)

  const delMatIdor = await req('DELETE', `/materials/${mat.id}`, { user: USER_B })
  check('IDOR удаление публикации -> 404', delMatIdor.status === 404, `HTTP ${delMatIdor.status}`)

  const stats = await req('GET', '/stats')
  check('статистика учитывает публикацию', stats.body.materials_published === 1, JSON.stringify(stats.body))

  const delFile = await req('DELETE', `/files/${file.id}`)
  const listAfter = await req('GET', '/files')
  const libAfter = await req('GET', '/materials', { user: USER_B })
  check('удаление файла убирает публикацию из библиотеки', delFile.status === 200 && !listAfter.body.some((f) => f.id === file.id) && !libAfter.body.some((m) => m.id === mat.id))
  createdFiles.length = 0
}

// Очистка оставшихся тестовых файлов
for (const id of createdFiles) await req('DELETE', `/files/${id}`)

console.log(`\nИтог: ${passed} passed, ${failed} failed, ${skipped} skipped`)
process.exit(failed === 0 ? 0 : 1)