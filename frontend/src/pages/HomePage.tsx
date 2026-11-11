import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { DevBanner } from '../components/DevBanner'
import { getTelegramUser } from '../services/telegram'
import { telegramGreetingName } from '../services/telegram-display'
import { useSchedule } from '../hooks/useSchedule'
import { LessonList } from '../components/LessonList'
import type { Lesson } from '../types/schedule'

export function HomePage() {
  const user = getTelegramUser()
  const displayName = telegramGreetingName(user)
  const schedule = useSchedule<{ date: string; lessons: Lesson[] }>('/schedule/today')
  const date = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Novosibirsk',
  })

  return (
    <div>
      <PageHeader
        title={displayName ? `Привет, ${displayName}` : 'Привет!'}
        eyebrow={date}
      />
      <DevBanner />
      <div className="space-y-6">
        <section aria-labelledby="today-lessons-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="today-lessons-title" className="text-base font-semibold tracking-[-0.02em]">Сегодня</h2>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-dim">ИС-942</span>
          </div>
          {schedule.loading ? (
            <div className="ui-surface min-h-32 rounded-card bg-surface p-5 text-sm text-dim" role="status">
              Загружаем занятия…
            </div>
          ) : schedule.error ? (
            <div className="ui-surface min-h-32 rounded-card bg-surface p-5 text-sm leading-relaxed text-danger" role="alert">
              Не удалось загрузить занятия. Откройте вкладку повторно.
            </div>
          ) : schedule.data?.lessons.length ? (
            <LessonList lessons={schedule.data.lessons} variant="home" />
          ) : (
            <EmptyState title="На сегодня занятий нет">
              Возможно, расписание ещё не опубликовано. Все недели доступны во вкладке «Расписание».
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="today-tasks-title">
          <h2 id="today-tasks-title" className="mb-3 text-base font-semibold tracking-[-0.02em]">Задачи на сегодня</h2>
          <EmptyState title="Задач пока нет">
            Задания и дедлайны появятся здесь после настройки на Этапе 3.
          </EmptyState>
        </section>
      </div>
    </div>
  )
}
