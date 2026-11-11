import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { useState, type KeyboardEvent } from 'react'
import { useMe } from '../hooks/useMe'
import { useSchedule } from '../hooks/useSchedule'
import {
  displayDate,
  initialScheduleDay,
  mondayOf,
  shiftDate,
  todayInNovosibirsk,
  weekDayOptions,
} from '../services/schedule-date'
import { LessonList } from '../components/LessonList'
import { AppIcon } from '../components/AppIcon'
import { ScheduleImport } from '../features/schedule/ScheduleImport'
import type { ScheduleWeek } from '../types/schedule'

export function SchedulePage() {
  const [today] = useState(() => todayInNovosibirsk())
  const [week, setWeek] = useState(() => mondayOf(today))
  const [selectedDay, setSelectedDay] = useState(() => initialScheduleDay(mondayOf(today), today))
  const [transitionDirection, setTransitionDirection] = useState<-1 | 0 | 1>(0)
  const [revision, setRevision] = useState(0)
  const me = useMe()
  const { data, loading, error } = useSchedule<{ week: ScheduleWeek | null }>(`/schedule/week?week_start=${week}`, revision)
  const days = weekDayOptions(week)
  const activeDay = days.find(day => day.dayOfWeek === selectedDay) ?? days[0]
  const activeLessons = data?.week?.lessons.filter(lesson => lesson.day_of_week === selectedDay) ?? []
  const isCurrentWeek = week === mondayOf(today)

  function changeWeek(direction: -1 | 1) {
    const nextWeek = shiftDate(week, direction * 7)
    setTransitionDirection(direction)
    setWeek(nextWeek)
    setSelectedDay(initialScheduleDay(nextWeek, today))
  }

  function chooseDay(dayOfWeek: number) {
    setTransitionDirection(0)
    setSelectedDay(dayOfWeek)
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, dayOfWeek: number) {
    const lastDay = days.length
    let nextDay: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextDay = dayOfWeek === lastDay ? 1 : dayOfWeek + 1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextDay = dayOfWeek === 1 ? lastDay : dayOfWeek - 1
    if (event.key === 'Home') nextDay = 1
    if (event.key === 'End') nextDay = lastDay
    if (nextDay === null) return

    event.preventDefault()
    chooseDay(nextDay)
    document.getElementById(`schedule-day-${nextDay}`)?.focus()
  }

  return (
    <div>
      <PageHeader title="Расписание" eyebrow="Группа ИС-942" />
      {me.data?.user.role === 'admin' && <ScheduleImport onPublished={() => setRevision(value => value + 1)} />}

      <div className="ui-surface mb-4 grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 rounded-card bg-surface p-2">
        <button
          type="button"
          aria-label="Предыдущая неделя"
          onClick={() => changeWeek(-1)}
          className="ui-press grid h-11 w-11 place-items-center rounded-full bg-raised text-ink"
        >
          <AppIcon name="chevron-left" className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <strong className="block truncate text-sm font-semibold tabular-nums">
            {displayDate(week)} — {displayDate(shiftDate(week, 6))}
          </strong>
          <span className="mt-0.5 block text-xs text-dim">{isCurrentWeek ? 'Текущая неделя' : 'Выбранная неделя'}</span>
        </div>
        <button
          type="button"
          aria-label="Следующая неделя"
          onClick={() => changeWeek(1)}
          className="ui-press grid h-11 w-11 place-items-center rounded-full bg-raised text-ink"
        >
          <AppIcon name="chevron-right" className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 grid grid-cols-7 gap-1" role="tablist" aria-label="Дни недели">
        {days.map(day => {
          const selected = day.dayOfWeek === selectedDay
          return (
            <button
              key={day.date}
              type="button"
              role="tab"
              id={`schedule-day-${day.dayOfWeek}`}
              aria-selected={selected}
              aria-controls="schedule-day-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => chooseDay(day.dayOfWeek)}
              onKeyDown={event => handleDayKeyDown(event, day.dayOfWeek)}
              className={`ui-press flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-control px-0.5 py-2 ${
                selected ? 'bg-accent text-accent-ink' : 'text-dim'
              }`}
            >
              <span className="text-xs font-medium">{day.shortLabel}</span>
              <strong className="text-xs font-semibold tabular-nums">{day.dayNumber}</strong>
            </button>
          )
        })}
      </div>

      <div
        key={`${week}-${selectedDay}`}
        id="schedule-day-panel"
        className="week-view"
        data-direction={transitionDirection}
        role="tabpanel"
        aria-labelledby={`schedule-day-${selectedDay}`}
      >
        {loading ? (
          <div className="ui-surface min-h-32 rounded-card bg-surface p-5 text-sm text-dim" role="status">
            Загружаем расписание…
          </div>
        ) : error ? (
          <div className="ui-surface min-h-32 rounded-card bg-surface p-5 text-sm leading-relaxed text-danger" role="alert">
            Не удалось загрузить расписание. Откройте вкладку повторно или выберите другую неделю.
          </div>
        ) : !data?.week ? (
          <EmptyState title="Неделя ещё не опубликована">
            Расписание появится после проверки администратором. Для просмотра войдите через Telegram.
          </EmptyState>
        ) : (
          <section aria-labelledby="selected-day-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="selected-day-title" className="text-base font-semibold tracking-[-0.02em]">
                {activeDay.longLabel}
              </h2>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-dim">
                Занятий: {activeLessons.length}
              </span>
            </div>
            {activeLessons.length ? (
              <LessonList lessons={activeLessons} variant="timeline" />
            ) : (
              <EmptyState title="Занятий нет">Для этого дня в опубликованной неделе занятий нет.</EmptyState>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
