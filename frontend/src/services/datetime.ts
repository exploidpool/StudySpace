export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
export const WEEKDAYS_FULL = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
]

export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

// Расписание — локальное «стенное» время: ближайшая дата с нужным днём недели
export function nextOccurrence(weekday: number, startTime: string, now = new Date()): Date {
  const [hours, minutes] = startTime.split(':').map(Number)
  const date = new Date(now)
  date.setHours(hours, minutes, 0, 0)
  let delta = (weekday - weekdayIndex(now) + 7) % 7
  if (delta === 0 && date.getTime() <= now.getTime()) delta = 7
  date.setDate(date.getDate() + delta)
  return date
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatDue(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isOverdue(dueAt: string | null, status: string): boolean {
  return dueAt !== null && status !== 'done' && Date.parse(dueAt) < Date.now()
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}