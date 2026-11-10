import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Field, FormError, btnDanger, btnGhost, btnPrimary, inputCls } from '../components/fields'
import { useSubjects } from '../hooks/useSubjects'
import { apiFetch } from '../services/api'
import type { Subject } from '../types/api'

const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#ec4899']

interface Draft {
  name: string
  description: string
  color: string
}

const emptyDraft: Draft = { name: '', description: '', color: COLORS[0] }

export function SubjectsPage() {
  const { subjects, error, reload } = useSubjects()
  const [editing, setEditing] = useState<Subject | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Subject | null>(null)

  function openCreate() {
    setDraft(emptyDraft)
    setFormError(null)
    setEditing('new')
  }

  function openEdit(subject: Subject) {
    setDraft({ name: subject.name, description: subject.description, color: subject.color })
    setFormError(null)
    setEditing(subject)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      if (editing === 'new') await apiFetch('/subjects', { method: 'POST', body: JSON.stringify(draft) })
      else if (editing) await apiFetch(`/subjects/${editing.id}`, { method: 'PATCH', body: JSON.stringify(draft) })
      setEditing(null)
      await reload()
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
      await apiFetch(`/subjects/${deleting.id}`, { method: 'DELETE' })
      setDeleting(null)
      await reload()
    } catch {
      setFormError('network')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Предметы" subtitle="Цветовые метки и связи с учёбой" />
      <button type="button" onClick={openCreate} className={`${btnPrimary} mb-4`}>
        Добавить предмет
      </button>
      {error && <FormError error="network" />}
      {subjects.length === 0 && !error ? (
        <EmptyState title="Предметов пока нет">
          Создайте предмет — к нему можно привязать занятия, задания, конспекты и материалы.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <div key={subject.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
                  <div>
                    <p className="font-semibold">{subject.name}</p>
                    {subject.description && <p className="mt-0.5 text-sm text-dim">{subject.description}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEdit(subject)} className={btnGhost}>
                    Изменить
                  </button>
                  <button type="button" onClick={() => setDeleting(subject)} className={btnDanger}>
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <Modal title={editing === 'new' ? 'Новый предмет' : 'Изменить предмет'} onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            <FormError error={formError} />
            <Field label="Название">
              <input
                className={inputCls}
                value={draft.name}
                maxLength={100}
                required
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Описание">
              <textarea
                className={inputCls}
                rows={3}
                value={draft.description}
                maxLength={2000}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <Field label="Цветовая метка">
              <div className="flex gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Цвет ${color}`}
                    onClick={() => setDraft({ ...draft, color })}
                    className={`h-8 w-8 rounded-full border-2 ${draft.color === color ? 'border-ink' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
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
        <Modal title="Удалить предмет?" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm text-dim">
            «{deleting.name}» будет удалён. Занятия, задания и конспекты сохранятся, но потеряют привязку к предмету.
          </p>
          <FormError error={formError} />
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