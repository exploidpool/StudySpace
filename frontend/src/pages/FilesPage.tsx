import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Field, FormError, btnDanger, btnGhost, btnPrimary, inputCls } from '../components/fields'
import { useSubjects } from '../hooks/useSubjects'
import { apiDownload, apiFetch, apiUpload } from '../services/api'
import { FILE_ACCEPT, FORMAT_LABELS, formatBytes } from '../services/format'
import type { FileMeta } from '../types/api'

export function FilesPage() {
  const [files, setFiles] = useState<FileMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [publishTarget, setPublishTarget] = useState<FileMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileMeta | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { subjects } = useSubjects()

  const reload = useCallback(async () => {
    try {
      setFiles(await apiFetch<FileMeta[]>('/files'))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function onPick(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      await apiUpload('/files', form)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function onDownload(f: FileMeta) {
    try {
      await apiDownload(`/files/${f.id}/download`, f.name)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function onDelete() {
    if (!deleteTarget) return
    try {
      await apiFetch(`/files/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      await reload()
    } catch (e) {
      setError((e as Error).message)
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader title="Личные файлы" subtitle="Доступны только вам. Публикация — отдельным действием." />
      <FormError error={error} />
      <div className="mb-4">
        <input
          ref={inputRef}
          type="file"
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />
        <button type="button" className={btnPrimary} disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? 'Загрузка…' : 'Загрузить файл'}
        </button>
        <p className="mt-2 text-xs text-dim">PDF, DOCX, PPTX, TXT, PNG, JPG · до 20 МБ · до 100 файлов</p>
      </div>

      {files.length === 0 ? (
        <EmptyState title="Личных файлов нет">Загрузите первый файл кнопкой выше.</EmptyState>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="mt-1 text-xs text-dim">
                    {FORMAT_LABELS[f.ext] ?? f.ext} · {formatBytes(f.size_bytes)}
                    {f.published > 0 && <span className="ml-2 text-accent">в библиотеке</span>}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => void onDownload(f)}>Скачать</button>
                <button type="button" className={btnGhost} onClick={() => setPublishTarget(f)}>Опубликовать</button>
                <button type="button" className={btnDanger} onClick={() => setDeleteTarget(f)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {publishTarget && (
        <PublishModal
          file={publishTarget}
          subjects={subjects}
          onClose={() => setPublishTarget(null)}
          onDone={() => {
            setPublishTarget(null)
            void reload()
          }}
        />
      )}

      {deleteTarget && (
        <Modal title="Удалить файл?" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-dim">
            «{deleteTarget.name}» будет удалён вместе с публикациями и избранным, где он использовался.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => setDeleteTarget(null)}>Отмена</button>
            <button type="button" className={btnDanger} onClick={() => void onDelete()}>Удалить</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PublishModal({
  file,
  subjects,
  onClose,
  onDone,
}: {
  file: FileMeta
  subjects: { id: number; name: string }[]
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState(file.name)
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: file.id,
          title,
          description,
          subject_id: subjectId === '' ? null : Number(subjectId),
          visibility: 'public',
        }),
      })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Публикация в библиотеку" onClose={onClose}>
      <p className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
        Материал станет доступен всем пользователям StudySpace.
      </p>
      <FormError error={error} />
      <Field label="Название">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
      </Field>
      <Field label="Описание">
        <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </Field>
      <Field label="Предмет">
        <select className={inputCls} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Без предмета</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onClose}>Отмена</button>
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void submit()}>
          {busy ? 'Публикация…' : 'Опубликовать'}
        </button>
      </div>
    </Modal>
  )
}