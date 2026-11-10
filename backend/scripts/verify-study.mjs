// Интеграционная проверка Этапа 3 против запущенного `wrangler dev`.
// Запуск: node scripts/verify-study.mjs (из папки backend)
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const token = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
  .match(/TELEGRAM_BOT_TOKEN=(.+)/)[1]
  .trim()

const BASE = 'http://localhost:8787'
const USER_A = { id: 999000111, first_name: 'Local', last_name: 'Test', username: 'local_test' }
const USER_B = { id: 999000222, first_name: 'Other', username: 'other_test' }

function initData(user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAH-study-test',
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

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  ok ? passed++ : failed++
}

const suffix = Date.now()
const created = { subjects: [], lessons: [], tasks: [], notes: [] }

// Авторизация
const noAuth = await req('GET', '/subjects', { user: null })
check('без Authorization -> 401', noAuth.status === 401, `HTTP ${noAuth.status}`)

// Предметы: создание и изоляция
const subjA = await req('POST', '/subjects', { body: { name: `Математика ${suffix}`, description: 'Алгебра', color: '#3b82f6' } })
check('создание предмета -> 201', subjA.status === 201 && subjA.body.color === '#3b82f6', `HTTP ${subjA.status}`)
created.subjects.push(subjA.body.id)
const subjB = await req('POST', '/subjects', { user: USER_B, body: { name: `Чужой предмет ${suffix}` } })
created.subjects.push(subjB.body.id)

const listA = await req('GET', '/subjects')
const listB = await req('GET', '/subjects', { user: USER_B })
check('список предметов изолирован', listA.body.some((s) => s.id === subjA.body.id) && !listA.body.some((s) => s.id === subjB.body.id) && listB.body.length === 1)

const idorPatch = await req('PATCH', `/subjects/${subjA.body.id}`, { user: USER_B, body: { name: 'взлом' } })
const idorDelete = await req('DELETE', `/subjects/${subjA.body.id}`, { user: USER_B })
check('IDOR: чужой предмет PATCH/DELETE -> 404', idorPatch.status === 404 && idorDelete.status === 404, `HTTP ${idorPatch.status}/${idorDelete.status}`)

const badSubject = await req('POST', '/subjects', { body: { name: '   ' } })
check('пустое имя предмета -> 400', badSubject.status === 400, `HTTP ${badSubject.status}`)

// Расписание
const lesson = await req('POST', '/lessons', {
  body: { title: 'Алгебра', weekday: 1, start_time: '09:00', end_time: '10:30', room: '204', teacher: 'Иванова А.П.', subject_id: subjA.body.id },
})
check('создание занятия -> 201', lesson.status === 201 && lesson.body.subject_id === subjA.body.id, `HTTP ${lesson.status}`)
created.lessons.push(lesson.body.id)

const badWeekday = await req('POST', '/lessons', { body: { title: 'X', weekday: 7, start_time: '09:00', end_time: '10:00' } })
const badOrder = await req('POST', '/lessons', { body: { title: 'X', weekday: 1, start_time: '10:00', end_time: '09:00' } })
const foreignSubject = await req('POST', '/lessons', { body: { title: 'X', weekday: 1, start_time: '09:00', end_time: '10:00', subject_id: subjB.body.id } })
check('невалидный день/время/чужой предмет -> 400/400/404', badWeekday.status === 400 && badOrder.status === 400 && foreignSubject.status === 404, `HTTP ${badWeekday.status}/${badOrder.status}/${foreignSubject.status}`)

const byWeekday = await req('GET', '/lessons?weekday=1')
const emptyWeekday = await req('GET', '/lessons?weekday=6')
check('фильтр по дню недели', byWeekday.body.some((l) => l.id === lesson.body.id) && emptyWeekday.body.length === 0)

// Задания
const due = new Date(Date.now() + 86400000).toISOString()
const task = await req('POST', '/tasks', { body: { title: `Домашняя работа ${suffix}`, description: 'стр 42', status: 'new', due_at: due, subject_id: subjA.body.id } })
check('создание задания -> 201, due в UTC ISO', task.status === 201 && task.body.due_at === due, `HTTP ${task.status}`)
created.tasks.push(task.body.id)

const done = await req('PATCH', `/tasks/${task.body.id}`, { body: { status: 'done' } })
const filterDone = await req('GET', '/tasks?status=done')
const filterNew = await req('GET', '/tasks?status=new')
check('статус done и фильтры', done.body.status === 'done' && filterDone.body.some((t) => t.id === task.body.id) && !filterNew.body.some((t) => t.id === task.body.id))

const badStatus = await req('PATCH', `/tasks/${task.body.id}`, { body: { status: 'expired' } })
const idorTask = await req('DELETE', `/tasks/${task.body.id}`, { user: USER_B })
check('невалидный статус -> 400, IDOR задания -> 404', badStatus.status === 400 && idorTask.status === 404, `HTTP ${badStatus.status}/${idorTask.status}`)

// Заметки и поиск
const note = await req('POST', '/notes', { body: { title: `Конспект ${suffix}`, content: 'Теорема Виета', subject_id: subjA.body.id } })
check('создание заметки -> 201', note.status === 201, `HTTP ${note.status}`)
created.notes.push(note.body.id)

const searchHit = await req('GET', '/notes?q=Виета')
const searchMiss = await req('GET', '/notes?q=Виета', { user: USER_B })
const searchUpdated = await req('PATCH', `/notes/${note.body.id}`, { body: { content: 'Теорема Пифагора' } })
const searchNew = await req('GET', '/notes?q=Пифагора')
check('поиск по содержимому + изоляция + обновление', searchHit.body.length === 1 && searchMiss.body.length === 0 && searchUpdated.status === 200 && searchNew.body.length === 1)

// Безопасное удаление предмета: связи обнуляются, записи живут
const delSubject = await req('DELETE', `/subjects/${subjA.body.id}`)
const lessonAfter = await req('GET', '/lessons')
const taskAfter = await req('GET', '/tasks')
const noteAfter = await req('GET', '/notes')
check('удаление предмета обнуляет ссылки, не удаляет записи',
  delSubject.status === 200 &&
  lessonAfter.body.find((l) => l.id === lesson.body.id)?.subject_id === null &&
  taskAfter.body.find((t) => t.id === task.body.id)?.subject_id === null &&
  noteAfter.body.find((n) => n.id === note.body.id)?.subject_id === null)

// Статистика по реальным данным
const stats = await req('GET', '/stats')
check('статистика: 1 заметка, 1 задание done, прогресс 100',
  stats.body.notes === 1 && stats.body.tasks_total === 1 && stats.body.tasks_done === 1 && stats.body.tasks_active === 0 && stats.body.progress === 100 && stats.body.subjects === 0,
  JSON.stringify(stats.body))

// Очистка созданных тестовых данных
for (const id of created.lessons) await req('DELETE', `/lessons/${id}`)
for (const id of created.tasks) await req('DELETE', `/tasks/${id}`)
for (const id of created.notes) await req('DELETE', `/notes/${id}`)
for (const id of created.subjects) await req('DELETE', `/subjects/${id}`, { user: id === subjB.body.id ? USER_B : USER_A })
const statsClean = await req('GET', '/stats')
check('очистка тестовых данных', statsClean.body.notes === 0 && statsClean.body.tasks_total === 0 && statsClean.body.subjects === 0)

console.log(`\nИтог: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)