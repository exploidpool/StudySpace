import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { DevBanner } from '../components/DevBanner'
import { FormError } from '../components/fields'
import { getTelegramUser } from '../services/telegram'
import { apiFetch } from '../services/api'
import { WEEKDAYS, formatDue, nextOccurrence, sameLocalDay } from '../services/datetime'
import type { Lesson, Material, Stats, Task } from '../types/api'

interface HomeData {
  lessons: Lesson[]
  tasks: Task[]
  stats: Stats
  materials: Material[]
}

export function HomePage() {
  const user = getTelegramUser()
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState(false)
  const date = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch<Lesson[]>('/lessons'),
      apiFetch<Task[]>('/tasks'),
      apiFetch<Stats>('/stats'),
      apiFetch<Material[]>('/materials'),
    ])
      .then(([lessons, tasks, stats, materials]) => {
        if (!cancelled) setData({ lessons, tasks, stats, materials })
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const now = new Date()
  const upcoming = (data?.lessons ?? [])
    .map((lesson) => ({ lesson, at: nextOccurrence(lesson.weekday, lesson.start_time, now) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 3)
  const todayTasks = (data?.tasks ?? []).filter(
    (t) => t.due_at !== null && t.status !== 'done' && sameLocalDay(new Date(t.due_at), now),
  )
  const deadlines = (data?.tasks ?? [])
    .filter((t) => t.due_at !== null && t.status !== 'done' && Date.parse(t.due_at) > now.getTime())
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
    .slice(0, 5)

  return (
    <div>
      <PageHeader title={user ? `Привет, ${user.first_name}!` : 'Привет!'} subtitle={date} />
      <DevBanner />
      {error && <FormError error="network" />}
      {!data && !error && <p className="mb-4 text-sm text-dim">Загружаем данные…</p>}
      <div className="space-y-4">
        {data && (
          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold">Прогресс заданий</p>
              <p className="text-dim">
                {data.stats.tasks_done} из {data.stats.tasks_total}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${data.stats.progress}%` }} />
            </div>
          </section>
        )}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dim">Ближайшие занятия</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Занятий пока нет">Добавьте расписание во вкладке «Расписание».</EmptyState>
          ) : (
            <div className="space-y-2">
              {upcoming.map(({ lesson, at }) => (
                <div key={lesson.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-medium">{lesson.title}</p>
                  <p className="text-sm text-accent">
                    {sameLocalDay(at, now)
                      ? `Сегодня, ${lesson.start_time}`
                      : `${WEEKDAYS[lesson.weekday]}, ${at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${lesson.start_time}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dim">Задачи на сегодня</h2>
          {todayTasks.length === 0 ? (
            <EmptyState title="Задач на сегодня нет">Задания с сегодняшним сроком появятся здесь.</EmptyState>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-dim">Срок: {formatDue(task.due_at!)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dim">Ближайшие дедлайны</h2>
          {deadlines.length === 0 ? (
            <EmptyState title="Дедлайнов пока нет">Ближайшие сроки сдачи появятся здесь.</EmptyState>
          ) : (
            <div className="space-y-2">
              {deadlines.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-dim">{formatDue(task.due_at!)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dim">Последние учебные материалы</h2>
          {(data?.materials ?? []).length === 0 ? (
            <EmptyState title="Материалов пока нет">Опубликуйте файл во вкладке «Материалы → Файлы».</EmptyState>
          ) : (
            <div className="space-y-2">
              {(data?.materials ?? []).slice(0, 3).map((m) => (
                <div key={m.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
                  <p className="font-medium">{m.title}</p>
                  <p className="mt-0.5 text-xs text-dim">
                    {m.author_name} · {m.ext.toUpperCase()}
                    {m.subject && <span> · {m.subject}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}