export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  TELEGRAM_BOT_TOKEN: string
}

export interface UserRow {
  id: number
  telegram_id: number
  username: string | null
  first_name: string
  last_name: string | null
  photo_url: string | null
  role: 'student' | 'admin'
  created_at: string
  updated_at: string
}

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}