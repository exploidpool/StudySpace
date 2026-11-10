import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Field, FormError, btnDanger, btnGhost, btnPrimary, inputCls } from '../components/fields'
import { useSubjects } from '../hooks/useSubjects'
import { apiFetch } from '../services/api'
import { formatDue, fromLocalInput, isOverdue, sameLocalDay, toLocalInput } from '../services/datetime'
import type { Task, TaskStatus } from '../types/api'

const STATUS_LABEL: Record<TaskStatus, string> = {
  new: 'Новое',
  in_progress: 'Выполняется',
  done: 'Выполнено',
}

interface Draft {
  title: string
  description: string
  subject_id: number | null
  status: TaskStatus
  dueLocal: string
}

const emptyDraft: Draft = { title: '', description: '', subject_id: null, status: 'new', dueLocal: '' }

type DateFilter = 'all' | 'today' | 'overdue' | 'week'

export function TasksPage() {
  const { subjects } = useSubjects()
  const [tasks, setTasks] = useState<Task[]>([])
  const [listError, setListError] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Task | null>(null)

  const load = useCallback(async () => {
    try {
      setTasks(await apiFetch<Task[]>('/tasks'))
      setListError(false)
    } catch {
      setListError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setDraft(emptyDraft)
    setFormError(null)
    setEditing('new')
  }

  function openEdit(task: Task) {
    setDraft({
      title: task.title,
      description: task.description,
      subject_id: task.subject_id,
      status: task.status,
      dueLocal: toLocalInput(task.due_at),
    })
    setFormError(null)
    setEditing(task)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    const payload = {
      title: draft.title,
      description: draft.description,
      subject_id: draft.subject_id,
      status: draft.status,
      due_at: fromLocalInput(draft.dueLocal),
    }
    try {
      if (editing === 'new') await apiFetch('/tasks', { method: 'POST', body: JSON.stringify(payload) })
      else if (editing) await apiFetch(`/tasks/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setEditing(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'network')
    } finally {
      setBusy(false)
    }
  }

  async function toggleDone(task: Task) {
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: task.status === 'done' ? 'new' : 'done' }),
      })
      await load()
    } catch {
      setListError(true)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await apiFetch(`/tasks/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      await load()
    } catch {
      setFormError('network')
    } finally {
      setBusy(false)
    }
  }

  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 86400000)
  const visible = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false
    if (subjectFilter !== 'all' && task.subject_id !== Number(subjectFilter)) return false
    if (dateFilter === 'today') return task.due_at !== null && sameLocalDay(new Date(task.due_at), now)
    if (dateFilter === 'overdue') return isOverdue(task.due_at, task.status)
    if (dateFilter === 'week') {
      if (task.due_at === null || task.status === 'done') return false
      const due = new Date(task.due_at)
      return due.getTime() >= now.getTime() && due.getTime() <= weekAhead.getTime()
    }
    return true
  })

  const subjectOf = (id: number | null) => subjects.find((s) => s.id === id) ?? null

  return (
    <div>
      <PageHeader title="Задания" subtitle="Дедлайны и прогресс" />
      <button type="button" onClick={openCreate} className={`${btnPrimary} mb-4`}>
        Добавить задание
      </button>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | TaskStatus)}>
          <option value="all">Все статусы</option>
          {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className={inputCls} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="all">Все предметы</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={inputCls} value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
          <option value="all">Все даты</option>
          <option value="today">Сегодня</option>
          <option value="overdue">Просроченные</option>
          <option value="week">Ближайшие 7 дней</option>
        </select>
      </div>
      {listError && <FormError error="network" />}
      {visible.length === 0 ? (
        <EmptyState title="Заданий не найдено">
          {tasks.length === 0 ? 'Создайте первое задание кнопкой выше.' : 'Попробуйте изменить фильтры.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {visible.map((task) => {
            const subject = subjectOf(task.subject_id)
            const overdue = isOverdue(task.due_at, task.status)
            return (
              <div key={task.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.status === 'done'}
                    onChange={() => void toggleDone(task)}
                    aria-label={`Отметить «${task.title}» выполненным`}
                    className="mt-1 h-5 w-5 shrink-0 accent-[#8b5cf6]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${task.status === 'done' ? 'text-dim line-through' : ''}`}>{task.title}</p>
                    {task.description && <p className="mt-0.5 text-sm text-dim">{task.description}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-raised px-2 py-0.5 text-dim">{STATUS_LABEL[task.status]}</span>
                      {subject && (
                        <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${subject.color}26`, color: subject.color }}>
                          {subject.name}
                        </span>
                      )}
                      {task.due_at && (
                        <span className={overdue ? 'font-semibold text-red-400' : 'text-dim'}>
                          {overdue ? 'Просрочено: ' : 'Срок: '}
                          {formatDue(task.due_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => openEdit(task)} className={btnGhost}>
                      Изменить
                    </button>
                    <button type="button" onClick={() => setDeleting(task)} className={btnDanger}>
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing !== null && (
        <Modal title={editing === 'new' ? 'Новое задание' : 'Изменить задание'} onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <FormError error={formError} />
            <Field label="Название">
              <input className={inputCls} value={draft.title} maxLength={200} required onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Описание">
              <textarea className={inputCls} rows={3} value={draft.description} maxLength={5000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Предмет">
              <select
                className={inputCls}
                value={draft.subject_id ?? ''}
                onChange={(e) => setDraft({ ...draft, subject_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Без предмета</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Статус">
                <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}>
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Срок сдачи (локальное время)">
                <input type="datetime-local" className={inputCls} value={draft.dueLocal} onChange={(e) => setDraft({ ...draft, dueLocal: e.target.value })} />
              </Field>
            </div>
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
        <Modal title="Удалить задание?" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm text-dim">«{deleting.title}» будет удалено безвозвратно.</p>
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