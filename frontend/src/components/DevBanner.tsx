import { isTelegram } from '../services/telegram'

export function DevBanner() {
  if (isTelegram) return null
  return (
    <div className="ui-surface mb-5 rounded-inner bg-accent/8 px-4 py-3 text-sm leading-relaxed text-ink">
      Режим разработки: данные Telegram недоступны. Откройте Mini App внутри Telegram.
    </div>
  )
}
