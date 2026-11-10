import type { Env } from '../types'

// getFile скачивает файлы до 20 МБ, поэтому это же ограничение ставим на загрузку.
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_FILES_PER_USER = 100

interface FormatSpec {
  ext: string
  mime: string
  magic: number[] | null
}

const FORMATS: FormatSpec[] = [
  { ext: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  { ext: 'png', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'jpg', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', magic: [0x50, 0x4b, 0x03, 0x04] },
  { ext: 'txt', mime: 'text/plain', magic: null },
]

export interface DetectedFormat {
  ext: string
  mime: string
}

export type DetectResult = { value: DetectedFormat } | { error: string }

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((b, i) => bytes[i] === b)
}

function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 1024)
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0) return true
  }
  return false
}

// Проверяем расширение, MIME и фактическое содержимое (магические байты).
export function detectFormat(fileName: string, clientMime: string, bytes: Uint8Array): DetectResult {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt
  const spec = FORMATS.find((f) => f.ext === ext)
  if (!spec) return { error: 'format_unsupported' }

  const mime = clientMime.toLowerCase()
  if (mime !== '' && mime !== 'application/octet-stream' && mime !== spec.mime) {
    return { error: 'mime_mismatch' }
  }

  if (spec.magic) {
    if (!startsWith(bytes, spec.magic)) return { error: 'content_mismatch' }
  } else if (looksBinary(bytes)) {
    return { error: 'content_mismatch' }
  }

  return { value: { ext: spec.ext, mime: spec.mime } }
}

interface SendDocumentResult {
  ok: boolean
  result?: {
    message_id: number
    document?: { file_id: string; file_size?: number }
  }
}

export async function uploadToChannel(
  env: Env,
  bytes: Uint8Array,
  name: string,
  mime: string,
): Promise<{ file_id: string; message_id: number } | null> {
  const form = new FormData()
  form.append('chat_id', env.TELEGRAM_STORAGE_CHANNEL_ID!)
  form.append('document', new Blob([bytes], { type: mime }), name)
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: form,
  })
  const data = (await res.json()) as SendDocumentResult
  if (!data.ok || !data.result?.document?.file_id) return null
  return { file_id: data.result.document.file_id, message_id: data.result.message_id }
}

export async function downloadFromChannel(env: Env, fileId: string): Promise<Response | null> {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
  )
  const data = (await res.json()) as { ok: boolean; result?: { file_path?: string } }
  if (!data.ok || !data.result?.file_path) return null
  // Проксируем тело сами: прямой URL содержит токен бота и не должен попадать клиенту.
  return fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`)
}

export async function deleteFromChannel(env: Env, messageId: number): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_STORAGE_CHANNEL_ID, message_id: messageId }),
  }).catch(() => undefined)
}