import { isTelegram } from '../services/telegram'

export function DevBanner() {
  if (isTelegram) return null
  return (
    <div className="mb-5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink">
      Режим разработки: данные Telegram недоступны. Откройте Mini App внутри Telegram.
    </div>
  )
}