export const tg = window.Telegram?.WebApp

export const isTelegram = Boolean(tg?.initData)

export function initTelegram() {
  if (!tg) return
  tg.ready()
  tg.expand()
  if (tg.isVersionAtLeast('6.1')) {
    tg.setHeaderColor('#0b0d14')
    tg.setBackgroundColor('#0b0d14')
  }
}

// initDataUnsafe — только для отображения в UI; личность подтверждает серверная проверка initData
export function getTelegramUser() {
  return tg?.initDataUnsafe.user ?? null
}