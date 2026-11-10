import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'

export function SchedulePage() {
  return (
    <div>
      <PageHeader title="Расписание" subtitle="Занятия по дням и неделям" />
      <EmptyState title="Расписание пустое">
        Создание и просмотр занятий появятся на Этапе 3.
      </EmptyState>
    </div>
  )
}