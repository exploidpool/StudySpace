import type { ReactNode } from 'react'

export const inputCls =
  'w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent'
export const btnPrimary =
  'rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/80 disabled:opacity-50'
export const btnGhost = 'rounded-xl border border-line px-4 py-2 text-sm text-dim hover:text-ink'
export const btnDanger = 'rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400'

const ERROR_RU: Record<string, string> = {
  invalid_json: 'Некорректный запрос',
  name_required: 'Укажите название',
  title_required: 'Укажите название',
  name_too_long: 'Название слишком длинное',
  title_too_long: 'Название слишком длинное',
  description_too_long: 'Описание слишком длинное',
  content_too_long: 'Текст слишком длинный',
  weekday_invalid: 'Выберите день недели',
  start_time_invalid: 'Укажите время начала (ЧЧ:ММ)',
  end_time_invalid: 'Укажите время окончания (ЧЧ:ММ)',
  time_order_invalid: 'Окончание должно быть позже начала',
  status_invalid: 'Недопустимый статус',
  due_at_invalid: 'Некорректная дата срока',
  subject_id_invalid: 'Некорректный предмет',
  subject_not_found: 'Предмет не найден',
  color_invalid: 'Некорректный цвет',
  nothing_to_update: 'Нет изменений',
  not_found: 'Запись не найдена',
  file_required: 'Выберите файл',
  file_empty: 'Файл пуст',
  file_too_large: 'Файл больше 20 МБ',
  files_limit: 'Достигнут лимит количества файлов',
  format_unsupported: 'Формат не поддерживается (PDF, DOCX, PPTX, TXT, PNG, JPG)',
  mime_mismatch: 'MIME-тип не соответствует расширению',
  content_mismatch: 'Содержимое не соответствует формату',
  storage_not_configured: 'Хранилище ещё не настроено (канал не подключён)',
  storage_upload_failed: 'Не удалось загрузить файл в хранилище',
  storage_download_failed: 'Не удалось скачать файл из хранилища',
  file_id_invalid: 'Некорректный файл',
  file_not_found: 'Файл не найден',
  visibility_invalid: 'Недопустимый уровень доступа',
  subject_too_long: 'Название предмета слишком длинное',
  reason_required: 'Опишите причину жалобы',
  reason_too_long: 'Причина слишком длинная',
  already_reported: 'Жалоба на этот материал уже отправлена',
  format_invalid: 'Недопустимый формат',
  forbidden: 'Недостаточно прав',
}

export function errorText(code: string): string {
  return ERROR_RU[code] ?? `Ошибка: ${code}`
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-dim">{label}</span>
      {children}
    </label>
  )
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
      {errorText(error)}
    </p>
  )
}