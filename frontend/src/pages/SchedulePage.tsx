import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Field, FormError, btnDanger, btnGhost, btnPrimary, inputCls } from '../components/fields'
import { useSubjects } from '../hooks/useSubjects'
import { apiFetch } from '../services/api'
import { WEEKDAYS, WEEKDAYS_FULL, weekdayIndex } from '../services/datetime'
import type { Lesson } from '../types/api'

interface Draft {
  title: string
  subject_id: number | null
  weekday: number
  start_time: string
  end_time: string
  room: string
  teacher: string
}

const emptyDraft: Draft = {
  title: '',
  subject_id: null,
  weekday: 0,
  start_time: '09:00',
  end_time: '10:30',
  room: '',
  teacher: '',
}

export function SchedulePage() {
  const { subjects } = useSubjects()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [listError, setListError] = useState(false)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [day, setDay] = useState(weekdayIndex(new Date()))
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Lesson | null>(null)

  const load = useCallback(async () => {
    try {
      setLessons(await apiFetch<Lesson[]>('/lessons'))
      setListError(false)
    } catch {
      setListError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setDraft({ ...emptyDraft, weekday: day })
    setFormError(null)
    setEditing('new')
  }

  function openEdit(lesson: Lesson) {
    setDraft({
      title: lesson.title,
      subject_id: lesson.subject_id,
      weekday: lesson.weekday,
      start_time: lesson.start_time,
      end_time: lesson.end_time,
      room: lesson.room,
      teacher: lesson.teacher,
    })
    setFormError(null)
    setEditing(lesson)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') await apiFetch('/lessons', { method: 'POST', body: JSON.stringify(draft) })
      else if (editing) await apiFetch(`/lessons/${editing.id}`, { method: 'PATCH', body: JSON.stringify(draft) })
      setEditing(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'network')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await apiFetch(`/lessons/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      await load()
    } catch {
      setFormError('network')
    } finally {
      setBusy(false)
    }
  }

  const subjectColor = (id: number | null) => subjects.find((s) => s.id === id)?.color ?? '#8b91a9'

  function lessonCard(lesson: Lesson) {
    return (
      <div key={lesson.id} className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subjectColor(lesson.subject_id) }} />
            <div>
              <p className="font-semibold">{lesson.title}</p>
              <p className="mt-0.5 text-sm text-accent">
                {lesson.start_time}–{lesson.end_time}
              </p>
              {(lesson.room || lesson.teacher) && (
                <p className="mt-0.5 text-sm text-dim">
                  {lesson.room && `каб. ${lesson.room}`}
                  {lesson.room && lesson.teacher && ' · '}
                  {lesson.teacher}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => openEdit(lesson)} className={btnGhost}>
              Изменить
            </button>
            <button type="button" onClick={() => setDeleting(lesson)} className={btnDanger}>
              Удалить
            </button>
          </div>
        </div>
      </div>
    )
  }

  const dayLessons = lessons.filter((l) => l.weekday === day)

  return (
    <div>
      <PageHeader title="Расписание" subtitle="Занятия по дням и неделям" />
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex rounded-xl border border-line p-1">
          <button
            type="button"
            onClick={() => setView('day')}
            className={`rounded-lg px-3 py-1 text-sm ${view === 'day' ? 'bg-accent text-white' : 'text-dim'}`}
          >
            День
          </button>
          <button
            type="button"
            onClick={() => setView('week')}
            className={`rounded-lg px-3 py-1 text-sm ${view === 'week' ? 'bg-accent text-white' : 'text-dim'}`}
          >
            Неделя
          </button>
        </div>
        <button type="button" onClick={openCreate} className={btnPrimary}>
          Добавить занятие
        </button>
      </div>
      {listError && <FormError error="network" />}

      {view === 'day' ? (
        <div>
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {WEEKDAYS.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => setDay(index)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm ${day === index ? 'bg-accent/20 font-semibold text-accent' : 'text-dim'}`}
              >
                {name}
              </button>
            ))}
          </div>
          {dayLessons.length === 0 ? (
            <EmptyState title={`В ${WEEKDAYS_FULL[day].toLowerCase()} занятий нет`}>
              Добавьте занятие кнопкой выше.
            </EmptyState>
          ) : (
            <div className="space-y-3">{dayLessons.map(lessonCard)}</div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {WEEKDAYS_FULL.map((name, index) => {
            const items = lessons.filter((l) => l.weekday === index)
            if (items.length === 0) return null
            return (
              <section key={name}>
                <h2 className="mb-2 text-sm font-semibold text-dim">{name}</h2>
                <div className="space-y-3">{items.map(lessonCard)}</div>
              </section>
            )
          })}
          {lessons.length === 0 && (
            <EmptyState title="Расписание пустое">Добавьте первое занятие кнопкой выше.</EmptyState>
          )}
        </div>
      )}

      {editing !== null && (
        <Modal title={editing === 'new' ? 'Новое занятие' : 'Изменить занятие'} onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <FormError error={formError} />
            <Field label="Название предмета / занятия">
              <input className={inputCls} value={draft.title} maxLength={100} required onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Предмет из списка (необязательно)">
              <select
                className={inputCls}
                value={draft.subject_id ?? ''}
                onChange={(e) => setDraft({ ...draft, subject_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Без привязки</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="День недели">
              <select className={inputCls} value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}>
                {WEEKDAYS_FULL.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Начало">
                <input type="time" className={inputCls} value={draft.start_time} required onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} />
              </Field>
              <Field label="Окончание">
                <input type="time" className={inputCls} value={draft.end_time} required onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} />
              </Field>
            </div>
            <Field label="Кабинет">
              <input className={inputCls} value={draft.room} maxLength={50} onChange={(e) => setDraft({ ...draft, room: e.target.value })} />
            </Field>
            <Field label="Преподаватель (текст, необязательно)">
              <input className={inputCls} value={draft.teacher} maxLength={100} onChange={(e) => setDraft({ ...draft, teacher: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                Отмена
              </button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Удалить занятие?" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm text-dim">«{deleting.title}» ({WEEKDAYS[deleting.weekday]}, {deleting.start_time}) будет удалено.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(null)} className={btnGhost}>
              Отмена
            </button>
            <button type="button" onClick={confirmDelete} disabled={busy} className={btnDanger}>
              {busy ? 'Удаляем…' : 'Удалить'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}