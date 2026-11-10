import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'

export function MaterialsPage() {
  return (
    <div>
      <PageHeader title="Материалы" subtitle="Предметы, конспекты и файлы" />
      <div className="space-y-4">
        <EmptyState title="Личные материалы пусты">
          Загрузка файлов появится на Этапе 4.
        </EmptyState>
        <EmptyState title="Общая библиотека пуста">
          Публикации всех пользователей StudySpace появятся на Этапе 4.
        </EmptyState>
        <EmptyState title="Групповые материалы">
          Материалы учебных групп появятся на Этапе 5.
        </EmptyState>
      </div>
    </div>
  )
}