import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'

export function TasksPage() {
  return (
    <div>
      <PageHeader title="Задания" subtitle="Дедлайны и прогресс" />
      <EmptyState title="Заданий пока нет">
        Список заданий со статусами появится на Этапе 3.
      </EmptyState>
    </div>
  )
}