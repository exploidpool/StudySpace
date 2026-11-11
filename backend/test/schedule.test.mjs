import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { parseDraft, validDate, monday, today } from '../src/schedule/model.ts'
import { publishDraft } from '../src/schedule/publish.ts'

const lesson = { day_of_week: 1, start_time: '12:30', end_time: '14:05', subject_name: 'Предмет', classroom: null, teacher: null, subgroup: 1, position: 0 }
test('validates dates and Monday without exceptions for malformed dates', () => {
  for (const bad of ['2026-99-99', '2026-02-30', '2026-1-01', '', null]) assert.equal(validDate(bad), false)
  assert.equal(monday('2026-11-15'), '2026-11-09')
  assert.equal(parseDraft({ week_start: '2026-11-10', lessons: [] }), null)
})
test('today follows Novosibirsk midnight rather than UTC', () => {
  assert.equal(today(new Date('2026-11-08T16:59:59Z')), '2026-11-08')
  assert.equal(today(new Date('2026-11-08T17:00:00Z')), '2026-11-09')
})
test('accepts parallel subgroups and empty draft, rejects invalid fields', () => {
  assert.ok(parseDraft({ week_start: '2026-11-09', lessons: [lesson, { ...lesson, subgroup: 2 }] }))
  assert.ok(parseDraft({ week_start: '2026-11-09', lessons: [] }))
  for (const patch of [{ day_of_week: 0 }, { start_time: '24:00' }, { end_time: '11:00' }, { subgroup: 3 }, { subject_name: ' ' }, { position: -1 }, { classroom: 123 }]) {
    assert.equal(parseDraft({ week_start: '2026-11-09', lessons: [{ ...lesson, ...patch }] }), null)
  }
  assert.equal(parseDraft({ week_start: '2026-11-09', lessons: Array(201).fill(lesson) }), null)
})

test('migrations and publication preserve exactly one active version; stale calls are harmless', async () => {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  for (const migration of ['0001_init.sql', '0002_schedule.sql']) sqlite.exec(readFileSync(new URL(`../../database/migrations/${migration}`, import.meta.url), 'utf8'))
  sqlite.exec("INSERT INTO users (id, telegram_id, first_name) VALUES (1, 1, 'Test')")
  for (const id of ['a', 'b']) sqlite.prepare("INSERT INTO schedule_weeks (id, group_code, week_start, created_by) VALUES (?, 'ИС-942', '2026-11-09', 1)").run(id)
  const db = {
    prepare(sql) { return { bind(...args) { return { sql, args } } } },
    async batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const results = statements.map(({ sql, args }) => ({ meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }))
        sqlite.exec('COMMIT')
        return results
      } catch (error) { sqlite.exec('ROLLBACK'); throw error }
    },
  }
  assert.equal(await publishDraft(db, 'a'), true)
  assert.equal(await publishDraft(db, 'b'), true)
  assert.equal(await publishDraft(db, 'a'), false)
  assert.equal(await publishDraft(db, 'missing'), false)
  assert.equal(sqlite.prepare("SELECT id FROM schedule_weeks WHERE status = 'published'").get().id, 'b')
  assert.equal(sqlite.prepare("SELECT status FROM schedule_weeks WHERE id = 'a'").get().status, 'archived')
  assert.throws(() => sqlite.exec("UPDATE schedule_weeks SET status = 'published' WHERE id = 'a'"), /UNIQUE/)
  sqlite.close()
})
