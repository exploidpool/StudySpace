import type { Lesson } from '../types/schedule'
import { AppIcon } from './AppIcon'

export type LessonCardVariant = 'featured' | 'compact' | 'timeline'

interface LessonCardProps {
  lesson: Lesson
  variant: LessonCardVariant
  stateLabel?: string
}

function lessonMeta(lesson: Lesson) {
  const location = lesson.classroom ? `Ауд. ${lesson.classroom}` : null
  const subgroup = lesson.subgroup ? `Подгруппа ${lesson.subgroup}` : null
  return { location, subgroup }
}

export function LessonCard({ lesson, variant, stateLabel }: LessonCardProps) {
  const { location, subgroup } = lessonMeta(lesson)
  const endTime = lesson.end_time ? ` — ${lesson.end_time}` : ''

  if (variant === 'featured') {
    return (
      <article className="ui-surface rounded-card bg-gradient-to-br from-raised-strong to-raised p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
          <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{stateLabel ?? 'Ближайшее занятие'}</span>
          {lesson.subgroup && <span className="font-medium normal-case tracking-normal text-dim">Подгруппа {lesson.subgroup}</span>}
        </div>
        <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] tabular-nums">
          {lesson.start_time}<span className="text-base font-medium tracking-normal text-dim">{endTime}</span>
        </p>
        <h2 className="mt-2 text-lg font-semibold leading-tight">{lesson.subject_name}</h2>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-dim">
          {location && <span className="inline-flex items-center gap-1.5"><AppIcon name="map-pin" className="h-3.5 w-3.5" />{location}</span>}
          {subgroup && <span className="inline-flex items-center gap-1.5"><AppIcon name="users" className="h-3.5 w-3.5" />{subgroup}</span>}
          {lesson.teacher && <span>{lesson.teacher}</span>}
        </div>
      </article>
    )
  }

  if (variant === 'timeline') {
    return (
      <article className="grid min-h-24 grid-cols-[3.25rem_0.75rem_minmax(0,1fr)] gap-2">
        <div className="pt-3 text-xs tabular-nums">
          <strong className="block font-semibold text-ink">{lesson.start_time}</strong>
          {lesson.end_time && <span className="mt-0.5 block text-xs text-dim">{lesson.end_time}</span>}
        </div>
        <div className="relative flex justify-center before:absolute before:bottom-0 before:top-5 before:w-px before:bg-line last:before:hidden">
          <span className="relative z-10 mt-5 h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_var(--color-base)]" />
        </div>
        <div className="ui-surface mb-3 min-w-0 rounded-inner bg-surface px-4 py-3.5">
          <h3 className="break-words text-sm font-semibold">{lesson.subject_name}</h3>
          {(location || subgroup || lesson.teacher) && (
            <p className="mt-2 break-words text-xs leading-relaxed text-dim">
              {[location, subgroup, lesson.teacher].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </article>
    )
  }

  return (
    <article className="ui-surface grid min-h-18 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-inner bg-surface px-3.5 py-3">
      <div className="text-xs tabular-nums">
        <strong className="block font-semibold text-ink">{lesson.start_time}</strong>
        {lesson.end_time && <span className="block text-xs text-dim">{lesson.end_time}</span>}
      </div>
      <div className="min-w-0">
        <h3 className="break-words text-sm font-semibold">{lesson.subject_name}</h3>
        {(location || subgroup || lesson.teacher) && <p className="mt-1 break-words text-xs leading-relaxed text-dim">{[location, subgroup, lesson.teacher].filter(Boolean).join(' · ')}</p>}
      </div>
    </article>
  )
}
