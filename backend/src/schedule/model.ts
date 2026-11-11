export const GROUP_CODE = 'ИС-942'
export interface Lesson {
  day_of_week: number
  start_time: string
  end_time: string | null
  subject_name: string
  classroom: string | null
  teacher: string | null
  subgroup: 1 | 2 | null
  position: number
}
export interface Draft { week_start: string; lessons: Lesson[] }
export interface WeekRow { id: string; week_start: string; status: 'draft' | 'published' | 'archived' }

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= '2000-01-01' && value <= '2100-12-31'
    && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value
}
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Novosibirsk', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function monday(date: string): string {
  const day = new Date(date + 'T00:00:00Z')
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  return day.toISOString().slice(0, 10)
}
const clock = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const text = (value: unknown, max: number, required = false) =>
  value === null || value === undefined ? !required : typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0)

export function parseDraft(value: unknown): Draft | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!validDate(raw.week_start) || monday(raw.week_start) !== raw.week_start || !Array.isArray(raw.lessons) || raw.lessons.length > 200) return null
  const lessons: Lesson[] = []
  for (const item of raw.lessons) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    if (!Number.isInteger(row.day_of_week) || Number(row.day_of_week) < 1 || Number(row.day_of_week) > 7
      || !clock(row.start_time) || (row.end_time != null && (!clock(row.end_time) || row.end_time <= row.start_time))
      || !text(row.subject_name, 200, true) || !text(row.classroom, 100) || !text(row.teacher, 200)
      || ![null, 1, 2].includes(row.subgroup as null | number)
      || !Number.isInteger(row.position) || Number(row.position) < 0 || Number(row.position) > 1000) return null
    lessons.push({ day_of_week: Number(row.day_of_week), start_time: row.start_time,
      end_time: row.end_time as string | null ?? null, subject_name: (row.subject_name as string).trim(),
      classroom: (row.classroom as string | null)?.trim() || null, teacher: (row.teacher as string | null)?.trim() || null,
      subgroup: row.subgroup as 1 | 2 | null, position: Number(row.position) })
  }
  return { week_start: raw.week_start, lessons }
}
