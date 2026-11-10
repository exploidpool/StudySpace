import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Modal } from '../components/Modal'
import { Field, FormError, btnGhost, btnPrimary, inputCls } from '../components/fields'
import { apiDownload, apiFetch } from '../services/api'
import { FORMAT_LABELS, formatBytes } from '../services/format'
import type { Material } from '../types/api'

const FORMATS = ['pdf', 'docx', 'pptx', 'txt', 'png', 'jpg']

export function LibraryPage() {
  const [view, setView] = useState<'all' | 'favorites'>('all')
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [format, setFormat] = useState('')
  const [items, setItems] = useState<Material[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<Material | null>(null)

  const reload = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (subject) params.set('subject', subject)
      if (format) params.set('format', format)
      const path = view === 'favorites' ? '/favorites' : `/materials?${params.toString()}`
      setItems(await apiFetch<Material[]>(path))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [view, q, subject, format])

  useEffect(() => {
    const t = setTimeout(() => void reload(), 300)
    return () => clearTimeout(t)
  }, [reload])

  async function toggleFavorite(m: Material) {
    try {
      await apiFetch(`/materials/${m.id}/favorite`, { method: m.is_favorite ? 'DELETE' : 'POST' })
      await reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function onDownload(m: Material) {
    try {
      await apiDownload(`/materials/${m.id}/download`, m.file_name)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader title="Общая библиотека" subtitle="Материалы всех пользователей StudySpace" />
      <div className="mb-4 flex gap-1">
        <button
          type="button"
          onClick={() => setView('all')}
          className={`rounded-xl px-3 py-2 text-sm ${view === 'all' ? 'bg-accent/20 font-semibold text-accent' : 'text-dim'}`}
        >
          Все
        </button>
        <button
          type="button"
          onClick={() => setView('favorites')}
          className={`rounded-xl px-3 py-2 text-sm ${view === 'favorites' ? 'bg-accent/20 font-semibold text-accent' : 'text-dim'}`}
        >
          Избранное
        </button>
      </div>

      {view === 'all' && (
        <div className="mb-4 space-y-2">
          <input className={inputCls} placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Предмет" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Все форматы</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <FormError error={error} />

      {items.length === 0 ? (
        <EmptyState title={view === 'favorites' ? 'Избранного нет' : 'Материалов не найдено'}>
          {view === 'favorites'
            ? 'Добавляйте материалы в избранное кнопкой на карточке.'
            : 'Опубликуйте свой файл во вкладке «Файлы» или измените фильтры.'}
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-medium">{m.title}</p>
              <p className="mt-1 text-xs text-dim">
                {m.author_name}
                {m.subject && <span> · {m.subject}</span>}
                <span> · {FORMAT_LABELS[m.ext] ?? m.ext} · {formatBytes(m.size_bytes)}</span>
              </p>
              {m.description && <p className="mt-2 text-sm text-dim">{m.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className={btnGhost} onClick={() => void onDownload(m)}>Скачать</button>
                <button
                  type="button"
                  className={`rounded-xl border px-4 py-2 text-sm ${m.is_favorite ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line text-dim hover:text-ink'}`}
                  onClick={() => void toggleFavorite(m)}
                >
                  {m.is_favorite ? 'В избранном' : 'В избранное'} · {m.favorites_count}
                </button>
                <button type="button" className={btnGhost} onClick={() => setReportTarget(m)}>Пожаловаться</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reportTarget && (
        <ReportModal material={reportTarget} onClose={() => setReportTarget(null)} />
      )}
    </div>
  )
}

function ReportModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/materials/${material.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Жалоба на материал" onClose={onClose}>
      {sent ? (
        <p className="text-sm text-dim">Жалоба отправлена администратору платформы.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-dim">«{material.title}»</p>
          <FormError error={error} />
          <Field label="Причина">
            <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={onClose}>Отмена</button>
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void submit()}>
              {busy ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}