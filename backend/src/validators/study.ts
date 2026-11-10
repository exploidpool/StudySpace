import type { Context } from 'hono'
import type { Env, TaskStatus, UserRow } from '../types'

export type AppContext = Context<{ Bindings: Env; Variables: { user: UserRow } }>

export type TableName = 'subjects' | 'lessons' | 'tasks' | 'notes'

type TextResult = { value: string } | { error: string }
type IntResult = { value: number } | { error: string }
type NullableIntResult = { value: number | null } | { error: string }
type DueResult = { value: string | null } | { error: string }

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const STATUSES: TaskStatus[] = ['new', 'in_progress', 'done']

export async function readJson(c: AppContext): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await c.req.json()
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

export function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function checkText(raw: unknown, key: string, max: number, required: boolean): TextResult {
  if (raw === undefined || raw === null) {
    return required ? { error: `${key}_required` } : { value: '' }
  }
  if (typeof raw !== 'string') return { error: `${key}_invalid` }
  const value = raw.trim()
  if (required && value.length === 0) return { error: `${key}_required` }
  if (value.length > max) return { error: `${key}_too_long` }
  return { value }
}

export function checkInt(raw: unknown, key: string, min: number, max: number): IntResult {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
    return { error: `${key}_invalid` }
  }
  return { value: raw }
}

export function checkTime(raw: unknown, key: string): TextResult {
  if (typeof raw !== 'string' || !TIME_RE.test(raw)) return { error: `${key}_invalid` }
  return { value: raw }
}

export function checkColor(raw: unknown): TextResult {
  if (raw === undefined || raw === null) return { value: '#8b5cf6' }
  if (typeof raw !== 'string' || !COLOR_RE.test(raw)) return { error: 'color_invalid' }
  return { value: raw }
}

export function checkStatus(raw: unknown): TextResult {
  if (raw === undefined || raw === null) return { value: 'new' }
  if (typeof raw !== 'string' || !STATUSES.includes(raw as TaskStatus)) return { error: 'status_invalid' }
  return { value: raw }
}

export function checkSubjectId(raw: unknown): NullableIntResult {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) return { error: 'subject_id_invalid' }
  return { value: raw }
}

// Дедлайн хранится в UTC; клиент передаёт ISO-строку или null
export function checkDue(raw: unknown): DueResult {
  if (raw === undefined || raw === null || raw === '') return { value: null }
  if (typeof raw !== 'string') return { error: 'due_at_invalid' }
  const ts = Date.parse(raw)
  if (Number.isNaN(ts)) return { error: 'due_at_invalid' }
  return { value: new Date(ts).toISOString() }
}

export function escapeLike(query: string): string {
  return query.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

export async function ownedRow<T>(c: AppContext, table: TableName, id: number): Promise<T | null> {
  return c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`)
    .bind(id, c.get('user').id)
    .first<T>()
}

export async function subjectOwned(c: AppContext, id: number): Promise<boolean> {
  const row = await c.env.DB.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?')
    .bind(id, c.get('user').id)
    .first()
  return row !== null
}

export class UpdateBuilder {
  private sets: string[] = []
  readonly values: unknown[] = []

  put(column: string, value: unknown): void {
    this.sets.push(`${column} = ?`)
    this.values.push(value)
  }

  get empty(): boolean {
    return this.sets.length === 0
  }

  sql(table: TableName): string {
    return `UPDATE ${table} SET ${this.sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ? RETURNING *`
  }
}