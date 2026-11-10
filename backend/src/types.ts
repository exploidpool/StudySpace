export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_STORAGE_CHANNEL_ID?: string
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

export interface SubjectRow {
  id: number
  user_id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

export interface LessonRow {
  id: number
  user_id: number
  subject_id: number | null
  title: string
  weekday: number
  start_time: string
  end_time: string
  room: string
  teacher: string
  created_at: string
  updated_at: string
}

export type TaskStatus = 'new' | 'in_progress' | 'done'

export interface TaskRow {
  id: number
  user_id: number
  subject_id: number | null
  title: string
  description: string
  status: TaskStatus
  due_at: string | null
  created_at: string
  updated_at: string
}

export interface NoteRow {
  id: number
  user_id: number
  subject_id: number | null
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface FileRow {
  id: number
  user_id: number
  telegram_file_id: string
  telegram_message_id: number | null
  name: string
  mime: string
  ext: string
  size_bytes: number
  created_at: string
  updated_at: string
}

export type MaterialVisibility = 'private' | 'public' | 'group'
export type MaterialStatus = 'published' | 'hidden'

export interface MaterialRow {
  id: number
  file_id: number
  user_id: number
  subject_id: number | null
  subject: string
  title: string
  description: string
  visibility: MaterialVisibility
  status: MaterialStatus
  created_at: string
  updated_at: string
}

export interface ReportRow {
  id: number
  user_id: number
  material_id: number
  reason: string
  status: 'open' | 'resolved'
  created_at: string
  updated_at: string
}