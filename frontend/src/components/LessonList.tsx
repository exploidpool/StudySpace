import type { Lesson } from '../types/schedule'
import { LessonCard } from './LessonCard'

type LessonListVariant = 'home' | 'compact' | 'timeline'

export function LessonList({ lessons, variant = 'compact' }: { lessons: Lesson[]; variant?: LessonListVariant }) {
  const sorted = [...lessons].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.position - b.position)

  return (
    <ul className={variant === 'home' ? 'space-y-4' : variant === 'timeline' ? '' : 'space-y-2'}>
      {sorted.map((lesson, index) => (
        <li key={`${lesson.day_of_week}-${lesson.start_time}-${lesson.position}-${lesson.subject_name}`}>
          <LessonCard
            lesson={lesson}
            variant={variant === 'home' && index === 0 ? 'featured' : variant === 'timeline' ? 'timeline' : 'compact'}
            stateLabel={variant === 'home' && index === 0 ? 'Первая пара сегодня' : undefined}
          />
        </li>
      ))}
    </ul>
  )
}
