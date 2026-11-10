export interface MeUser {
  id: number
  telegram_id: number
  username: string | null
  first_name: string
  last_name: string | null
  photo_url: string | null
  role: 'student' | 'admin'
}

export interface MeProfile {
  college: string | null
  specialty: string | null
  course: number | null
  group_name: string | null
  timezone: string
}

export interface MeResponse {
  user: MeUser
  profile: MeProfile | null
}

export interface Subject {
  id: number
  user_id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

export interface Lesson {
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

export interface Task {
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

export interface Note {
  id: number
  user_id: number
  subject_id: number | null
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface Stats {
  subjects: number
  notes: number
  tasks_total: number
  tasks_done: number
  tasks_active: number
  materials_published: number
  progress: number
}

export interface FileMeta {
  id: number
  name: string
  mime: string
  ext: string
  size_bytes: number
  created_at: string
  published: number
}

export interface Material {
  id: number
  file_id: number
  user_id: number
  subject_id: number | null
  subject: string
  title: string
  description: string
  visibility: 'private' | 'public' | 'group'
  status: 'published' | 'hidden'
  created_at: string
  updated_at: string
  ext: string
  size_bytes: number
  file_name: string
  author_id: number
  author_name: string
  author_username: string | null
  favorites_count: number
  is_favorite: number
}

export interface ReportItem {
  id: number
  user_id: number
  material_id: number
  reason: string
  status: 'open' | 'resolved'
  created_at: string
  updated_at: string
  material_title: string
  reporter_name: string
  reporter_username: string | null
}