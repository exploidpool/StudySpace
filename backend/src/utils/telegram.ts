import type { TelegramUser } from '../types'

const AUTH_MAX_AGE_SECONDS = 86400
const FUTURE_SKEW_SECONDS = 60
const encoder = new TextEncoder()

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  return new Uint8Array(signature)
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Официальный алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export async function validateInitData(
  initData: string,
  botToken: string,
  nowSeconds: number,
): Promise<TelegramUser | null> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const authDate = Number(params.get('auth_date'))
  if (!Number.isInteger(authDate) || authDate <= 0) return null
  if (nowSeconds - authDate > AUTH_MAX_AGE_SECONDS) return null
  if (authDate - nowSeconds > FUTURE_SKEW_SECONDS) return null

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = await hmac(encoder.encode('WebAppData'), botToken)
  const expectedHash = toHex(await hmac(secretKey, dataCheckString))
  if (!timingEqual(expectedHash, hash)) return null

  const userRaw = params.get('user')
  if (!userRaw) return null
  let user: unknown
  try {
    user = JSON.parse(userRaw)
  } catch {
    return null
  }
  if (
    typeof user !== 'object' || user === null ||
    typeof (user as TelegramUser).id !== 'number' ||
    typeof (user as TelegramUser).first_name !== 'string'
  ) {
    return null
  }
  return user as TelegramUser
}