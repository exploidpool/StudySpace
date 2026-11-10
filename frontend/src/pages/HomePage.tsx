import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { DevBanner } from '../components/DevBanner'
import { getTelegramUser } from '../services/telegram'

export function HomePage() {
  const user = getTelegramUser()
  const date = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div>
      <PageHeader
        title={user ? `Привет, ${user.first_name}!` : 'Привет!'}
        subtitle={date}
      />
      <DevBanner />
      <div className="space-y-4">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dim">Ближайшие занятия</h2>
          <EmptyState title="Занятий пока нет">
            Расписание появится здесь после настройки на Этапе 3.
          </EmptyState>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-dim">Задачи на сегодня</h2>
          <EmptyState title="Задач пока нет">
            Задания и дедлайны появятся здесь после настройки на Этапе 3.
          </EmptyState>
        </section>
      </div>
    </div>
  )
}