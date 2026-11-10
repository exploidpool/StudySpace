import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { DevBanner } from '../components/DevBanner'
import { useMe } from '../hooks/useMe'
import { isTelegram } from '../services/telegram'
import { apiFetch } from '../services/api'
import type { Stats } from '../types/api'

export function ProfilePage() {
  const { data, loading, error } = useMe()
  const user = data?.user
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!isTelegram) return
    let cancelled = false
    apiFetch<Stats>('/stats')
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <PageHeader title="Профиль" subtitle="Аккаунт, группы и статистика" />
      <DevBanner />
      {loading && (
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-sm text-dim">
          Подтверждаем вход через Telegram…
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          Не удалось подтвердить вход. Закрой и открой Mini App заново.
        </div>
      )}
      {user && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          {user.photo_url ? (
            <img src={user.photo_url} alt="" className="h-14 w-14 rounded-full" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-xl font-bold text-accent">
              {user.first_name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-semibold">
              {user.first_name} {user.last_name ?? ''}
            </p>
            {user.username && <p className="text-sm text-dim">@{user.username}</p>}
            <p className="mt-0.5 text-xs text-accent">Вход подтверждён сервером</p>
          </div>
        </div>
      )}
      {!isTelegram && (
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-sm text-dim">
          Профиль Telegram будет показан здесь при запуске внутри Telegram.
        </div>
      )}
      <div className="space-y-4">
        <EmptyState title="Группы">
          Учебные группы появятся на Этапе 5.
        </EmptyState>
        {stats ? (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 font-semibold">Статистика</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-raised p-3">
                <p className="text-xs text-dim">Предметы</p>
                <p className="mt-1 text-lg font-bold">{stats.subjects}</p>
              </div>
              <div className="rounded-xl bg-raised p-3">
                <p className="text-xs text-dim">Конспекты</p>
                <p className="mt-1 text-lg font-bold">{stats.notes}</p>
              </div>
              <div className="rounded-xl bg-raised p-3">
                <p className="text-xs text-dim">Задания выполнены</p>
                <p className="mt-1 text-lg font-bold">
                  {stats.tasks_done} / {stats.tasks_total}
                </p>
              </div>
              <div className="rounded-xl bg-raised p-3">
                <p className="text-xs text-dim">Активные задания</p>
                <p className="mt-1 text-lg font-bold">{stats.tasks_active}</p>
              </div>
              <div className="rounded-xl bg-raised p-3">
                <p className="text-xs text-dim">Публикации в библиотеке</p>
                <p className="mt-1 text-lg font-bold">{stats.materials_published}</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${stats.progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-dim">Прогресс выполнения: {stats.progress}%</p>
          </div>
        ) : (
          <EmptyState title="Статистика">
            {isTelegram ? 'Загружаем показатели…' : 'Реальные показатели вашей учёбы появятся после входа через Telegram.'}
          </EmptyState>
        )}
      </div>
    </div>
  )
}