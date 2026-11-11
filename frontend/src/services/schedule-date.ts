export function todayInNovosibirsk(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Novosibirsk', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function mondayOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
  return shiftDate(date, 1 - day)
}

export function displayDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export interface WeekDayOption {
  dayOfWeek: number
  shortLabel: string
  longLabel: string
  date: string
  dayNumber: string
}

const shortDayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const longDayLabels = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

export function weekDayOptions(weekStart: string): WeekDayOption[] {
  return longDayLabels.map((longLabel, index) => {
    const date = shiftDate(weekStart, index)
    return {
      dayOfWeek: index + 1,
      shortLabel: shortDayLabels[index],
      longLabel,
      date,
      dayNumber: String(new Date(`${date}T12:00:00Z`).getUTCDate()),
    }
  })
}

export function initialScheduleDay(weekStart: string, today: string): number {
  if (mondayOf(today) !== weekStart) return 1
  return new Date(`${today}T12:00:00Z`).getUTCDay() || 7
}
