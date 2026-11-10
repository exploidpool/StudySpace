import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { DevBanner } from '../components/DevBanner'
import { getTelegramUser, isTelegram } from '../services/telegram'

export function ProfilePage() {
  const user = getTelegramUser()

  return (
    <div>
      <PageHeader title="Профиль" subtitle="Аккаунт, группы и статистика" />
      <DevBanner />
      {user ? (
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
          </div>
        </div>
      ) : (
        !isTelegram && (
          <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-sm text-dim">
            Профиль Telegram будет показан здесь при запуске внутри Telegram.
          </div>
        )
      )}
      <div className="space-y-4">
        <EmptyState title="Группы">
          Учебные группы появятся на Этапе 5.
        </EmptyState>
        <EmptyState title="Статистика">
          Реальные показатели вашей учёбы появятся на Этапе 3.
        </EmptyState>
      </div>
    </div>
  )
}