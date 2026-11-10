import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Field, FormError, btnDanger, btnGhost, btnPrimary, inputCls } from '../components/fields'
import { useSubjects } from '../hooks/useSubjects'
import { apiFetch } from '../services/api'
import type { Note } from '../types/api'

interface Draft {
  title: string
  content: string
  subject_id: number | null
}

export function NotesPage() {
  const { subjects } = useSubjects()
  const [notes, setNotes] = useState<Note[]>([])
  const [listError, setListError] = useState(false)
  const [q, setQ] = useState('')
  const [editorId, setEditorId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [deleting, setDeleting] = useState<{ id: number; title: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const dirtyRef = useRef(false)

  const load = useCallback(async (query: string) => {
    try {
      setNotes(await apiFetch<Note[]>(`/notes${query ? `?q=${encodeURIComponent(query)}` : ''}`))
      setListError(false)
    } catch {
      setListError(true)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => void load(q.trim()), 300)
    return () => clearTimeout(timer)
  }, [q, load])

  const save = useCallback(async () => {
    if (editorId === null || !draft) return
    setSaveState('saving')
    try {
      await apiFetch(`/notes/${editorId}`, { method: 'PATCH', body: JSON.stringify(draft) })
      dirtyRef.current = false
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [editorId, draft])

  // Автосохранение через 1 секунду после последнего изменения
  useEffect(() => {
    if (editorId === null || !dirtyRef.current) return
    const timer = setTimeout(() => void save(), 1000)
    return () => clearTimeout(timer)
  }, [draft, editorId, save])

  function change(patch: Partial<Draft>) {
    dirtyRef.current = true
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function openNote(note: Note) {
    dirtyRef.current = false
    setSaveState('saved')
    setDraft({ title: note.title, content: note.content, subject_id: note.subject_id })
    setEditorId(note.id)
  }

  async function createNote() {
    setBusy(true)
    try {
      const note = await apiFetch<Note>('/notes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Новая заметка', content: '' }),
      })
      await load(q.trim())
      await openNote(note)
    } catch {
      setListError(true)
    } finally {
      setBusy(false)
    }
  }

  async function closeEditor() {
    await save()
    setEditorId(null)
    setDraft(null)
    await load(q.trim())
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await apiFetch(`/notes/${deleting.id}`, { method: 'DELETE' })
      if (editorId === deleting.id) {
        setEditorId(null)
        setDraft(null)
      }
      setDeleting(null)
      await load(q.trim())
    } catch {
      setListError(true)
    } finally {
      setBusy(false)
    }
  }

  const subjectName = (id: number | null) => subjects.find((s) => s.id === id)?.name ?? null

  if (editorId !== null && draft) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => void closeEditor()} className={btnGhost}>
            ← К списку
          </button>
          <span className="text-xs text-dim">
            {saveState === 'saving' ? 'Сохраняем…' : saveState === 'error' ? 'Не сохранено — повторим' : 'Сохранено'}
          </span>
        </div>
        <Field label="Название">
          <input className={inputCls} value={draft.title} maxLength={200} onChange={(e) => change({ title: e.target.value })} />
        </Field>
        <Field label="Предмет">
          <select
            className={inputCls}
            value={draft.subject_id ?? ''}
            onChange={(e) => change({ subject_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Без предмета</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Текст конспекта">
          <textarea
            className={`${inputCls} min-h-[45vh]`}
            value={draft.content}
            maxLength={50000}
            onChange={(e) => change({ content: e.target.value })}
          />
        </Field>
        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={() => setDeleting({ id: editorId, title: draft.title })}
            className={btnDanger}
          >
            Удалить
          </button>
          <button type="button" onClick={() => void save()} className={btnPrimary}>
            Сохранить сейчас
          </button>
        </div>
        {deleting && (
          <Modal title="Удалить заметку?" onClose={() => setDeleting(null)}>
            <p className="mb-4 text-sm text-dim">«{deleting.title}» будет удалена безвозвратно.</p>
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

  return (
    <div>
      <PageHeader title="Конспекты" subtitle="Личные заметки с автосохранением" />
      <div className="mb-4 flex gap-2">
        <input
          className={inputCls}
          placeholder="Поиск по названию и тексту"
          value={q}
          maxLength={200}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" onClick={() => void createNote()} disabled={busy} className={`${btnPrimary} shrink-0`}>
          Создать
        </button>
      </div>
      {listError && <FormError error="network" />}
      {notes.length === 0 && !listError ? (
        <EmptyState title={q ? 'Ничего не найдено' : 'Заметок пока нет'}>
          {q ? 'Попробуйте другой запрос.' : 'Создайте конспект — текст сохраняется автоматически.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => void openNote(note)}
              className="block w-full rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent/60"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{note.title}</p>
                {subjectName(note.subject_id) && (
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                    {subjectName(note.subject_id)}
                  </span>
                )}
              </div>
              {note.content && <p className="mt-1 line-clamp-2 text-sm text-dim">{note.content}</p>}
              <p className="mt-2 text-xs text-dim">
                Обновлено {new Date(note.updated_at + 'Z').toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}